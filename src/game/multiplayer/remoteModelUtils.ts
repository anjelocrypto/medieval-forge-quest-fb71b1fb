import * as THREE from 'three';
import { clone as cloneSkinnedScene } from 'three/examples/jsm/utils/SkeletonUtils.js';

const ROOT_TRANSLATION_NAME_RE = /(hips|pelvis|root|armature)/i;
const BONE_HIPS_RE = /(hips|pelvis)/i;
const BONE_HEAD_RE = /(head|neck)/i;
const BONE_LEFT_RE = /(leftshoulder|left_shoulder|shoulder_l|leftarm|left_arm)/i;
const BONE_RIGHT_RE = /(rightshoulder|right_shoulder|shoulder_r|rightarm|right_arm)/i;

const _tmpVecA = new THREE.Vector3();
const _tmpVecB = new THREE.Vector3();
const _tmpVecC = new THREE.Vector3();
const _tmpVecD = new THREE.Vector3();
const _tmpUp = new THREE.Vector3();
const _tmpRight = new THREE.Vector3();
const _tmpForward = new THREE.Vector3();
const _tmpForwardAlt = new THREE.Vector3();
const _tmpCenter = new THREE.Vector3();
const _tmpSize = new THREE.Vector3();

export interface ModelNormalization {
  modelAnchorOffset: [number, number, number];
  scale: number;
  yawCorrection: number;
}

interface ModelInspection {
  anchor: THREE.Vector3;
  footY: number;
  height: number;
  facingYaw: number | null;
}

export function sanitizeClips(animations: THREE.AnimationClip[]): THREE.AnimationClip[] {
  return animations.map((clip) => {
    const clonedClip = clip.clone();
    clonedClip.tracks = clonedClip.tracks.filter((track) => {
      if (!track.name.endsWith('.position')) return true;
      const target = track.name.slice(0, track.name.lastIndexOf('.'));
      return !ROOT_TRANSLATION_NAME_RE.test(target);
    });
    return clonedClip;
  });
}

function normalizeMaterial(mat: THREE.Material): THREE.Material {
  const cloned = mat.clone();

  if (cloned instanceof THREE.MeshStandardMaterial || cloned instanceof THREE.MeshPhysicalMaterial) {
    cloned.emissive.set(0x000000);
    cloned.emissiveIntensity = 0;
    if (cloned.metalness > 0.3) cloned.metalness = 0.1;
    if (cloned.roughness < 0.3) cloned.roughness = 0.5;
    cloned.transparent = false;
    cloned.opacity = 1;
    cloned.depthWrite = true;
    cloned.side = THREE.FrontSide;
  }

  return cloned;
}

export function cloneScene(scene: THREE.Group): THREE.Group {
  // Use SkeletonUtils.clone for skinned meshes; manual name-based rebinding can corrupt rigs
  const cloned = cloneSkinnedScene(scene) as THREE.Group;

  cloned.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(normalizeMaterial);
    } else {
      mesh.material = normalizeMaterial(mesh.material);
    }

    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
      const skinned = mesh as THREE.SkinnedMesh;
      skinned.frustumCulled = true;
      skinned.bindMode = THREE.AttachedBindMode;
      skinned.pose();
      skinned.skeleton?.calculateInverses();
    }
  });

  cloned.updateMatrixWorld(true);
  return cloned;
}

export function enableMeshShadows(scene: THREE.Object3D) {
  scene.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });
}

function inspectModel(scene: THREE.Object3D): ModelInspection {
  scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(scene);
  const size = bounds.getSize(_tmpSize.clone());
  const center = bounds.getCenter(_tmpCenter.clone());

  const skinnedMeshes: THREE.SkinnedMesh[] = [];
  scene.traverse((child) => {
    if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
      skinnedMeshes.push(child as THREE.SkinnedMesh);
    }
  });

  const primarySkinnedMesh = skinnedMeshes[0] ?? null;
  const skeleton = primarySkinnedMesh?.skeleton ?? null;
  const hipsBone = skeleton?.bones.find((bone) => BONE_HIPS_RE.test(bone.name)) ?? skeleton?.bones[0] ?? null;
  const facingYaw = inferFacingYawFromSkeleton(skeleton);

  let anchorX = center.x;
  let anchorZ = center.z;

  if (hipsBone) {
    hipsBone.getWorldPosition(_tmpVecA);
    anchorX = _tmpVecA.x;
    anchorZ = _tmpVecA.z;
  }

  return {
    anchor: new THREE.Vector3(anchorX, 0, anchorZ),
    footY: bounds.min.y,
    height: size.y,
    facingYaw,
  };
}

function inferFacingYawFromSkeleton(skeleton: THREE.Skeleton | null): number | null {
  if (!skeleton || skeleton.bones.length === 0) return null;

  const hips = skeleton.bones.find((b) => BONE_HIPS_RE.test(b.name)) ?? null;
  const head = skeleton.bones.find((b) => BONE_HEAD_RE.test(b.name)) ?? null;
  const left = skeleton.bones.find((b) => BONE_LEFT_RE.test(b.name)) ?? null;
  const right = skeleton.bones.find((b) => BONE_RIGHT_RE.test(b.name)) ?? null;
  if (!hips || !head || !left || !right) return null;

  hips.getWorldPosition(_tmpVecA);
  head.getWorldPosition(_tmpVecB);
  left.getWorldPosition(_tmpVecC);
  right.getWorldPosition(_tmpVecD);

  _tmpUp.subVectors(_tmpVecB, _tmpVecA).normalize();
  _tmpRight.subVectors(_tmpVecD, _tmpVecC).normalize();
  _tmpForward.crossVectors(_tmpRight, _tmpUp).normalize();
  _tmpForwardAlt.crossVectors(_tmpUp, _tmpRight).normalize();

  if (_tmpForward.lengthSq() < 1e-6 || _tmpForwardAlt.lengthSq() < 1e-6) return null;

  const yawA = normalizeAngle(Math.atan2(_tmpForward.x, _tmpForward.z));
  const yawB = normalizeAngle(Math.atan2(_tmpForwardAlt.x, _tmpForwardAlt.z));
  return Math.abs(yawA) <= Math.abs(yawB) ? yawA : yawB;
}

function normalizeAngle(v: number): number {
  let out = v;
  while (out > Math.PI) out -= Math.PI * 2;
  while (out < -Math.PI) out += Math.PI * 2;
  return out;
}

function sanitizeScale(rawScale: number, fallbackScale?: number): number {
  const reference = Number.isFinite(fallbackScale) && (fallbackScale ?? 0) > 0
    ? (fallbackScale as number)
    : 1;
  const finiteRaw = Number.isFinite(rawScale) && rawScale > 0 ? rawScale : reference;
  const min = Math.max(0.05, reference * 0.35);
  const max = Math.min(4, reference * 2.5);
  return THREE.MathUtils.clamp(finiteRaw, min, max);
}

export function buildModelNormalization(
  scene: THREE.Object3D,
  targetHeight: number,
  fallbackYawCorrection = 0,
  fallbackScale?: number,
): ModelNormalization {
  const inspection = inspectModel(scene);
  const rawScale = inspection.height > 0.01 ? targetHeight / inspection.height : (fallbackScale ?? 1);
  const scale = sanitizeScale(rawScale, fallbackScale);
  const yawCorrection = inspection.facingYaw !== null ? -inspection.facingYaw : fallbackYawCorrection;

  return {
    modelAnchorOffset: [-inspection.anchor.x, -inspection.footY, -inspection.anchor.z],
    scale,
    yawCorrection,
  };
}
