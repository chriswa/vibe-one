/** Authored world size; everything below is in these units. */
export const WORLD_WIDTH = 1280
export const WORLD_HEIGHT = 720

export const COLORS = {
  background: '#05060c',
  letterbox: '#000000',
  ship: '#7cf7ff',
  shipThrust: '#ffb347',
  bullet: '#fff8b0',
  asteroid: '#9fb3ff',
  text: '#e6e9f5',
  dim: '#7a83a8',
  danger: '#ff5c7a',
} as const

export const SHIP = {
  radius: 13,
  turnSpeed: 3.8,
  /** Touch steering aims at an absolute heading, so it may turn a bit faster. */
  touchTurnBoost: 1.4,
  thrust: 420,
  /** Velocity retained per second (exponential drag). */
  drag: 0.55,
  maxSpeed: 560,
  fireInterval: 0.15,
  respawnInvulnerability: 2.5,
} as const

export const BULLET = {
  speed: 640,
  life: 1.05,
  radius: 2.5,
  max: 24,
} as const

/** Per-size asteroid tuning, indexed by size 1..3. */
export const ASTEROID_TIERS = [
  { radius: 17, minSpeed: 90, maxSpeed: 170, score: 100, children: 0 },
  { radius: 32, minSpeed: 60, maxSpeed: 120, score: 50, children: 2 },
  { radius: 54, minSpeed: 35, maxSpeed: 80, score: 20, children: 2 },
] as const

export const RULES = {
  startingLives: 3,
  extraLifeEvery: 5000,
  /** Big asteroids in wave n = base + n, clamped. */
  baseAsteroids: 3,
  maxAsteroids: 10,
  waveBreak: 1.6,
  deathPause: 2.0,
  /** Radius around the spawn point that must be clear before respawning. */
  safeRadius: 140,
} as const
