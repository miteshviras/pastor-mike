import * as THREE from "three";

const BREATH_AMPLITUDE = 0.005; // 0.003–0.006 range
const BREATH_SPEED = 0.6;
const NOD_MAX_X_DEG = 2;
const NOD_MAX_Y_DEG = 1;
const NOD_SPEED = 1.6;
const LOOK_DOWN_DEG = 6; // subtle "thinking" head-down tilt

export type AvatarMood = "idle" | "thinking" | "talking";

export class IdleController {
  private headBone: THREE.Bone | null = null;
  private chestBone: THREE.Bone | null = null;
  private headBaseQuaternion: THREE.Quaternion | null = null;
  private chestBaseScale: THREE.Vector3 | null = null;

  private mood: AvatarMood = "idle";
  private clock = 0;

  private scratchEuler = new THREE.Euler();
  private scratchQuaternion = new THREE.Quaternion();
  private moodQuaternion = new THREE.Quaternion();

  constructor(root: THREE.Object3D) {
    root.traverse((node) => {
      if (!this.headBone && /^head/i.test(node.name) && (node as THREE.Bone).isBone) {
        this.headBone = node as THREE.Bone;
      }
      if (!this.chestBone && /^spine/i.test(node.name) && (node as THREE.Bone).isBone) {
        this.chestBone = node as THREE.Bone;
      }
    });

    if (this.headBone) this.headBaseQuaternion = this.headBone.quaternion.clone();
    if (this.chestBone) this.chestBaseScale = this.chestBone.scale.clone();
  }

  setMood(mood: AvatarMood) {
    this.mood = mood;
  }

  update(delta: number) {
    this.clock += delta;

    // Subtle chest breathing — reuses the bone's own base scale, no allocation.
    if (this.chestBone && this.chestBaseScale) {
      const breath = 1 + Math.sin(this.clock * BREATH_SPEED) * BREATH_AMPLITUDE;
      this.chestBone.scale.set(
        this.chestBaseScale.x * breath,
        this.chestBaseScale.y,
        this.chestBaseScale.z * breath,
      );
    }

    if (!this.headBone || !this.headBaseQuaternion) return;

    let pitchDeg = 0;
    let yawDeg = 0;

    if (this.mood === "thinking") {
      pitchDeg = LOOK_DOWN_DEG;
    } else if (this.mood === "talking") {
      pitchDeg = Math.sin(this.clock * NOD_SPEED) * NOD_MAX_X_DEG;
      yawDeg = Math.cos(this.clock * NOD_SPEED * 0.7) * NOD_MAX_Y_DEG;
    }

    // Always-on tiny idle sway so the head never looks frozen.
    pitchDeg += Math.sin(this.clock * BREATH_SPEED * 0.8) * 0.4;

    this.scratchEuler.set(
      THREE.MathUtils.degToRad(pitchDeg),
      THREE.MathUtils.degToRad(yawDeg),
      0,
    );
    this.moodQuaternion.setFromEuler(this.scratchEuler);
    this.scratchQuaternion.copy(this.headBaseQuaternion).multiply(this.moodQuaternion);
    this.headBone.quaternion.slerp(this.scratchQuaternion, 0.15);
  }
}
