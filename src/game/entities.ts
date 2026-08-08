import { rand, randInt, TAU, wrap, wrapDelta } from '../engine/math'
import { ASTEROID_TIERS, WORLD_HEIGHT, WORLD_WIDTH } from './constants'

export interface Body {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
}

export interface Ship extends Body {
  angle: number
  thrusting: boolean
  cooldown: number
  invulnerable: number
}

export interface Bullet extends Body {
  life: number
}

export type AsteroidSize = 1 | 2 | 3

export interface Asteroid extends Body {
  size: AsteroidSize
  angle: number
  spin: number
  /** Per-vertex radius multipliers, giving each rock a stable silhouette. */
  shape: number[]
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
}

export function tier(size: AsteroidSize) {
  // ASTEROID_TIERS is indexed 0..2 for sizes 1..3.
  return ASTEROID_TIERS[size - 1]!
}

export function createShip(): Ship {
  return {
    x: WORLD_WIDTH * 0.5,
    y: WORLD_HEIGHT * 0.5,
    vx: 0,
    vy: 0,
    radius: 13,
    angle: -Math.PI * 0.5,
    thrusting: false,
    cooldown: 0,
    invulnerable: 0,
  }
}

export function createAsteroid(x: number, y: number, size: AsteroidSize): Asteroid {
  const t = tier(size)
  const speed = rand(t.minSpeed, t.maxSpeed)
  const heading = rand(0, TAU)
  const vertices = randInt(9, 14)
  const shape: number[] = []
  for (let i = 0; i < vertices; i++) shape.push(rand(0.72, 1.15))

  return {
    x,
    y,
    vx: Math.cos(heading) * speed,
    vy: Math.sin(heading) * speed,
    radius: t.radius,
    size,
    angle: rand(0, TAU),
    spin: rand(-1.1, 1.1),
    shape,
  }
}

/** Integrates position and wraps the body around the world edges. */
export function moveBody(body: Body, dt: number): void {
  body.x = wrap(body.x + body.vx * dt, WORLD_WIDTH)
  body.y = wrap(body.y + body.vy * dt, WORLD_HEIGHT)
}

/** Circle overlap test that accounts for world wrapping. */
export function bodiesOverlap(a: Body, b: Body): boolean {
  const dx = wrapDelta(a.x, b.x, WORLD_WIDTH)
  const dy = wrapDelta(a.y, b.y, WORLD_HEIGHT)
  const r = a.radius + b.radius
  return dx * dx + dy * dy <= r * r
}

export function distanceSquared(ax: number, ay: number, bx: number, by: number): number {
  const dx = wrapDelta(ax, bx, WORLD_WIDTH)
  const dy = wrapDelta(ay, by, WORLD_HEIGHT)
  return dx * dx + dy * dy
}
