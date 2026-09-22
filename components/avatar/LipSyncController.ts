import * as THREE from "three";

// Morph target name fragments that indicate mouth/viseme influence, checked case-insensitively.
const MOUTH_TARGET_PATTERN = /viseme|mouth|jaw/i;
const LERP_SPEED = 0.2;
const MAX_JAW_DEGREES = 10;

interface MorphMesh {
  mesh: THREE.Mesh;
  influences: number[];
  indices: number[]; // indices into influences[] that are mouth-related
}

export class LipSyncController {
  private morphMeshes: MorphMesh[] = [];
  private jawBone: THREE.Bone | null = null;
  private jawBaseQuaternion: THREE.Quaternion | null = null;
  private mode: "morph" | "jaw" | "none" = "none";

  private talking = false;
  private intensity = 1;
  private current = 0;
  private target = 0;
  private clock = 0;
  // Real playback amplitude (0..1) fed in per frame from the Web Audio analyser, or null when
  // unavailable (e.g. the browser-speechSynthesis fallback, which exposes no audio buffer).
  private externalLevel: number | null = null;

  // Reused scratch objects — never allocated per frame.
  private scratchQuaternion = new THREE.Quaternion();
  private scratchEuler = new THREE.Euler();

  constructor(root: THREE.Object3D) {
    // Rigs with separate upper/lower jaw bones (e.g. "Jaw_Upper" + "Jaw_Lower") need the
    // lower one specifically — rotating the upper jaw looks wrong. Prefer a "lower" match;
    // fall back to any other jaw-named bone if that's all the rig has.
    let fallbackJaw: THREE.Bone | null = null;

    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
        const indices = Object.entries(mesh.morphTargetDictionary)
          .filter(([name]) => MOUTH_TARGET_PATTERN.test(name))
          .map(([, index]) => index);
        if (indices.length > 0) {
          this.morphMeshes.push({ mesh, influences: mesh.morphTargetInfluences, indices });
        }
      }
      if ((node as THREE.Bone).isBone && /jaw/i.test(node.name)) {
        if (/lower/i.test(node.name)) {
          if (!this.jawBone) this.jawBone = node as THREE.Bone;
        } else if (!fallbackJaw) {
          fallbackJaw = node as THREE.Bone;
        }
      }
    });

    if (!this.jawBone) this.jawBone = fallbackJaw;

    if (this.morphMeshes.length > 0) {
      this.mode = "morph";
    } else if (this.jawBone) {
      this.mode = "jaw";
      this.jawBaseQuaternion = this.jawBone.quaternion.clone();
    } else {
      this.mode = "none";
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[LipSyncController] No mouth morph targets or jaw bone found — mouth will stay static.",
        );
      }
    }
  }

  getMode() {
    return this.mode;
  }

  startTalking() {
    this.talking = true;
  }

  stopTalking() {
    this.talking = false;
    this.target = 0;
  }

  setIntensity(value: number) {
    this.intensity = THREE.MathUtils.clamp(value, 0, 1);
  }

  // Called once per frame with the current TTS playback's real RMS amplitude (0..1), or null
  // when no analyser is attached — driving the mouth from the actual system audio waveform
  // rather than the synthetic pattern below, which becomes a fallback only.
  setExternalLevel(level: number | null) {
    this.externalLevel = level;
  }

  update(delta: number) {
    if (this.mode === "none") return;

    this.clock += delta;

    if (this.talking) {
      if (this.externalLevel !== null) {
        this.target = THREE.MathUtils.clamp(this.externalLevel * this.intensity, 0, 1);
      } else {
        // Fake speech envelope: fast sine wave + small random jitter, cheap to compute.
        const wave = Math.sin(this.clock * 14) * 0.5 + 0.5;
        const jitter = (Math.random() - 0.5) * 0.15;
        this.target = THREE.MathUtils.clamp(wave * this.intensity + jitter, 0, 1);
      }
    } else {
      this.target = 0;
    }

    this.current += (this.target - this.current) * LERP_SPEED;

    if (this.mode === "morph") {
      for (const { influences, indices } of this.morphMeshes) {
        for (const index of indices) {
          influences[index] = this.current;
        }
      }
    } else if (this.mode === "jaw" && this.jawBone && this.jawBaseQuaternion) {
      const angle = THREE.MathUtils.degToRad(MAX_JAW_DEGREES) * this.current;
      this.scratchEuler.set(angle, 0, 0);
      this.scratchQuaternion.setFromEuler(this.scratchEuler);
      this.jawBone.quaternion.copy(this.jawBaseQuaternion).multiply(this.scratchQuaternion);
    }
  }
}
