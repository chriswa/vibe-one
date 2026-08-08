import type { Input, PointerState } from '../engine/input'
import { clamp, TAU } from '../engine/math'
import { COLORS, WORLD_HEIGHT, WORLD_WIDTH } from './constants'
import { neonStroke } from './render'

/** Drag distance, in world units, that corresponds to full throttle. */
const STICK_RANGE = 95
/** Below this the stick reads as centred, so a resting thumb does not drift. */
const STICK_DEADZONE = 14
const BUTTON_SIZE = 58
const BUTTON_MARGIN = 24

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const MUTE_BUTTON: Rect = {
  x: WORLD_WIDTH - BUTTON_MARGIN - BUTTON_SIZE,
  y: WORLD_HEIGHT - BUTTON_MARGIN - BUTTON_SIZE,
  w: BUTTON_SIZE,
  h: BUTTON_SIZE,
}

const PAUSE_BUTTON: Rect = {
  x: MUTE_BUTTON.x - BUTTON_SIZE - 16,
  y: MUTE_BUTTON.y,
  w: BUTTON_SIZE,
  h: BUTTON_SIZE,
}

function hits(rect: Rect, x: number, y: number): boolean {
  // Generous padding: fingers are bigger than the drawn glyph.
  const pad = 14
  return (
    x >= rect.x - pad && x <= rect.x + rect.w + pad && y >= rect.y - pad && y <= rect.y + rect.h + pad
  )
}

/** A pointer that began on a button never steers or fires. */
function isButtonPointer(p: PointerState): boolean {
  return hits(PAUSE_BUTTON, p.startX, p.startY) || hits(MUTE_BUTTON, p.startX, p.startY)
}

export interface SteerState {
  active: boolean
  /** Absolute heading the player is pointing the stick at. */
  angle: number
  /** 0 at the deadzone edge, 1 at full deflection. */
  magnitude: number
}

/**
 * Touch layout: the left half is a floating steering stick that springs to
 * wherever the thumb lands, the right half is hold-to-fire, and two buttons
 * in the bottom-right corner take priority over the fire zone.
 */
export class TouchControls {
  readonly steer: SteerState = { active: false, angle: 0, magnitude: 0 }
  firing = false
  pausePressed = false
  mutePressed = false

  private stickId: number | null = null
  private originX = 0
  private originY = 0
  private currentX = 0
  private currentY = 0

  /**
   * @param controlsLive steering and firing are read (false on menus and while
   *   paused, where a tap means "start" or nothing).
   * @param buttonsLive the corner buttons are on screen and tappable. Stays
   *   true while paused so a touch player can resume.
   */
  update(input: Input, controlsLive: boolean, buttonsLive: boolean): void {
    this.pausePressed = false
    this.mutePressed = false
    this.firing = false

    if (buttonsLive) {
      for (const p of input.pressedPointers()) {
        if (!p.isTouch) continue
        if (hits(PAUSE_BUTTON, p.startX, p.startY)) this.pausePressed = true
        else if (hits(MUTE_BUTTON, p.startX, p.startY)) this.mutePressed = true
      }
    }

    if (!controlsLive) {
      this.stickId = null
      this.steer.active = false
      return
    }

    if (this.stickId !== null && !input.hasPointer(this.stickId)) this.stickId = null

    for (const p of input.pointers()) {
      if (!p.isTouch || isButtonPointer(p)) continue

      if (p.id === this.stickId) {
        this.currentX = p.x
        this.currentY = p.y
        continue
      }

      if (this.stickId === null && p.startX < WORLD_WIDTH * 0.5) {
        this.stickId = p.id
        this.originX = p.startX
        this.originY = p.startY
        this.currentX = p.x
        this.currentY = p.y
        continue
      }

      if (p.startX >= WORLD_WIDTH * 0.5) this.firing = true
    }

    if (this.stickId === null) {
      this.steer.active = false
      return
    }

    const dx = this.currentX - this.originX
    const dy = this.currentY - this.originY
    const distance = Math.hypot(dx, dy)

    if (distance < STICK_DEADZONE) {
      // Holding still still counts as "on the stick", just with no throttle.
      this.steer.active = false
      this.steer.magnitude = 0
      return
    }

    this.steer.active = true
    this.steer.angle = Math.atan2(dy, dx)
    this.steer.magnitude = clamp(
      (distance - STICK_DEADZONE) / (STICK_RANGE - STICK_DEADZONE),
      0,
      1,
    )
  }

