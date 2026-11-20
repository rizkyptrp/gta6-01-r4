// NEON DUSK — Sable City. Shared constants: the city grid, districts, cars,
// story missions and tuning. Everything else reads from here so the city
// stays consistent between the 3D world, the minimap and the missions.

export const CITY = {
  // The playable ground is a square of side 2 * HALF, in metres.
  HALF: 220,
  // Roads run on a grid every BLOCK metres; avenues are the wide ones.
  BLOCK: 44,
  ROAD_W: 9,
  AVENUE_W: 13,
};

// Districts by quadrant, used for building colours, names and the minimap.
export const DISTRICTS = [
  { name: 'HARBOUR', x: -1, z: -1, tint: 0x2e4a6b, desc: 'docks & warehouses' },
  { name: 'DOWNTOWN', x: 1, z: -1, tint: 0x4a2e5e, desc: 'towers & neon' },
  { name: 'PALM ROW', x: -1, z: 1, tint: 0x2e5e43, desc: 'palms & motels' },
  { name: 'OLD TOWN', x: 1, z: 1, tint: 0x5e4a2e, desc: 'brick & market' },
];

// Cars the player can steal and the traffic can drive.
export const CAR_MODELS = [
  { name: 'Comet GT', color: 0xff2e63, top: 42, accel: 26, grip: 0.92, len: 4.6 },
  { name: 'Vulture Sedan', color: 0x2e86ff, top: 34, accel: 20, grip: 0.86, len: 4.4 },
  { name: 'Harbour Taxi', color: 0xffc93e, top: 32, accel: 19, grip: 0.84, len: 4.4 },
  { name: 'Palm Cruiser', color: 0x39d5a0, top: 30, accel: 17, grip: 0.88, len: 4.8 },
  { name: 'Rust Bucket', color: 0x9a7b4f, top: 26, accel: 14, grip: 0.78, len: 4.2 },
  { name: 'Neon Coupe', color: 0xc93eff, top: 40, accel: 24, grip: 0.9, len: 4.5 },
];

// The story: five jobs for Kai Mercer. Each mission names a target spot
// (a plaza, a garage, a rooftop drop), a mechanic, and a payout.
export const MISSIONS = [
  {
    id: 1, title: 'HOT WHEELS', payout: 500,
    brief: 'Steal the Comet GT parked outside the Downtown showroom and bring it to the Palm Row garage.',
    steps: [
      { kind: 'steal', text: 'Steal the Comet GT at the Downtown showroom (follow the pink marker).' },
      { kind: 'deliver', text: 'Drive the Comet GT to the Palm Row garage (gold marker).' },
    ],
    target: { x: 132, z: -132 }, garage: { x: -132, z: 132 },
  },
  {
    id: 2, title: 'THE DROP', payout: 800,
    brief: 'Pick up the package at the Harbour docks and deliver it to Old Town market before the cops notice.',
    steps: [
      { kind: 'goto', text: 'Reach the package at the Harbour docks (pink marker).' },
      { kind: 'deliver', text: 'Deliver the package to Old Town market (gold marker).' },
    ],
    target: { x: -176, z: -176 }, garage: { x: 176, z: 176 },
  },
  {
    id: 3, title: 'HEAT WAVE', payout: 1200,
    brief: 'The Vultures set you up. Lose a 3-star wanted level, then reach the safehouse on Palm Row.',
    steps: [
      { kind: 'wanted', text: 'You are at 3 stars. Shake the police — stay out of sight until the heat drops.' },
      { kind: 'deliver', text: 'Reach the Palm Row safehouse (gold marker).' },
    ],
    target: { x: 0, z: 0 }, garage: { x: -176, z: 132 },
  },
  {
    id: 4, title: 'PAYBACK', payout: 2000,
    brief: 'Raid the Vulture Crew stash house in Old Town. Take out the guards, grab the cash, get out.',
    steps: [
      { kind: 'combat', text: 'Take down 4 Vulture guards at the Old Town stash house.' },
      { kind: 'deliver', text: 'Grab the stash and escape to the Harbour (gold marker).' },
    ],
    target: { x: 176, z: 132 }, garage: { x: -176, z: -176 },
  },
  {
    id: 5, title: 'THE BIG SCORE', payout: 5000,
    brief: 'One last job: lift the vault car from the Downtown tower garage, outrun a 4-star response, and vanish.',
    steps: [
      { kind: 'steal', text: 'Steal the vault car from the Downtown tower garage (pink marker).' },
      { kind: 'chase', text: 'Outrun the police — survive 45 seconds at 4 stars.' },
      { kind: 'deliver', text: 'Deliver the vault car to the Palm Row garage (gold marker).' },
    ],
    target: { x: 132, z: -176 }, garage: { x: -132, z: 132 },
  },
];

// Tuning knobs, kept in one place so play-testing can move them.
export const TUNE = {
  walkSpeed: 7.5,
  sprintSpeed: 11,
  playerRadius: 0.7,
  trafficCount: 16,
  pedCount: 26,
  policeMax: 4,
  wantedDecaySec: 14,
  heatPerCrime: 1,
  punchDamage: 34,
  bulletDamage: 34,
  guardHealth: 100,
  playerHealth: 100,
  arrestRange: 3.2,
  cameraHeight: 9,
  cameraBack: 13,
};

export const SAVE_KEY = 'neon-dusk-sable-city-save-v1';
