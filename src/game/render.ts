import { rand, TAU } from '../engine/math'
import { COLORS, WORLD_HEIGHT, WORLD_WIDTH } from './constants'
import type { Asteroid, Bullet, Particle, Ship } from './entities'

type Ctx = CanvasRenderingContext2D

/**
 * Runs `draw` at the body's position plus any edge mirror needed, so objects
 * straddling a world boundary appear on both sides.
 */
export function drawWrapped(
  ctx: Ctx,
  x: number,
  y: number,
  radius: number,
  draw: (ctx: Ctx) => void,
): void {
  const offsetsX = [0]
  const offsetsY = [0]
  if (x < radius) offsetsX.push(WORLD_WIDTH)
  else if (x > WORLD_WIDTH - radius) offsetsX.push(-WORLD_WIDTH)
  if (y < radius) offsetsY.push(WORLD_HEIGHT)
  else if (y > WORLD_HEIGHT - radius) offsetsY.push(-WORLD_HEIGHT)

  for (const ox of offsetsX) {
    for (const oy of offsetsY) {
      ctx.save()
      ctx.translate(x + ox, y + oy)
      draw(ctx)
      ctx.restore()
    }
  }
}

export function neonStroke(ctx: Ctx, color: string, width: number, glow: number): void {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.shadowColor = color
  ctx.shadowBlur = glow
  ctx.stroke()
  // Second pass without glow keeps the core of the line crisp.
  ctx.shadowBlur = 0
  ctx.stroke()
}

export interface Star {
  x: number
  y: number
  r: number
  alpha: number
}

export function createStarfield(count: number): Star[] {
  const stars: Star[] = []
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rand(0, WORLD_WIDTH),
      y: rand(0, WORLD_HEIGHT),
      r: rand(0.4, 1.5),
      alpha: rand(0.15, 0.7),
    })
  }
  return stars
}

export function drawStarfield(ctx: Ctx, stars: readonly Star[], time: number): void {
  for (const star of stars) {
    const twinkle = 0.75 + 0.25 * Math.sin(time * 2 + star.x * 0.05)
    ctx.globalAlpha = star.alpha * twinkle
    ctx.fillStyle = '#cdd6ff'
    ctx.beginPath()
    ctx.arc(star.x, star.y, star.r, 0, TAU)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

export function drawShip(ctx: Ctx, ship: Ship, time: number): void {
  // Blink while the post-respawn invulnerability is running out.
  if (ship.invulnerable > 0 && Math.floor(time * 12) % 2 === 0) return

  drawWrapped(ctx, ship.x, ship.y, ship.radius * 2, (c) => {
    c.rotate(ship.angle)

    if (ship.thrusting) {
      const flicker = rand(0.6, 1.2)
      c.beginPath()
      c.moveTo(-8, -5)
      c.lineTo(-10 - 12 * flicker, 0)
      c.lineTo(-8, 5)
      neonStroke(c, COLORS.shipThrust, 2, 12)
    }

    c.beginPath()
    c.moveTo(16, 0)
    c.lineTo(-11, -10)
    c.lineTo(-6, 0)
    c.lineTo(-11, 10)
    c.closePath()
    neonStroke(c, COLORS.ship, 2, 14)
  })
}

export function drawAsteroid(ctx: Ctx, a: Asteroid): void {
  drawWrapped(ctx, a.x, a.y, a.radius * 1.3, (c) => {
    c.rotate(a.angle)
    c.beginPath()
    for (let i = 0; i < a.shape.length; i++) {
      const angle = (i / a.shape.length) * TAU
      const r = a.radius * a.shape[i]!
      const px = Math.cos(angle) * r
      const py = Math.sin(angle) * r
      if (i === 0) c.moveTo(px, py)
      else c.lineTo(px, py)
    }
    c.closePath()
    neonStroke(c, COLORS.asteroid, 1.8, 10)
  })
}

export function drawBullet(ctx: Ctx, b: Bullet): void {
  drawWrapped(ctx, b.x, b.y, 8, (c) => {
    c.beginPath()
    c.arc(0, 0, b.radius, 0, TAU)
    c.fillStyle = COLORS.bullet
    c.shadowColor = COLORS.bullet
    c.shadowBlur = 12
    c.fill()
    c.shadowBlur = 0
  })
}

export function drawParticles(ctx: Ctx, particles: readonly Particle[]): void {
  for (const p of particles) {
    const t = p.life / p.maxLife
    ctx.globalAlpha = Math.max(0, t)
    ctx.fillStyle = p.color
    ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size)
  }
  ctx.globalAlpha = 1
}

export function drawText(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string = COLORS.text,
  align: CanvasTextAlign = 'left',
): void {
  ctx.font = `${size}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`
  ctx.textAlign = align
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = color
  ctx.shadowColor = color
  ctx.shadowBlur = 8
  ctx.fillText(text, x, y)
  ctx.shadowBlur = 0
}

/** Small ship outline used for the remaining-lives readout. */
export function drawLifeIcon(ctx: Ctx, x: number, y: number): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(-Math.PI * 0.5)
  ctx.scale(0.7, 0.7)
  ctx.beginPath()
  ctx.moveTo(16, 0)
  ctx.lineTo(-11, -10)
  ctx.lineTo(-6, 0)
  ctx.lineTo(-11, 10)
  ctx.closePath()
  neonStroke(ctx, COLORS.ship, 1.8, 8)
  ctx.restore()
}
