import type { Viewport } from './canvas'

const PREVENT_DEFAULT = new Set([
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Tab',
])

/**
 * Keyboard + pointer state. `down` is level-triggered; `pressed` is
 * edge-triggered and cleared by `endFrame()` once per update tick.
 */
export class Input {
  private readonly down = new Set<string>()
  private readonly pressed = new Set<string>()

  pointerX = 0
  pointerY = 0
  pointerDown = false
  pointerPressed = false

  /** Set on the first real key/pointer interaction; gates audio startup. */
  interacted = false

  constructor(private readonly viewport: Viewport) {
    const target = viewport.canvas

    window.addEventListener('keydown', (e) => {
      if (PREVENT_DEFAULT.has(e.code)) e.preventDefault()
      if (e.repeat) return
      this.down.add(e.code)
      this.pressed.add(e.code)
      this.interacted = true
    })

    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code)
    })

    // Losing focus mid-keypress would otherwise leave a key stuck down.
    window.addEventListener('blur', () => {
      this.down.clear()
      this.pointerDown = false
    })

    target.addEventListener('pointermove', (e) => this.movePointer(e))

    target.addEventListener('pointerdown', (e) => {
      target.setPointerCapture(e.pointerId)
      this.movePointer(e)
      this.pointerDown = true
      this.pointerPressed = true
      this.interacted = true
    })

    target.addEventListener('pointerup', (e) => {
      if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId)
      this.pointerDown = false
    })

    target.addEventListener('pointercancel', () => {
      this.pointerDown = false
    })

    target.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  private movePointer(e: PointerEvent): void {
    this.pointerX = this.viewport.toWorldX(e.clientX)
    this.pointerY = this.viewport.toWorldY(e.clientY)
  }

  isDown(...codes: string[]): boolean {
    return codes.some((code) => this.down.has(code))
  }

  wasPressed(...codes: string[]): boolean {
    return codes.some((code) => this.pressed.has(code))
  }

  /** Any key or click this tick — used for "press anything to continue". */
  anyPressed(): boolean {
    return this.pressed.size > 0 || this.pointerPressed
  }

  endFrame(): void {
    this.pressed.clear()
    this.pointerPressed = false
  }
}
