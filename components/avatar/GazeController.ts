import * as THREE from "three";

// Matches "Eye_L_66" / "Eye_R_67" but not "Eyelid_upper_L*" or "Eyebrow_L*".
const EYE_BONE_L_PATTERN = /^eye_l/i;
const EYE_BONE_R_PATTERN = /^eye_r/i;
const GAZE_MAX_YAW_DEG = 12; // left/right — human-plausible, not cartoonish
const GAZE_MAX_PITCH_DEG = 8; // up/down
const GAZE_SMOOTH_SPEED = 6; // exponential smoothing rate, higher = snappier

export class GazeController {
  private leftEye: THREE.Bone | null = null;
  private rightEye: THREE.Bone | null = null;
  private leftBaseQuaternion: THREE.Quaternion | null = null;
  private rightBaseQuaternion: THREE.Quaternion | null = null;
  private mode: "eyes" | "none" = "none";

  private targetX = 0; // normalized -1..1
  private targetY = 0;

  // Reused scratch objects — never allocated per frame.
  private scratchEuler = new THREE.Euler();
  private offsetQuaternion = new THREE.Quaternion();
  private scratchQuaternion = new THREE.Quaternion();

  constructor(root: THREE.Object3D) {
    root.traverse((node) => {
      if (!(node as THREE.Bone).isBone) return;
      if (!this.leftEye && EYE_BONE_L_PATTERN.test(node.name)) this.leftEye = node as THREE.Bone;
      if (!this.rightEye && EYE_BONE_R_PATTERN.test(node.name)) this.rightEye = node as THREE.Bone;
    });

    if (this.leftEye && this.rightEye) {
      this.mode = "eyes";
      this.leftBaseQuaternion = this.leftEye.quaternion.clone();
      this.rightBaseQuaternion = this.rightEye.quaternion.clone();
    }
  }

  setTarget(normalizedX: number, normalizedY: number) {
    this.targetX = THREE.MathUtils.clamp(normalizedX, -1, 1);
    this.targetY = THREE.MathUtils.clamp(normalizedY, -1, 1);
  }

  update(delta: number) {
    if (this.mode === "none" || !this.leftEye || !this.rightEye || !this.leftBaseQuaternion || !this.rightBaseQuaternion) {
      return;
    }

    const yawRad = THREE.MathUtils.degToRad(this.targetX * GAZE_MAX_YAW_DEG);
    const pitchRad = THREE.MathUtils.degToRad(-this.targetY * GAZE_MAX_PITCH_DEG);
    this.scratchEuler.set(pitchRad, yawRad, 0);
    this.offsetQuaternion.setFromEuler(this.scratchEuler);

    const t = THREE.MathUtils.clamp(delta * GAZE_SMOOTH_SPEED, 0, 1);

    this.scratchQuaternion.copy(this.leftBaseQuaternion).multiply(this.offsetQuaternion);
    this.leftEye.quaternion.slerp(this.scratchQuaternion, t);

    this.scratchQuaternion.copy(this.rightBaseQuaternion).multiply(this.offsetQuaternion);
    this.rightEye.quaternion.slerp(this.scratchQuaternion, t);
  }
}