  render(ctx: CanvasRenderingContext2D, paused: boolean, muted: boolean): void {
    if (this.stickId !== null) this.drawStick(ctx)
    this.drawPauseButton(ctx, paused)
    this.drawMuteButton(ctx, muted)
  }

  private drawStick(ctx: CanvasRenderingContext2D): void {
    const dx = this.currentX - this.originX
    const dy = this.currentY - this.originY
    const distance = Math.hypot(dx, dy)
    const clamped = Math.min(distance, STICK_RANGE)
    const angle = Math.atan2(dy, dx)
    const knobX = this.originX + Math.cos(angle) * clamped
    const knobY = this.originY + Math.sin(angle) * clamped

    ctx.save()
    ctx.globalAlpha = 0.5

    ctx.beginPath()
    ctx.arc(this.originX, this.originY, STICK_RANGE, 0, TAU)
    neonStroke(ctx, COLORS.dim, 2, 6)

    if (distance >= STICK_DEADZONE) {
      ctx.beginPath()
      ctx.moveTo(this.originX, this.originY)
      ctx.lineTo(knobX, knobY)
      neonStroke(ctx, COLORS.ship, 2, 8)
    }

    ctx.globalAlpha = 0.75
    ctx.beginPath()
    ctx.arc(knobX, knobY, 26, 0, TAU)
    neonStroke(ctx, COLORS.ship, 2.5, 12)

    ctx.restore()
  }

  private drawPauseButton(ctx: CanvasRenderingContext2D, paused: boolean): void {
    const { x, y, w, h } = PAUSE_BUTTON
    ctx.save()
    ctx.globalAlpha = 0.45
    ctx.beginPath()
    ctx.arc(x + w * 0.5, y + h * 0.5, w * 0.5, 0, TAU)
    neonStroke(ctx, COLORS.dim, 2, 6)

    ctx.globalAlpha = 0.8
    if (paused) {
      // Play triangle.
      ctx.beginPath()
      ctx.moveTo(x + w * 0.38, y + h * 0.3)
      ctx.lineTo(x + w * 0.72, y + h * 0.5)
      ctx.lineTo(x + w * 0.38, y + h * 0.7)
      ctx.closePath()
      neonStroke(ctx, COLORS.ship, 2, 8)
    } else {
      for (const offset of [0.38, 0.58]) {
        ctx.beginPath()
        ctx.moveTo(x + w * offset, y + h * 0.3)
        ctx.lineTo(x + w * offset, y + h * 0.7)
        neonStroke(ctx, COLORS.ship, 3, 8)
      }
    }
    ctx.restore()
  }

  private drawMuteButton(ctx: CanvasRenderingContext2D, muted: boolean): void {
    const { x, y, w, h } = MUTE_BUTTON
    const cx = x + w * 0.5
    const cy = y + h * 0.5
    ctx.save()
    ctx.globalAlpha = 0.45
    ctx.beginPath()
    ctx.arc(cx, cy, w * 0.5, 0, TAU)
    neonStroke(ctx, COLORS.dim, 2, 6)

    ctx.globalAlpha = 0.8
    const color = muted ? COLORS.dim : COLORS.ship

    // Speaker body.
    ctx.beginPath()
    ctx.moveTo(cx - 12, cy - 5)
    ctx.lineTo(cx - 5, cy - 5)
    ctx.lineTo(cx + 2, cy - 12)
    ctx.lineTo(cx + 2, cy + 12)
    ctx.lineTo(cx - 5, cy + 5)
    ctx.lineTo(cx - 12, cy + 5)
    ctx.closePath()
    neonStroke(ctx, color, 2, 8)

    if (muted) {
      ctx.beginPath()
      ctx.moveTo(cx + 7, cy - 8)
      ctx.lineTo(cx + 17, cy + 8)
      ctx.moveTo(cx + 17, cy - 8)
      ctx.lineTo(cx + 7, cy + 8)
      neonStroke(ctx, COLORS.danger, 2, 8)
    } else {
      ctx.beginPath()
      ctx.arc(cx + 4, cy, 9, -0.9, 0.9)
      ctx.moveTo(cx + 16, cy - 8)
      ctx.arc(cx + 4, cy, 14, -0.75, 0.75)
      neonStroke(ctx, color, 2, 8)
    }
    ctx.restore()
  }
}
