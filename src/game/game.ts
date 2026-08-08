import { Audio } from '../engine/audio'
import type { Viewport } from '../engine/canvas'
import type { Input } from '../engine/input'
import { angleDelta, clamp, pick, rand, randInt, TAU } from '../engine/math'
import { BULLET, COLORS, RULES, SHIP, WORLD_HEIGHT, WORLD_WIDTH } from './constants'
import {
  bodiesOverlap,
  createAsteroid,
  createShip,
  distanceSquared,
  moveBody,
  tier,
  type Asteroid,
  type AsteroidSize,
  type Bullet,
  type Particle,
  type Ship,
} from './entities'
import {
  createStarfield,
  drawAsteroid,
  drawBullet,
  drawLifeIcon,
  drawParticles,
  drawShip,
  drawStarfield,
  drawText,
} from './render'
import { TouchControls } from './touch'

type Phase = 'title' | 'playing' | 'dying' | 'gameover'

const KEYS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  thrust: ['ArrowUp', 'KeyW'],
  fire: ['Space'],
  pause: ['KeyP', 'Escape'],
  mute: ['KeyM'],
  start: ['Space', 'Enter', 'KeyR'],
}

export class Game {
  private readonly ctx: CanvasRenderingContext2D
  private readonly audio = new Audio()
  private readonly stars = createStarfield(140)
  private readonly touch = new TouchControls()

  private phase: Phase = 'title'
  private paused = false
  private time = 0

  private ship: Ship = createShip()
  private asteroids: Asteroid[] = []
  private bullets: Bullet[] = []
  private particles: Particle[] = []

  private score = 0
  private best = loadBest()
  private lives = RULES.startingLives
  private wave = 0
  private nextExtraLife = RULES.extraLifeEvery
  /** Counts down between waves and after a death. */
  private timer = 0
  private shake = 0

  constructor(
    private readonly viewport: Viewport,
    private readonly input: Input,
  ) {
    this.ctx = viewport.ctx
    this.spawnDecorativeField()
  }

  // --- lifecycle -----------------------------------------------------------

  private spawnDecorativeField(): void {
    // Drifting rocks behind the title screen.
    this.asteroids = []
    for (let i = 0; i < 7; i++) {
      this.asteroids.push(
        createAsteroid(rand(0, WORLD_WIDTH), rand(0, WORLD_HEIGHT), pick([1, 2, 3] as const)),
      )
    }
  }

  private startRun(): void {
    this.score = 0
    this.lives = RULES.startingLives
    this.wave = 0
    this.nextExtraLife = RULES.extraLifeEvery
    this.bullets = []
    this.particles = []
    this.asteroids = []
    this.ship = createShip()
    this.ship.invulnerable = SHIP.respawnInvulnerability
    this.phase = 'playing'
    this.startWave()
  }

  private startWave(): void {
    this.wave += 1
    const count = Math.min(RULES.baseAsteroids + this.wave, RULES.maxAsteroids)
    for (let i = 0; i < count; i++) {
      this.asteroids.push(this.spawnAsteroidAwayFromShip(3))
    }
    this.audio.waveStart()
  }

