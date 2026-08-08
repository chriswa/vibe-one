import { Viewport } from './engine/canvas'
import { Input } from './engine/input'
import { startLoop } from './engine/loop'
import { WORLD_HEIGHT, WORLD_WIDTH } from './game/constants'
import { Game } from './game/game'

const canvas = document.querySelector<HTMLCanvasElement>('#game')
if (!canvas) throw new Error('#game canvas not found')

const viewport = new Viewport(canvas, WORLD_WIDTH, WORLD_HEIGHT)
const input = new Input(viewport)
const game = new Game(viewport, input)

startLoop({
  update(dt) {
    game.update(dt)
    input.endFrame()
  },
  render() {
    game.render()
  },
})
