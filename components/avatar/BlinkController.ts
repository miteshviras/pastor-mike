import * as THREE from "three";

const BLINK_TARGET_PATTERN = /blink|eyeclose|eyesclosed/i;
// Bone-rig fallback for rigs with individual eyelid bones instead of blink morph targets
// (e.g. "Eyelid_upper_L", "Eyelid_upper_L.001", ...segments forming the lid curve).
const EYELID_BONE_PATTERN = /eyelid.?upper/i;
const EYELID_CLOSE_DEGREES = 28;
const BLINK_DURATION = 0.12; // 120ms closed
const MIN_INTERVAL = 3;
const MAX_INTERVAL = 6;

interface BlinkMesh {
  influences: number[];
  indices: number[];
}

export class BlinkController {
  private blinkMeshes: BlinkMesh[] = [];
  private eyelidBones: THREE.Bone[] = [];
  private eyelidBaseQuaternions: THREE.Quaternion[] = [];
  private mode: "morph" | "bone" | "none" = "none";

  private clock = 0;
  private nextBlinkAt = 0;
  private blinkEndsAt = -1;

  // Reused scratch objects — never allocated per frame.
  private scratchEuler = new THREE.Euler();
  private scratchQuaternion = new THREE.Quaternion();

  constructor(root: THREE.Object3D) {
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
        const indices = Object.entries(mesh.morphTargetDictionary)
          .filter(([name]) => BLINK_TARGET_PATTERN.test(name))
          .map(([, index]) => index);
        if (indices.length > 0) {
          this.blinkMeshes.push({ influences: mesh.morphTargetInfluences, indices });
        }
      }
      if ((node as THREE.Bone).isBone && EYELID_BONE_PATTERN.test(node.name)) {
        this.eyelidBones.push(node as THREE.Bone);
      }
    });

    if (this.blinkMeshes.length > 0) {
      this.mode = "morph";
    } else if (this.eyelidBones.length > 0) {
      this.mode = "bone";
      this.eyelidBaseQuaternions = this.eyelidBones.map((bone) => bone.quaternion.clone());
    }

    this.scheduleNextBlink();
  }

  private scheduleNextBlink() {
    const interval = MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL);
    this.nextBlinkAt = this.clock + interval;
  }

  update(delta: number) {
    if (this.mode === "none") return;
    this.clock += delta;

    if (this.blinkEndsAt < 0 && this.clock >= this.nextBlinkAt) {
      this.blinkEndsAt = this.clock + BLINK_DURATION;
    }

    const closed = this.blinkEndsAt >= 0 && this.clock < this.blinkEndsAt;

    if (this.blinkEndsAt >= 0 && this.clock >= this.blinkEndsAt) {
      this.blinkEndsAt = -1;
      this.scheduleNextBlink();
    }

    if (this.mode === "morph") {
      const value = closed ? 1 : 0;
      for (const { influences, indices } of this.blinkMeshes) {
        for (const index of indices) {
          influences[index] = value;
        }
      }
    } else if (this.mode === "bone") {
      const angle = closed ? THREE.MathUtils.degToRad(EYELID_CLOSE_DEGREES) : 0;
      this.scratchEuler.set(-angle, 0, 0);
      this.scratchQuaternion.setFromEuler(this.scratchEuler);
      for (let i = 0; i < this.eyelidBones.length; i++) {
        this.eyelidBones[i].quaternion.copy(this.eyelidBaseQuaternions[i]).multiply(this.scratchQuaternion);
      }
    }
  }
}
