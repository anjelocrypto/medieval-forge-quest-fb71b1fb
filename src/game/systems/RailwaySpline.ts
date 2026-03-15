/**
 * RailwaySpline — shared spline utilities for track rendering and train movement.
 * Builds a Catmull-Rom spline from waypoints, sampling terrain height at each point.
 */
import * as THREE from 'three';
import { RailwayWaypoint } from '../world/RailwayData';
import { getTerrainHeight } from '../components/Terrain';

const RAIL_HEIGHT_OFFSET = 0.35; // rails sit slightly above ground

export interface SplinePoint {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
}

/**
 * Build a smooth 3D path from waypoints using Catmull-Rom interpolation.
 * Returns evenly-spaced points along the path.
 */
export function buildRailwaySpline(
  waypoints: RailwayWaypoint[],
  pointsPerSegment: number = 12,
): THREE.Vector3[] {
  // Create 3D control points from 2D waypoints + terrain height
  const controls: THREE.Vector3[] = waypoints.map(wp => {
    const y = getTerrainHeight(wp.x, wp.z) + RAIL_HEIGHT_OFFSET;
    return new THREE.Vector3(wp.x, y, wp.z);
  });

  const curve = new THREE.CatmullRomCurve3(controls, false, 'centripetal', 0.5);
  const totalPoints = (waypoints.length - 1) * pointsPerSegment;
  return curve.getSpacedPoints(totalPoints);
}

/**
 * Get total arc length of a spline path.
 */
export function getSplineLength(points: THREE.Vector3[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += points[i].distanceTo(points[i - 1]);
  }
  return len;
}

/**
 * Sample position and forward direction at a given distance along the path.
 */
export function sampleSplineAtDistance(
  points: THREE.Vector3[],
  totalLength: number,
  distance: number,
): SplinePoint {
  const d = ((distance % totalLength) + totalLength) % totalLength;
  let accumulated = 0;
  for (let i = 1; i < points.length; i++) {
    const segLen = points[i].distanceTo(points[i - 1]);
    if (accumulated + segLen >= d) {
      const t = (d - accumulated) / segLen;
      const position = new THREE.Vector3().lerpVectors(points[i - 1], points[i], t);
      const tangent = new THREE.Vector3().subVectors(points[i], points[i - 1]).normalize();
      return { position, tangent };
    }
    accumulated += segLen;
  }
  // Fallback to last point
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  return {
    position: last.clone(),
    tangent: new THREE.Vector3().subVectors(last, prev).normalize(),
  };
}

/**
 * Find the index of the nearest spline point to a given station position.
 */
export function findNearestPointIndex(
  points: THREE.Vector3[],
  stationX: number,
  stationZ: number,
): number {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < points.length; i++) {
    const dx = points[i].x - stationX;
    const dz = points[i].z - stationZ;
    const d = dx * dx + dz * dz;
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Convert point index to arc-length distance along the path.
 */
export function pointIndexToDistance(points: THREE.Vector3[], index: number): number {
  let d = 0;
  for (let i = 1; i <= Math.min(index, points.length - 1); i++) {
    d += points[i].distanceTo(points[i - 1]);
  }
  return d;
}
