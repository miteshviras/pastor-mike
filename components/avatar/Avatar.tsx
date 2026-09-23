"use client";

import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { useFrame } from "@react-three/fiber";
import { useGLTF, PerspectiveCamera } from "@react-three/drei";
import { LipSyncController } from "./LipSyncController";
import { BlinkController } from "./BlinkController";
import { IdleController, AvatarMood } from "./IdleController";
import { GazeController } from "./GazeController";
import { getAudioLevel, isAudioLevelAvailable } from "@/lib/voice/audioLevel";

// Silence Three.js r183+ deprecation warning for THREE.Clock used internally by @react-three/fiber
if (typeof window !== "undefined") {
  if (typeof (THREE as unknown as { setConsoleFunction?: unknown }).setConsoleFunction === "function") {
    (THREE as unknown as { setConsoleFunction: (fn: (type: string, message: string, ...params: unknown[]) => void) => void }).setConsoleFunction(
      (type, message, ...params) => {
        if (typeof message === "string" && message.includes("Clock: This module has been deprecated")) {
          return;
        }
        const method = (console as unknown as Record<string, (...args: unknown[]) => void>)[type] || console.log;
        method.call(console, message, ...params);
      },
    );
  }

  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const first = typeof args[0] === "string" ? args[0] : "";
    if (first.includes("Clock: This module has been deprecated")) {
      return;
    }
    originalWarn.apply(console, args);
  };
}

// ponytail: loose glTF (scene.gltf + scene.bin + textures/) rather than a packed .glb —
// three's GLTFLoader resolves the relative texture paths fine over HTTP, so no repackaging
// tool was needed. Swap for a single .glb here if a blendshape-bearing export replaces this one.
const AVATAR_URL = "/models/pastor-mike-head/scene.gltf";

// Meshes not needed for a head/shoulders portrait framing — hidden to cut triangle
// submission on a full-body rig, not just cropped out of view. The descriptive
// "Wolf3D_Outfit_Footwear_74"-style name lives on the mesh's parent node, not the
// mesh itself (which is just "Object_21"), so this checks ancestors too.
const HIDDEN_MESH_PATTERN = /outfit_bottom|footwear/i;
const CAMERA_FOV_DEGREES = 28;
// Tighter portrait fit so the head and face fill the frame with lifelike human presence
const FIT_MARGIN = 0.98;

function matchesSelfOrAncestor(node: THREE.Object3D, pattern: RegExp): boolean {
  let current: THREE.Object3D | null = node;
  while (current) {
    if (pattern.test(current.name)) return true;
    current = current.parent;
  }
  return false;
}

export interface AvatarHandle {
  speak: () => void;
  stop: () => void;
  playAnimation: (name: string) => void;
  setMood: (mood: AvatarMood) => void;
}

function logMorphTargets(root: THREE.Object3D) {
  if (process.env.NODE_ENV === "production") return;
  const lines: string[] = [];
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.morphTargetDictionary) {
      const names = Object.keys(mesh.morphTargetDictionary);
      if (names.length > 0) {
        lines.push(mesh.name || node.name);
        names.forEach((n) => lines.push(`  ${n}`));
      }
    }
  });
  console.log(
    lines.length > 0
      ? `[Avatar] Morph targets found:\n${lines.join("\n")}`
      : "[Avatar] No morph targets found on this model.",
  );
}

export const Avatar = forwardRef<
  AvatarHandle,
  { onModelError?: (err: unknown) => void; isPraying?: boolean }