  private spawnAsteroidAwayFromShip(size: AsteroidSize): Asteroid {
    const minDistance = 220
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = rand(0, WORLD_WIDTH)
      const y = rand(0, WORLD_HEIGHT)
      if (distanceSquared(x, y, this.ship.x, this.ship.y) > minDistance * minDistance) {
        return createAsteroid(x, y, size)
      }
    }
    return createAsteroid(rand(0, WORLD_WIDTH), 0, size)
  }

  // --- update --------------------------------------------------------------

  update(dt: number): void {
    if (this.input.interacted) this.audio.unlock()

    // Buttons stay live while paused so a touch player can resume.
    this.touch.update(
      this.input,
      this.phase === 'playing' && !this.paused,
      this.phase === 'playing' || this.phase === 'dying',
    )

    if (this.input.wasPressed(...KEYS.mute) || this.touch.mutePressed) this.audio.toggleMute()

    if (this.phase === 'playing' && (this.input.wasPressed(...KEYS.pause) || this.touch.pausePressed)) {
      this.paused = !this.paused
    }

    if (this.phase === 'title' || this.phase === 'gameover') {
      // Brief lockout after a game over so a held key does not skip the screen.
      this.timer = Math.max(0, this.timer - dt)
      if (this.timer === 0 && (this.input.wasPressed(...KEYS.start) || this.input.pointerPressed)) {
        this.startRun()
      }
    }

    if (this.paused) {
      this.time += dt
      return
    }

    this.time += dt
    this.shake = Math.max(0, this.shake - dt * 26)

    if (this.phase === 'playing') this.updateShip(dt)
    if (this.phase === 'dying') this.updateDying(dt)

    this.updateBullets(dt)
    this.updateAsteroids(dt)
    this.updateParticles(dt)

    if (this.phase === 'playing') {
      this.collide()
      if (this.asteroids.length === 0) {
        this.timer -= dt
        if (this.timer <= 0) {
          this.timer = RULES.waveBreak
          this.startWave()
        }
      } else {
        this.timer = RULES.waveBreak
      }
    }
  }

  private updateShip(dt: number): void {
    const ship = this.ship
    const input = this.input

    const steer = this.touch.steer
    if (steer.active) {
      // The stick sets an absolute heading; the ship still has to turn to it,
      // so touch and keyboard handling feel the same.
      const step = SHIP.turnSpeed * SHIP.touchTurnBoost * dt
      ship.angle += clamp(angleDelta(ship.angle, steer.angle), -step, step)
    } else {
      if (input.isDown(...KEYS.left)) ship.angle -= SHIP.turnSpeed * dt
      if (input.isDown(...KEYS.right)) ship.angle += SHIP.turnSpeed * dt
    }

    ship.thrusting = input.isDown(...KEYS.thrust) || steer.magnitude > 0.3
    if (ship.thrusting) {
      ship.vx += Math.cos(ship.angle) * SHIP.thrust * dt
      ship.vy += Math.sin(ship.angle) * SHIP.thrust * dt
      this.emitThrustParticle()
    }

    const damping = Math.exp(-SHIP.drag * dt)
    ship.vx *= damping
    ship.vy *= damping

    const speed = Math.hypot(ship.vx, ship.vy)
    if (speed > SHIP.maxSpeed) {
      const k = SHIP.maxSpeed / speed
      ship.vx *= k
      ship.vy *= k
    }

    moveBody(ship, dt)

    ship.invulnerable = Math.max(0, ship.invulnerable - dt)
    ship.cooldown = Math.max(0, ship.cooldown - dt)

    // On touch only the right-hand fire zone shoots; with a mouse, any click does.
    const firing =
      input.isDown(...KEYS.fire) || this.touch.firing || (input.pointerDown && !input.hasTouch)
    if (firing && ship.cooldown === 0 && this.bullets.length < BULLET.max) {
      this.fire()
    }
  }

  private fire(): void {
    const ship = this.ship
    const nose = ship.radius + 6
    this.bullets.push({
      x: ship.x + Math.cos(ship.angle) * nose,
      y: ship.y + Math.sin(ship.angle) * nose,
      vx: ship.vx + Math.cos(ship.angle) * BULLET.speed,
      vy: ship.vy + Math.sin(ship.angle) * BULLET.speed,
      radius: BULLET.radius,
      life: BULLET.life,
    })
    ship.cooldown = SHIP.fireInterval
    // A little kick back, so firing is not free.
    ship.vx -= Math.cos(ship.angle) * 12
    ship.vy -= Math.sin(ship.angle) * 12
    this.audio.shoot()
  }

  private updateDying(dt: number): void {
    this.timer -= dt
    if (this.timer > 0) return

    if (this.lives <= 0) {
      this.phase = 'gameover'
      this.timer = 0.75
      if (this.score > this.best) {
        this.best = this.score
        saveBest(this.best)
      }
      return
    }

    // Wait for the middle of the arena to be clear before putting the ship back.
    const clear = this.asteroids.every(
      (a) =>
        distanceSquared(WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.5, a.x, a.y) >
        (RULES.safeRadius + a.radius) ** 2,
    )
    if (!clear) return

    this.ship = createShip()
    this.ship.invulnerable = SHIP.respawnInvulnerability
    this.phase = 'playing'
  }

  private updateBullets(dt: number): void {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i]!
      b.life -= dt
      if (b.life <= 0) {
        this.bullets.splice(i, 1)
        continue
      }
      moveBody(b, dt)
    }
  }

  private updateAsteroids(dt: number): void {
    for (const a of this.asteroids) {
      a.angle += a.spin * dt
      moveBody(a, dt)
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!
      p.life -= dt
      if (p.life <= 0) {
        this.particles.splice(i, 1)
        continue
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vx *= 0.99
      p.vy *= 0.99
    }
  }

  // --- collisions ----------------------------------------------------------

  private collide(): void {
    for (let ai = this.asteroids.length - 1; ai >= 0; ai--) {
      const a = this.asteroids[ai]
      if (!a) continue

      let destroyed = false
      for (let bi = this.bullets.length - 1; bi >= 0; bi--) {
        const b = this.bullets[bi]!
        if (!bodiesOverlap(a, b)) continue
        this.bullets.splice(bi, 1)
        this.destroyAsteroid(ai, a)
        destroyed = true
        break
      }
      if (destroyed) continue

      if (this.ship.invulnerable === 0 && bodiesOverlap(a, this.ship)) {
        this.killShip()
        return
      }
    }
  }

  private destroyAsteroid(index: number, a: Asteroid): void {
    this.asteroids.splice(index, 1)
    this.addScore(tier(a.size).score)
    this.explode(a.x, a.y, a.size)
    this.audio.explosion(a.size)
    this.shake = Math.min(14, this.shake + 2 + a.size * 1.5)

    const childCount = tier(a.size).children
    if (childCount > 0) {
      const childSize = (a.size - 1) as AsteroidSize
      for (let i = 0; i < childCount; i++) {
        const child = createAsteroid(a.x, a.y, childSize)
        // Inherit some of the parent's momentum so splits feel connected.
        child.vx += a.vx * 0.4
        child.vy += a.vy * 0.4
        this.asteroids.push(child)
      }
    }
  }

  private killShip(): void {
    this.lives -= 1
    this.phase = 'dying'
    this.timer = RULES.deathPause
    this.shake = 22
    this.explode(this.ship.x, this.ship.y, 3, COLORS.ship)
    this.audio.playerHit()
    this.ship.thrusting = false
  }

  private addScore(points: number): void {
    this.score += points
    if (this.score >= this.nextExtraLife) {
      this.lives += 1
      this.nextExtraLife += RULES.extraLifeEvery
      this.audio.extraLife()
    }
  }

  // --- particles -----------------------------------------------------------

  private explode(x: number, y: number, size: number, color: string = COLORS.asteroid): void {
    const count = 14 + size * 10
    for (let i = 0; i < count; i++) {
      const angle = rand(0, TAU)
      const speed = rand(40, 60 + size * 70)
      const life = rand(0.25, 0.5 + size * 0.2)
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        size: rand(1.5, 3.5),
        color,
      })
    }
  }

  private emitThrustParticle(): void {
    if (randInt(0, 3) !== 0) return
    const back = this.ship.angle + Math.PI + rand(-0.35, 0.35)
    const speed = rand(80, 190)
    const life = rand(0.15, 0.35)
    this.particles.push({
      x: this.ship.x + Math.cos(back) * 12,
      y: this.ship.y + Math.sin(back) * 12,
      vx: this.ship.vx + Math.cos(back) * speed,
      vy: this.ship.vy + Math.sin(back) * speed,
      life,
      maxLife: life,
      size: rand(1.5, 3),
      color: COLORS.shipThrust,
    })
  }

  // --- render --------------------------------------------------------------

  render(): void {
    const ctx = this.ctx

    this.viewport.clearLetterbox(COLORS.letterbox)
    ctx.save()

    if (this.shake > 0) {
      ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake))
    }

    ctx.fillStyle = COLORS.background
    ctx.fillRect(-64, -64, WORLD_WIDTH + 128, WORLD_HEIGHT + 128)

    drawStarfield(ctx, this.stars, this.time)
    drawParticles(ctx, this.particles)

    for (const a of this.asteroids) drawAsteroid(ctx, a)
    for (const b of this.bullets) drawBullet(ctx, b)
    if (this.phase === 'playing') drawShip(ctx, this.ship, this.time)

    ctx.restore()

    this.drawHud()

    // Drawn last so the stick and buttons stay readable over the pause dim.
    if (this.input.hasTouch && (this.phase === 'playing' || this.phase === 'dying')) {
      this.touch.render(ctx, this.paused, this.audio.muted)
    }
  }

  private drawHud(): void {
    const ctx = this.ctx

    if (this.phase === 'title') {
      this.dim(0.55)
      drawText(ctx, 'VIBE ONE', WORLD_WIDTH * 0.5, 280, 86, COLORS.ship, 'center')

      if (this.input.hasTouch) {
        drawText(ctx, 'tap to fly', WORLD_WIDTH * 0.5, 340, 22, COLORS.text, 'center')
        drawText(
          ctx,
          'drag the left side to steer      hold the right side to fire',
          WORLD_WIDTH * 0.5,
          420,
          18,
          COLORS.dim,
          'center',
        )
      } else {
        drawText(
          ctx,
          'press SPACE or click to fly',
          WORLD_WIDTH * 0.5,
          340,
          22,
          COLORS.text,
          'center',
        )
        drawText(
          ctx,
          'A / D or  ← →  turn      W or ↑  thrust      SPACE / click  fire',
          WORLD_WIDTH * 0.5,
          420,
          18,
          COLORS.dim,
          'center',
        )
        drawText(ctx, 'P pause      M mute', WORLD_WIDTH * 0.5, 450, 18, COLORS.dim, 'center')
      }
      if (this.best > 0) {
        drawText(ctx, `best ${this.best}`, WORLD_WIDTH * 0.5, 510, 20, COLORS.dim, 'center')
      }
      return
    }

    drawText(ctx, `${this.score}`, 28, 56, 34)
    drawText(ctx, `wave ${this.wave}`, WORLD_WIDTH - 28, 56, 22, COLORS.dim, 'right')
    drawText(ctx, `best ${Math.max(this.best, this.score)}`, WORLD_WIDTH - 28, 84, 18, COLORS.dim, 'right')

    for (let i = 0; i < this.lives; i++) {
      drawLifeIcon(ctx, 40 + i * 26, 86)
    }

    if (this.audio.muted && !this.input.hasTouch) {
      drawText(ctx, 'muted', 28, WORLD_HEIGHT - 24, 16, COLORS.dim)
    }

    if (this.paused) {
      this.dim(0.55)
      drawText(ctx, 'PAUSED', WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.5, 60, COLORS.text, 'center')
      drawText(
        ctx,
        this.input.hasTouch ? 'tap play to resume' : 'press P to resume',
        WORLD_WIDTH * 0.5,
        WORLD_HEIGHT * 0.5 + 44,
        20,
        COLORS.dim,
        'center',
      )
      return
    }

    if (this.phase === 'gameover') {
      this.dim(0.6)
      drawText(ctx, 'GAME OVER', WORLD_WIDTH * 0.5, 300, 72, COLORS.danger, 'center')
      drawText(ctx, `score ${this.score}`, WORLD_WIDTH * 0.5, 356, 26, COLORS.text, 'center')
      drawText(ctx, `best ${this.best}`, WORLD_WIDTH * 0.5, 390, 20, COLORS.dim, 'center')
      if (this.timer === 0) {
        const pulse = 0.6 + 0.4 * Math.sin(this.time * 4)
        ctx.globalAlpha = pulse
        drawText(ctx, 'press SPACE to try again', WORLD_WIDTH * 0.5, 460, 22, COLORS.text, 'center')
        ctx.globalAlpha = 1
      }
    } else if (this.asteroids.length === 0 && this.phase === 'playing') {
      drawText(
        ctx,
        `WAVE ${this.wave + 1}`,
        WORLD_WIDTH * 0.5,
        WORLD_HEIGHT * 0.5,
        48,
        COLORS.ship,
        'center',
      )
    }
  }

  private dim(alpha: number): void {
    const ctx = this.ctx
    ctx.fillStyle = `rgba(5, 6, 12, ${clamp(alpha, 0, 1)})`
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
  }
}

const BEST_KEY = 'vibe-one:best'

function loadBest(): number {
  try {
    const raw = localStorage.getItem(BEST_KEY)
    const value = raw === null ? 0 : Number.parseInt(raw, 10)
    return Number.isFinite(value) && value > 0 ? value : 0
  } catch {
    // Private-mode / blocked storage: high scores just do not persist.
    return 0
  }
}

function saveBest(value: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(value))
  } catch {
    /* ignore */
  }
}
