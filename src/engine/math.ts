export const TAU = Math.PI * 2

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Wraps `v` into the half-open range [0, size). */
export function wrap(v: number, size: number): number {
  const r = v % size
  return r < 0 ? r + size : r
}

export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export function randInt(min: number, maxExclusive: number): number {
  return Math.floor(rand(min, maxExclusive))
}

export function pick<T>(items: readonly T[]): T {
  // Callers pass non-empty literals; the assertion keeps the call sites clean
  // under `noUncheckedIndexedAccess`.
  return items[randInt(0, items.length)] as T
}

/** Shortest signed rotation from angle `a` to angle `b`, in (-PI, PI]. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % TAU
  if (d > Math.PI) d -= TAU
  else if (d < -Math.PI) d += TAU
  return d
}

/**
 * Shortest signed delta between two coordinates on a wrapping axis, i.e. the
 * offset you add to `a` to land on `b` going the short way around.
 */
export function wrapDelta(a: number, b: number, size: number): number {
  let d = b - a
  if (d > size * 0.5) d -= size
  else if (d < -size * 0.5) d += size
  return d
}
