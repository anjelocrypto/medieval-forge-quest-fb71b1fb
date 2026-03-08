/**
 * World Region & Settlement Data
 * Central data source for the entire open world.
 * All positions, gameplay metadata, and POI definitions.
 */

export interface RegionDef {
  id: string;
  name: string;
  center: [number, number]; // [x, z]
  radius: number;
  danger: number; // 0-3
  tempMod: number;
  resourceBonus: number;
  resourceFocus: 'wood' | 'stone' | 'food' | 'mixed';
  description: string;
  color: string; // map color
  enemyTypes: ('bandit' | 'wolf')[];
  enemyCount: number;
  enemySpread: number;
}

export interface SettlementDef {
  id: string;
  name: string;
  regionId: string;
  position: [number, number]; // [x, z]
  type: 'capital' | 'village' | 'fort' | 'ruins' | 'bandit_camp' | 'outpost' | 'monastery';
  size: 'large' | 'medium' | 'small';
  description: string;
}

export interface SmallPOIDef {
  id: string;
  name: string;
  position: [number, number];
  type: 'shrine' | 'wagon' | 'bridge' | 'graveyard' | 'hunter_camp' | 'ruined_house'
    | 'watchtower' | 'cave' | 'watchpost' | 'inn' | 'clearing' | 'stone_circle'
    | 'pond' | 'burned_village' | 'supply_depot' | 'crossroads'
    | 'milestone' | 'lantern_post' | 'roadside_cross' | 'abandoned_camp' | 'gallows';
}

export interface RoadSegment {
  from: [number, number];
  to: [number, number];
  width: number; // road width factor
}

// ========== REGIONS ==========
export const REGIONS: RegionDef[] = [
  {
    id: 'heartland', name: 'Kingdom Heartland',
    center: [0, 0], radius: 80,
    danger: 0, tempMod: 0.1, resourceBonus: 1.0, resourceFocus: 'mixed',
    description: 'The safe civilized center of the realm',
    color: '#6a8a4a', enemyTypes: [], enemyCount: 0, enemySpread: 0,
  },
  {
    id: 'greenmeadow', name: 'Greenmeadow Fields',
    center: [-160, -130], radius: 70,
    danger: 0, tempMod: 0.15, resourceBonus: 1.2, resourceFocus: 'food',
    description: 'Peaceful farmland with abundant food',
    color: '#7a9a5a', enemyTypes: ['wolf'], enemyCount: 2, enemySpread: 30,
  },
  {
    id: 'blackthorn', name: 'Blackthorn Frontier',
    center: [190, -160], radius: 60,
    danger: 2, tempMod: -0.1, resourceBonus: 1.3, resourceFocus: 'stone',
    description: 'Military frontier between safe and hostile lands',
    color: '#7a6a4a', enemyTypes: ['bandit'], enemyCount: 5, enemySpread: 25,
  },
  {
    id: 'old_veyra', name: 'Old Veyra',
    center: [200, 100], radius: 70,
    danger: 3, tempMod: -0.4, resourceBonus: 2.0, resourceFocus: 'stone',
    description: 'Ancient fallen civilization, high risk high reward',
    color: '#6a5a4a', enemyTypes: ['bandit', 'wolf'], enemyCount: 6, enemySpread: 30,
  },
  {
    id: 'ravenwatch', name: 'Ravenwatch Badlands',
    center: [10, -210], radius: 60,
    danger: 2, tempMod: 0, resourceBonus: 1.5, resourceFocus: 'mixed',
    description: 'Lawless bandit territory',
    color: '#5a4a3a', enemyTypes: ['bandit'], enemyCount: 7, enemySpread: 25,
  },
  {
    id: 'ashwood', name: 'Ashwood Deep',
    center: [-190, 140], radius: 75,
    danger: 2, tempMod: -0.25, resourceBonus: 1.5, resourceFocus: 'wood',
    description: 'Dense dangerous forest, rich in timber',
    color: '#2a4a1a', enemyTypes: ['wolf'], enemyCount: 6, enemySpread: 35,
  },
  {
    id: 'frostmere', name: 'Frostmere Heights',
    center: [160, 200], radius: 65,
    danger: 1, tempMod: -0.5, resourceBonus: 1.4, resourceFocus: 'stone',
    description: 'Cold highlands with vistas and rare stone',
    color: '#8a8a9a', enemyTypes: ['wolf', 'bandit'], enemyCount: 4, enemySpread: 30,
  },
];

