/**
 * The game is authored against a fixed world size and letterboxed into
 * whatever the window happens to be, so gameplay is identical everywhere.
 */
export class Viewport {
  readonly canvas: HTMLCanvasElement
  readonly ctx: CanvasRenderingContext2D
  readonly worldWidth: number
  readonly worldHeight: number

  /** World-units-to-CSS-pixels factor of the letterboxed fit. */
  scale = 1
  /** CSS-pixel offset of the world's top-left corner. */
  offsetX = 0
  offsetY = 0

  constructor(canvas: HTMLCanvasElement, worldWidth: number, worldHeight: number) {
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('2d canvas context unavailable')

    this.canvas = canvas
    this.ctx = ctx
    this.worldWidth = worldWidth
    this.worldHeight = worldHeight

    this.resize()
    window.addEventListener('resize', () => this.resize())
    window.addEventListener('orientationchange', () => this.resize())
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const cssWidth = window.innerWidth
    const cssHeight = window.innerHeight

    this.canvas.width = Math.max(1, Math.round(cssWidth * dpr))
    this.canvas.height = Math.max(1, Math.round(cssHeight * dpr))

    this.scale = Math.min(cssWidth / this.worldWidth, cssHeight / this.worldHeight)
    this.offsetX = (cssWidth - this.worldWidth * this.scale) * 0.5
    this.offsetY = (cssHeight - this.worldHeight * this.scale) * 0.5

    // One transform for everything: draw in world units, land on device pixels.
    this.ctx.setTransform(
      dpr * this.scale,
      0,
      0,
      dpr * this.scale,
      dpr * this.offsetX,
      dpr * this.offsetY,
    )
  }

  /** Converts a CSS-pixel page coordinate into world space. */
  toWorldX(clientX: number): number {
    return (clientX - this.offsetX) / this.scale
  }

  toWorldY(clientY: number): number {
    return (clientY - this.offsetY) / this.scale
  }

  /** Paints the letterbox bars, which live outside the world transform. */
  clearLetterbox(color: string): void {
    const { ctx, canvas } = this
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = color
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
  }
}