>(function Avatar({ isPraying = false }, ref) {
    const { scene, animations } = useGLTF(AVATAR_URL);

    // Clone per-instance so multiple mounts (or hot reloads) never mutate the cached
    // source scene, and skinned-mesh/morph-target bindings survive the clone.
    const root = useMemo(() => cloneSkeleton(scene) as THREE.Object3D, [scene]);

    // Frames the head/shoulders by (1) recentering the whole rig on the head bone's world
    // position, mutating root.position directly (not via a JSX prop) so it's already in its
    // final place before (2) measures the now-settled geometry's bounding sphere to fit the
    // camera distance to it. Fitting the camera to the actual measured geometry — rather than
    // a fixed distance, or a guessed per-model scale correction — is what makes this work
    // consistently across source rigs authored at very different scales, with no per-asset
    // tuning needed.
    const cameraDistance = useMemo(() => {
      root.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (mesh.isMesh && matchesSelfOrAncestor(node, HIDDEN_MESH_PATTERN)) {
          mesh.visible = false;
        }
      });
      logMorphTargets(root);

      // Reset to a known baseline before measuring: this callback mutates root.position below,
      // and React (StrictMode in dev, or any future re-render with the same `root`) can invoke
      // a useMemo factory more than once — without this reset, a second call would measure
      // from the *already-offset* position left by the first call and compound the offset,
      // moving the model further and further out of the camera's view each time.
      root.position.set(0, 0, 0);
      root.updateMatrixWorld(true);

      // Center on the visible geometry's own bounding-sphere center rather than a specific
      // bone — this adapts to whatever's actually on screen (just a head, or a head-and-neck
      // bust) instead of a fixed "shoulders" assumption tuned for one particular rig.
      const sphere = new THREE.Box3().setFromObject(root).getBoundingSphere(new THREE.Sphere());
      if (sphere.isEmpty()) return 1.4; // sane fallback if geometry measurement fails

      root.position.set(-sphere.center.x, -sphere.center.y, -sphere.center.z);
      root.updateMatrixWorld(true);

      const fovRad = THREE.MathUtils.degToRad(CAMERA_FOV_DEGREES);
      return Math.max((sphere.radius / Math.sin(fovRad / 2)) * FIT_MARGIN, 0.3);
    }, [root]);

    const lipSync = useMemo(() => new LipSyncController(root), [root]);
    const blink = useMemo(() => new BlinkController(root), [root]);
    const idle = useMemo(() => new IdleController(root), [root]);
    const gaze = useMemo(() => new GazeController(root), [root]);
    const mixer = useMemo(() => new THREE.AnimationMixer(root), [root]);
    const currentAction = useRef<THREE.AnimationAction | null>(null);

    // Plain ref, not state — updated on every pointermove without triggering a re-render;
    // read once per frame in useFrame below.
    const mouseRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
      function handlePointerMove(e: PointerEvent) {
        mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouseRef.current.y = (e.clientY / window.innerHeight) * 2 - 1;
      }
      window.addEventListener("pointermove", handlePointerMove);
      return () => window.removeEventListener("pointermove", handlePointerMove);
    }, []);

    useEffect(() => {
      blink.setForcedClosed(isPraying);
      idle.setPraying(isPraying);
    }, [isPraying, blink, idle]);

    useImperativeHandle(
      ref,
      () => ({
        speak: () => {
          lipSync.startTalking();
          idle.setMood("talking");
        },
        stop: () => {
          lipSync.stopTalking();
          idle.setMood("idle");
        },
        setMood: (mood: AvatarMood) => idle.setMood(mood),
        playAnimation: (name: string) => {
          const clip = THREE.AnimationClip.findByName(animations, name);
          if (!clip) {
            if (process.env.NODE_ENV !== "production") {
              console.warn(`[Avatar] No animation clip named "${name}" found — skipping.`);
            }
            return;
          }
          currentAction.current?.stop();
          const action = mixer.clipAction(clip);
          action.reset().play();
          currentAction.current = action;
        },
      }),
      [lipSync, idle, mixer, animations],
    );

    // The single per-frame tick for the whole avatar — R3F's own rAF loop, nothing extra added.
    useFrame((_state, delta) => {
      idle.update(delta);
      blink.update(delta);
      gaze.setTarget(mouseRef.current.x, mouseRef.current.y);
      gaze.update(delta);
      lipSync.setExternalLevel(isAudioLevelAvailable() ? getAudioLevel() : null);
      lipSync.update(delta);
      mixer.update(delta);
    });

    return (
      <group dispose={null}>
        <PerspectiveCamera makeDefault fov={CAMERA_FOV_DEGREES} position={[0, 0, cameraDistance]} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[0.5, 1, 1]} intensity={1.1} />
        <primitive object={root} />
      </group>
    );
  },
);

useGLTF.preload(AVATAR_URL);