// ========== SETTLEMENTS ==========
export const SETTLEMENTS: SettlementDef[] = [
  // Capital
  {
    id: 'ironhold', name: 'Ironhold', regionId: 'heartland',
    position: [0, 0], type: 'capital', size: 'large',
    description: 'The fortified capital of the realm',
  },
  // Farming village
  {
    id: 'greenmeadow_village', name: 'Greenmeadow', regionId: 'greenmeadow',
    position: [-155, -125], type: 'village', size: 'medium',
    description: 'A peaceful farming settlement',
  },
  // Military fort
  {
    id: 'blackthorn_fort', name: 'Blackthorn Fort', regionId: 'blackthorn',
    position: [185, -155], type: 'fort', size: 'medium',
    description: 'Frontier military outpost',
  },
  // Ruined city
  {
    id: 'old_veyra_ruins', name: 'Old Veyra', regionId: 'old_veyra',
    position: [195, 95], type: 'ruins', size: 'large',
    description: 'Once-great city now in ruins',
  },
  // Bandit camp
  {
    id: 'ravenwatch_camp', name: 'Ravenwatch', regionId: 'ravenwatch',
    position: [5, -205], type: 'bandit_camp', size: 'medium',
    description: 'Lawless outlaw settlement',
  },
  // Forest outpost
  {
    id: 'ashwood_shrine', name: "Saint's Crossing", regionId: 'ashwood',
    position: [-185, 135], type: 'outpost', size: 'small',
    description: 'A small forest waystation',
  },
  // Mountain monastery
  {
    id: 'frostmere_monastery', name: 'Frostmere Keep', regionId: 'frostmere',
    position: [155, 195], type: 'monastery', size: 'small',
    description: 'Highland stone monastery',
  },
  // Extra small settlements
  {
    id: 'ashen_hollow', name: 'Ashen Hollow', regionId: 'old_veyra',
    position: [160, 50], type: 'outpost', size: 'small',
    description: 'A scavenger camp near the ruins',
  },
  {
    id: 'millbrook', name: 'Millbrook', regionId: 'greenmeadow',
    position: [-110, -80], type: 'village', size: 'small',
    description: 'Small hamlet with a grain mill',
  },
];

// ========== ROAD NETWORK ==========
export const ROADS: RoadSegment[] = [
  // Main roads from Ironhold
  { from: [0, 38], to: [0, 55], width: 4.0 },             // Capital gate approach
  { from: [0, 55], to: [-155, -125], width: 3.5 },         // Ironhold → Greenmeadow
  { from: [0, 55], to: [185, -135], width: 3.0 },          // Ironhold → Blackthorn (via south gate)
  { from: [185, -135], to: [185, -155], width: 3.0 },      // approach fort gate
  { from: [0, 55], to: [5, -205], width: 2.5 },            // Ironhold → Ravenwatch
  { from: [0, 55], to: [-185, 135], width: 2.5 },          // Ironhold → Ashwood
  { from: [0, 55], to: [195, 95], width: 2.5 },            // Ironhold → Old Veyra
  // Secondary roads
  { from: [185, -155], to: [195, 95], width: 2.0 },        // Blackthorn → Old Veyra
  { from: [195, 95], to: [155, 209], width: 2.0 },         // Old Veyra → Frostmere (approach monastery gate)
  { from: [-155, -125], to: [-110, -80], width: 2.0 },     // Greenmeadow → Millbrook
  { from: [-110, -80], to: [0, 55], width: 2.0 },          // Millbrook → Ironhold
  { from: [5, -205], to: [185, -155], width: 1.8 },        // Ravenwatch → Blackthorn
  { from: [-185, 135], to: [155, 195], width: 1.5 },       // Ashwood → Frostmere (mountain trail)
  { from: [160, 50], to: [195, 95], width: 1.5 },          // Ashen Hollow → Old Veyra
  // Ring road segments
  { from: [-155, -125], to: [5, -205], width: 1.5 },       // Greenmeadow → Ravenwatch
  { from: [-185, 135], to: [-155, -125], width: 1.5 },     // Ashwood → Greenmeadow (long trail)
];

