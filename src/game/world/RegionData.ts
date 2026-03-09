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
  // === IRONHOLD TO GREENMEADOW CORRIDOR ===
  { id: 'sp1', name: 'Crossroads Well', position: [-70, -55], type: 'crossroads' },
  { id: 'sp2', name: 'Broken Wagon', position: [-100, -80], type: 'wagon' },
  { id: 'sp3', name: 'Wayside Shrine', position: [-40, -30], type: 'shrine' },
  { id: 'sp21', name: 'First Milestone', position: [-25, -15], type: 'milestone' },
  { id: 'sp22', name: 'Second Milestone', position: [-80, -60], type: 'milestone' },
  { id: 'sp28', name: 'Road Lantern', position: [-35, -45], type: 'lantern_post' },
  { id: 'sp16', name: 'Roadside Inn', position: [-50, -90], type: 'inn' },
  { id: 'sp20', name: 'Trader Camp', position: [-130, -30], type: 'hunter_camp' },
  // New additions
  { id: 'sp40', name: 'Farm Shrine', position: [-120, -100], type: 'shrine' },
  { id: 'sp41', name: 'Third Milestone', position: [-140, -110], type: 'milestone' },
  { id: 'sp42', name: 'Roadside Cross', position: [-90, -70], type: 'roadside_cross' },
  
  // === IRONHOLD TO BLACKTHORN CORRIDOR ===
  { id: 'sp4', name: 'Stone Bridge', position: [90, -75], type: 'bridge' },
  { id: 'sp5', name: 'Hunter Camp', position: [130, -110], type: 'hunter_camp' },
  { id: 'sp6', name: 'Supply Depot', position: [60, -50], type: 'supply_depot' },
  { id: 'sp25', name: 'Frontier Cross', position: [140, -120], type: 'roadside_cross' },
  { id: 'sp29', name: 'Road Lantern', position: [45, -40], type: 'lantern_post' },
  { id: 'sp30', name: 'Blackthorn Milestone', position: [50, -90], type: 'milestone' },
  // New additions
  { id: 'sp43', name: 'Garrison Post', position: [100, -95], type: 'watchpost' },
  { id: 'sp44', name: 'Frontier Wagon', position: [160, -135], type: 'wagon' },
  { id: 'sp45', name: 'Border Shrine', position: [175, -140], type: 'shrine' },
  { id: 'sp46', name: 'Military Camp', position: [115, -80], type: 'hunter_camp' },
  { id: 'sp47', name: 'Eastern Bridge', position: [150, -100], type: 'bridge' },
  
  // === IRONHOLD TO RAVENWATCH CORRIDOR ===
  { id: 'sp7', name: 'Old Graveyard', position: [5, -100], type: 'graveyard' },
  { id: 'sp8', name: 'Ruined Farmhouse', position: [-15, -140], type: 'ruined_house' },
  { id: 'sp19', name: 'Hidden Shrine', position: [50, -170], type: 'shrine' },
  { id: 'sp27', name: 'Ravenwatch Gallows', position: [20, -180], type: 'gallows' },
  // New additions
  { id: 'sp48', name: 'Bandit Lookout', position: [-5, -160], type: 'watchpost' },
  { id: 'sp49', name: 'Abandoned Cart', position: [15, -130], type: 'wagon' },
  { id: 'sp50', name: 'Southern Milestone', position: [0, -80], type: 'milestone' },
  { id: 'sp51', name: 'Outlaw Camp', position: [35, -195], type: 'abandoned_camp' },
  { id: 'sp52', name: 'Danger Cross', position: [-10, -180], type: 'roadside_cross' },
  
  // === IRONHOLD TO ASHWOOD CORRIDOR ===
  { id: 'sp9', name: 'Forest Clearing', position: [-90, 65], type: 'clearing' },
  { id: 'sp10', name: 'Lone Watchtower', position: [-130, 95], type: 'watchtower' },
  { id: 'sp32', name: 'Forest Shrine', position: [-140, 110], type: 'shrine' },
  { id: 'sp33', name: 'Trail Marker', position: [-170, 60], type: 'milestone' },
  { id: 'sp34', name: 'Abandoned Campsite', position: [-100, 30], type: 'abandoned_camp' },
  // New additions
  { id: 'sp53', name: 'Woodcutter Camp', position: [-120, 70], type: 'hunter_camp' },
  { id: 'sp54', name: 'Forest Bridge', position: [-145, 85], type: 'bridge' },
  { id: 'sp55', name: 'Deep Woods Cross', position: [-165, 115], type: 'roadside_cross' },
  { id: 'sp56', name: 'Hermit Shrine', position: [-200, 100], type: 'shrine' },
  { id: 'sp57', name: 'Lost Wagon', position: [-110, 50], type: 'wagon' },
  
  // === IRONHOLD TO OLD VEYRA CORRIDOR ===
  { id: 'sp11', name: 'Burned Village', position: [100, 45], type: 'burned_village' },
  { id: 'sp12', name: 'Stone Circle', position: [150, 70], type: 'stone_circle' },
  { id: 'sp26', name: 'Roadside Camp', position: [95, 15], type: 'abandoned_camp' },
  // New additions
  { id: 'sp58', name: 'Ruins Approach', position: [130, 55], type: 'milestone' },
  { id: 'sp59', name: 'Ancient Cross', position: [170, 85], type: 'roadside_cross' },
  { id: 'sp60', name: 'Scavenger Camp', position: [140, 40], type: 'hunter_camp' },
  { id: 'sp61', name: 'Crumbling Bridge', position: [120, 65], type: 'bridge' },
  { id: 'sp62', name: 'Warning Post', position: [175, 75], type: 'watchpost' },
  
  // === BLACKTHORN TO OLD VEYRA ===
  { id: 'sp13', name: 'Watch Post', position: [190, -30], type: 'watchpost' },
  // New additions
  { id: 'sp63', name: 'Frontier Bridge', position: [195, 20], type: 'bridge' },
  { id: 'sp64', name: 'Military Shrine', position: [200, -60], type: 'shrine' },
  { id: 'sp65', name: 'Supply Cache', position: [180, 50], type: 'supply_depot' },
  
  // === FROSTMERE HEIGHTS ===
  { id: 'sp14', name: 'Mountain Pond', position: [140, 160], type: 'pond' },
  { id: 'sp15', name: 'Hermit Cave', position: [175, 175], type: 'cave' },
  { id: 'sp31', name: 'Mountain Cross', position: [155, 160], type: 'roadside_cross' },
  // New additions
  { id: 'sp66', name: 'Highland Shrine', position: [130, 200], type: 'shrine' },
  { id: 'sp67', name: 'Mountain Watch', position: [180, 220], type: 'watchtower' },
  { id: 'sp68', name: 'Pilgrim Camp', position: [145, 180], type: 'hunter_camp' },
  { id: 'sp69', name: 'Stone Altar', position: [190, 200], type: 'stone_circle' },
  { id: 'sp70', name: 'Frost Bridge', position: [165, 190], type: 'bridge' },
  
  // === OLD VEYRA TO FROSTMERE ===
  { id: 'sp71', name: 'Ancient Path Marker', position: [175, 130], type: 'milestone' },
  { id: 'sp72', name: 'Veyra Outpost', position: [210, 120], type: 'watchpost' },
  { id: 'sp73', name: 'Ruined Shrine', position: [185, 145], type: 'shrine' },
  
  // === ASHWOOD DEEP ===
  { id: 'sp17', name: 'Abandoned Mine', position: [80, 140], type: 'cave' },
  { id: 'sp18', name: 'Signal Tower', position: [-60, 170], type: 'watchtower' },
  // New additions
  { id: 'sp74', name: 'Deep Forest Shrine', position: [-210, 160], type: 'shrine' },
  { id: 'sp75', name: 'Wolf Den', position: [-180, 180], type: 'cave' },
  { id: 'sp76', name: 'Ancient Oak Clearing', position: [-195, 130], type: 'clearing' },
  { id: 'sp77', name: 'Forest Graveyard', position: [-220, 120], type: 'graveyard' },
  { id: 'sp78', name: 'Hunter Lodge', position: [-170, 155], type: 'hunter_camp' },
  
  // === GREENMEADOW REGION ===
  { id: 'sp79', name: 'Farm Graveyard', position: [-180, -140], type: 'graveyard' },
  { id: 'sp80', name: 'Shepherd Hut', position: [-140, -150], type: 'ruined_house' },
  { id: 'sp81', name: 'Field Shrine', position: [-170, -110], type: 'shrine' },
  { id: 'sp82', name: 'Mill Pond', position: [-120, -95], type: 'pond' },
  
  // === GATE APPROACH ===
  { id: 'sp23', name: 'Gate Lantern', position: [3, 50], type: 'lantern_post' },
  { id: 'sp24', name: 'Gate Lantern', position: [-3, 50], type: 'lantern_post' },
  
  // === NW WILDERNESS (previously empty) ===
  { id: 'sp83', name: 'Northern Watch', position: [-230, 200], type: 'watchtower' },
  { id: 'sp84', name: 'Frontier Shrine', position: [-250, 160], type: 'shrine' },
  { id: 'sp85', name: 'Lost Caravan', position: [-240, 100], type: 'wagon' },
  { id: 'sp86', name: 'Wilderness Camp', position: [-260, 140], type: 'abandoned_camp' },
  { id: 'sp87', name: 'Border Stone', position: [-270, 80], type: 'milestone' },
  
  // === NE WILDERNESS (previously empty) ===
  { id: 'sp88', name: 'Mountain Shrine', position: [100, 240], type: 'shrine' },
  { id: 'sp89', name: 'Highland Camp', position: [140, 260], type: 'hunter_camp' },
  { id: 'sp90', name: 'Northern Watchtower', position: [60, 220], type: 'watchtower' },
  { id: 'sp91', name: 'Frozen Bridge', position: [120, 200], type: 'bridge' },
  
  // === SW WILDERNESS (previously empty) ===
  { id: 'sp92', name: 'Southern Watch', position: [-200, -200], type: 'watchpost' },
  { id: 'sp93', name: 'Wilderness Shrine', position: [-230, -160], type: 'shrine' },
  { id: 'sp94', name: 'Abandoned Homestead', position: [-180, -180], type: 'ruined_house' },
  { id: 'sp95', name: 'Bandit Bridge', position: [-100, -160], type: 'bridge' },
  { id: 'sp96', name: 'Southern Graveyard', position: [-150, -220], type: 'graveyard' },
  
  // === SE WILDERNESS (previously empty) ===
  { id: 'sp97', name: 'Eastern Outpost', position: [240, -180], type: 'watchpost' },
  { id: 'sp98', name: 'Frontier Shrine', position: [260, -140], type: 'shrine' },
  { id: 'sp99', name: 'Desert Camp', position: [220, -220], type: 'abandoned_camp' },
  { id: 'sp100', name: 'Border Watch', position: [270, -100], type: 'watchtower' },
  
  // === MAP BORDER DETAILS ===
  // North border
  { id: 'sp101', name: 'Northern Cross', position: [0, 270], type: 'roadside_cross' },
  { id: 'sp102', name: 'Edge Shrine', position: [-80, 260], type: 'shrine' },
  { id: 'sp103', name: 'Frontier Tower', position: [80, 280], type: 'watchpost' },
  // South border
  { id: 'sp104', name: 'Southern Cross', position: [0, -270], type: 'roadside_cross' },
  { id: 'sp105', name: 'Border Cave', position: [60, -260], type: 'cave' },
  { id: 'sp106', name: 'Forgotten Graveyard', position: [-60, -280], type: 'graveyard' },
  // East border
  { id: 'sp107', name: 'Eastern Shrine', position: [280, 0], type: 'shrine' },
  { id: 'sp108', name: 'Cliff Watch', position: [270, 60], type: 'watchpost' },
  { id: 'sp109', name: 'Ruins Outskirts', position: [260, -60], type: 'ruined_house' },
  // West border
  { id: 'sp110', name: 'Western Shrine', position: [-280, 0], type: 'shrine' },
  { id: 'sp111', name: 'Forest Edge Camp', position: [-270, 60], type: 'hunter_camp' },
  { id: 'sp112', name: 'Border Ruins', position: [-260, -80], type: 'ruined_house' },
  
  // === CENTRAL REGION FILL ===
  { id: 'sp113', name: 'Trade Crossroads', position: [30, 30], type: 'crossroads' },
  { id: 'sp114', name: 'Central Pond', position: [-40, 80], type: 'pond' },
  { id: 'sp115', name: 'Heartland Shrine', position: [50, 60], type: 'shrine' },
  { id: 'sp116', name: 'Capital Approach', position: [20, 40], type: 'lantern_post' },
  { id: 'sp117', name: 'Capital Approach', position: [-20, 40], type: 'lantern_post' },
  
  // === RAVENWATCH BADLANDS ===
  { id: 'sp118', name: 'Badland Cave', position: [-30, -210], type: 'cave' },
  { id: 'sp119', name: 'Outlaw Graveyard', position: [40, -230], type: 'graveyard' },
  { id: 'sp120', name: 'Bandit Shrine', position: [-20, -240], type: 'shrine' },
  
  // === ASHWOOD TO FROSTMERE TRAIL ===
  { id: 'sp121', name: 'Mountain Trail Start', position: [-100, 160], type: 'milestone' },
  { id: 'sp122', name: 'Trail Bridge', position: [-40, 180], type: 'bridge' },
  { id: 'sp123', name: 'Highland Shrine', position: [20, 200], type: 'shrine' },
  { id: 'sp124', name: 'Mountain Camp', position: [60, 180], type: 'hunter_camp' },
  
  // === GREENMEADOW TO RAVENWATCH ===
  { id: 'sp125', name: 'Southern Trail Marker', position: [-100, -180], type: 'milestone' },
  { id: 'sp126', name: 'Marshland Bridge', position: [-60, -200], type: 'bridge' },
  { id: 'sp127', name: 'Warning Post', position: [-30, -190], type: 'watchpost' },
  
  // === ASHWOOD TO GREENMEADOW ===
  { id: 'sp128', name: 'Western Trail', position: [-175, 20], type: 'milestone' },
  { id: 'sp129', name: 'Forest Edge Camp', position: [-190, -30], type: 'hunter_camp' },
  { id: 'sp130', name: 'Woodland Shrine', position: [-200, -80], type: 'shrine' },
  { id: 'sp131', name: 'Western Bridge', position: [-170, -50], type: 'bridge' },
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
