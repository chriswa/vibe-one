import type { Viewport } from './canvas'

const PREVENT_DEFAULT = new Set([
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Tab',
])

/** One live pointer (mouse button held, or a finger on the glass). */
export interface PointerState {
  readonly id: number
  readonly isTouch: boolean
  /** Where the press landed, in world units. Fixed for the pointer's life. */
  readonly startX: number
  readonly startY: number
  /** Current position, in world units. */
  x: number
  y: number
}

/**
 * Keyboard + pointer state. `down` is level-triggered; `pressed` is
 * edge-triggered and cleared by `endFrame()` once per update tick.
 *
 * Multiple pointers are tracked by id so touch can steer with one thumb and
 * fire with the other; `pointerX`/`pointerY`/`pointerDown` track the most
 * recent pointer and are what the mouse path reads.
 */
export class Input {
  private readonly down = new Set<string>()
  private readonly pressed = new Set<string>()
  private readonly active = new Map<number, PointerState>()
  /**
   * Presses seen since the last tick. Kept separately from `active` because a
   * fast tap can go down and up between two frames — polling live pointers
   * would miss it entirely.
   */
  private readonly presses: PointerState[] = []

  pointerX = 0
  pointerY = 0
  pointerDown = false
  pointerPressed = false

  /** Set once a touch pointer is seen; switches the game to the touch UI. */
  hasTouch = false

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
      this.active.clear()
      this.pointerDown = false
    })

    target.addEventListener('pointermove', (e) => {
      const x = this.viewport.toWorldX(e.clientX)
      const y = this.viewport.toWorldY(e.clientY)
      this.pointerX = x
      this.pointerY = y
      const pointer = this.active.get(e.pointerId)
      if (pointer) {
        pointer.x = x
        pointer.y = y
      }
    })

    target.addEventListener('pointerdown', (e) => {
      target.setPointerCapture(e.pointerId)
      const x = this.viewport.toWorldX(e.clientX)
      const y = this.viewport.toWorldY(e.clientY)

      if (e.pointerType === 'touch') this.hasTouch = true
      const pointer: PointerState = {
        id: e.pointerId,
        isTouch: e.pointerType === 'touch',
        startX: x,
        startY: y,
        x,
        y,
      }
      this.active.set(e.pointerId, pointer)
      this.presses.push(pointer)

      this.pointerX = x
      this.pointerY = y
      this.pointerDown = true
      this.pointerPressed = true
      this.interacted = true
    })

    const release = (e: PointerEvent): void => {
      if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId)
      this.active.delete(e.pointerId)
      this.pointerDown = this.active.size > 0
    }
    target.addEventListener('pointerup', release)
    target.addEventListener('pointercancel', release)

    target.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  isDown(...codes: string[]): boolean {
    return codes.some((code) => this.down.has(code))
  }

  wasPressed(...codes: string[]): boolean {
    return codes.some((code) => this.pressed.has(code))
  }

  pointers(): Iterable<PointerState> {
    return this.active.values()
  }

  /** Pointers that went down since the last tick, released or not. */
  pressedPointers(): readonly PointerState[] {
    return this.presses
  }

  hasPointer(id: number): boolean {
    return this.active.has(id)
  }

  endFrame(): void {
    this.pressed.clear()
    this.pointerPressed = false
    this.presses.length = 0
  }
}
