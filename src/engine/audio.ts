/**
 * Procedural sound — no asset files. The AudioContext is created lazily on the
 * first user gesture, since browsers block it before that.
 */
export class Audio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  muted = false

  /** Safe to call every frame; only the first call after a gesture does work. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return

    this.ctx = new Ctor()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.25
    this.master.connect(this.ctx.destination)
  }

  toggleMute(): void {
    this.muted = !this.muted
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.25, this.ctx.currentTime, 0.02)
    }
  }

  private tone(
    type: OscillatorType,
    startFreq: number,
    endFreq: number,
    duration: number,
    gain: number,
  ): void {
    const { ctx, master } = this
    if (!ctx || !master || this.muted) return

    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const env = ctx.createGain()

    osc.type = type
    osc.frequency.setValueAtTime(startFreq, t)
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t + duration)

    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(gain, t + 0.008)
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration)

    osc.connect(env).connect(master)
    osc.start(t)
    osc.stop(t + duration + 0.02)
  }

  private noise(duration: number, gain: number, filterFreq: number): void {
    const { ctx, master } = this
    if (!ctx || !master || this.muted) return

    const t = ctx.currentTime
    const frames = Math.floor(ctx.sampleRate * duration)
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1

    const src = ctx.createBufferSource()
    src.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(filterFreq, t)
    filter.frequency.exponentialRampToValueAtTime(120, t + duration)

    const env = ctx.createGain()
    env.gain.setValueAtTime(gain, t)
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration)

    src.connect(filter).connect(env).connect(master)
    src.start(t)
  }

  shoot(): void {
    this.tone('square', 880, 220, 0.09, 0.18)
  }

  explosion(size: number): void {
    this.noise(0.18 + size * 0.12, 0.5, 1400 - size * 300)
  }

  playerHit(): void {
    this.tone('sawtooth', 300, 40, 0.6, 0.35)
    this.noise(0.5, 0.4, 900)
  }

  waveStart(): void {
    this.tone('triangle', 330, 660, 0.18, 0.2)
  }

  extraLife(): void {
    this.tone('triangle', 523, 1046, 0.25, 0.22)
  }
}
