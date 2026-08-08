export interface LoopCallbacks {
  /** Called at a fixed rate; `dt` is always `1 / updatesPerSecond`. */
  update(dt: number): void
  render(): void
}

const UPDATES_PER_SECOND = 120
const FIXED_DT = 1 / UPDATES_PER_SECOND
/** Cap on catch-up work after a stall (tab backgrounded, breakpoint, ...). */
const MAX_FRAME_SECONDS = 0.25

/**
 * Fixed-timestep update with a decoupled render, so simulation behaviour does
 * not change with display refresh rate.
 */
export function startLoop(callbacks: LoopCallbacks): () => void {
  let previous = performance.now()
  let accumulator = 0
  let frame = 0
  let running = true

  const tick = (now: number): void => {
    if (!running) return
    frame = requestAnimationFrame(tick)

    accumulator += Math.min((now - previous) / 1000, MAX_FRAME_SECONDS)
    previous = now

    while (accumulator >= FIXED_DT) {
      accumulator -= FIXED_DT
      callbacks.update(FIXED_DT)
    }

    callbacks.render()
  }

  frame = requestAnimationFrame(tick)

  return () => {
    running = false
    cancelAnimationFrame(frame)
  }
}