// ========== SMALL POIS ==========
export const SMALL_POIS: SmallPOIDef[] = [
  // Between Ironhold and Greenmeadow
  { id: 'sp1', name: 'Crossroads Well', position: [-70, -55], type: 'crossroads' },
  { id: 'sp2', name: 'Broken Wagon', position: [-100, -80], type: 'wagon' },
  { id: 'sp3', name: 'Wayside Shrine', position: [-40, -30], type: 'shrine' },
  // Between Ironhold and Blackthorn
  { id: 'sp4', name: 'Stone Bridge', position: [90, -75], type: 'bridge' },
  { id: 'sp5', name: 'Hunter Camp', position: [130, -110], type: 'hunter_camp' },
  { id: 'sp6', name: 'Supply Depot', position: [60, -50], type: 'supply_depot' },
  // Between Ironhold and Ravenwatch
  { id: 'sp7', name: 'Old Graveyard', position: [5, -100], type: 'graveyard' },
  { id: 'sp8', name: 'Ruined Farmhouse', position: [-15, -140], type: 'ruined_house' },
  // Between Ironhold and Ashwood
  { id: 'sp9', name: 'Forest Clearing', position: [-90, 65], type: 'clearing' },
  { id: 'sp10', name: 'Lone Watchtower', position: [-130, 95], type: 'watchtower' },
  // Between Ironhold and Old Veyra
  { id: 'sp11', name: 'Burned Village', position: [100, 45], type: 'burned_village' },
  { id: 'sp12', name: 'Stone Circle', position: [150, 70], type: 'stone_circle' },
  // Between Blackthorn and Old Veyra
  { id: 'sp13', name: 'Watch Post', position: [190, -30], type: 'watchpost' },
  // Near Frostmere
  { id: 'sp14', name: 'Mountain Pond', position: [140, 160], type: 'pond' },
  { id: 'sp15', name: 'Hermit Cave', position: [175, 175], type: 'cave' },
  // Scattered
  { id: 'sp16', name: 'Roadside Inn', position: [-50, -90], type: 'inn' },
  { id: 'sp17', name: 'Abandoned Mine', position: [80, 140], type: 'cave' },
  { id: 'sp18', name: 'Signal Tower', position: [-60, 170], type: 'watchtower' },
  { id: 'sp19', name: 'Hidden Shrine', position: [50, -170], type: 'shrine' },
  { id: 'sp20', name: 'Trader Camp', position: [-130, -30], type: 'hunter_camp' },
  // Road milestones and atmosphere
  { id: 'sp21', name: 'First Milestone', position: [-25, -15], type: 'milestone' },
  { id: 'sp22', name: 'Second Milestone', position: [-80, -60], type: 'milestone' },
  { id: 'sp23', name: 'Gate Lantern', position: [3, 50], type: 'lantern_post' },
  { id: 'sp24', name: 'Gate Lantern', position: [-3, 50], type: 'lantern_post' },
  { id: 'sp25', name: 'Frontier Cross', position: [140, -120], type: 'roadside_cross' },
  { id: 'sp26', name: 'Roadside Camp', position: [95, 15], type: 'abandoned_camp' },
  { id: 'sp27', name: 'Ravenwatch Gallows', position: [20, -180], type: 'gallows' },
  { id: 'sp28', name: 'Road Lantern', position: [-35, -45], type: 'lantern_post' },
  { id: 'sp29', name: 'Road Lantern', position: [45, -40], type: 'lantern_post' },
  { id: 'sp30', name: 'Third Milestone', position: [50, -90], type: 'milestone' },
  { id: 'sp31', name: 'Mountain Cross', position: [155, 160], type: 'roadside_cross' },
  { id: 'sp32', name: 'Forest Shrine', position: [-140, 110], type: 'shrine' },
  { id: 'sp33', name: 'Trail Marker', position: [-170, 60], type: 'milestone' },
  { id: 'sp34', name: 'Abandoned Campsite', position: [-100, 30], type: 'abandoned_camp' },
];

// ========== LANDMARK DEFINITIONS ==========
export interface LandmarkDef {
  id: string;
  name: string;
  position: [number, number];
  type: 'great_tower' | 'windmill' | 'cathedral' | 'giant_tree' | 'ruins_arch' | 'beacon';
  height: number; // how tall for visibility
}

export const LANDMARKS: LandmarkDef[] = [
  { id: 'lm1', name: 'Ironhold Tower', position: [0, 0], type: 'great_tower', height: 30 },
  { id: 'lm2', name: 'Greenmeadow Mill', position: [-145, -115], type: 'windmill', height: 18 },
  { id: 'lm3', name: 'Blackthorn Beacon', position: [185, -160], type: 'beacon', height: 22 },
  { id: 'lm4', name: 'Veyra Grand Arch', position: [195, 95], type: 'ruins_arch', height: 25 },
  { id: 'lm5', name: 'Ancient Oak', position: [-190, 145], type: 'giant_tree', height: 28 },
  { id: 'lm6', name: 'Frostmere Spire', position: [155, 200], type: 'cathedral', height: 24 },
];

// Utility: get region at world position
export function getRegionAt(x: number, z: number): RegionDef | null {
  let best: RegionDef | null = null;
  let bestDist = Infinity;
  for (const r of REGIONS) {
    const dx = x - r.center[0];
    const dz = z - r.center[1];
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < r.radius && dist < bestDist) {
      best = r;
      bestDist = dist;
    }
  }
  return best;
}

// Build POIS object compatible with existing constants format
export function buildPOISCompat(): Record<string, { x: number; z: number; label: string; danger: number; tempMod: number; resourceBonus: number }> {
  const result: Record<string, any> = {};
  for (const s of SETTLEMENTS) {
    const region = REGIONS.find(r => r.id === s.regionId);
    result[s.id] = {
      x: s.position[0],
      z: s.position[1],
      label: s.name,
      danger: region?.danger ?? 0,
      tempMod: region?.tempMod ?? 0,
      resourceBonus: region?.resourceBonus ?? 1,
    };
  }
  return result;
}
