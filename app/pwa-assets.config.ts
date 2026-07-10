import {
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config'

// Generates the PWA / favicon image set from icon-source.svg.
// The source is full-bleed gold, so we drop the preset's default padding and
// white background: the maskable + apple icons should fill their canvas and
// let the mark sit inside its own safe zone, not float on a white square.
const gold = { r: 217, g: 165, b: 33, alpha: 1 }

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    transparent: {
      ...minimal2023Preset.transparent,
      padding: 0,
    },
    maskable: {
      ...minimal2023Preset.maskable,
      padding: 0,
      resizeOptions: { background: gold },
    },
    apple: {
      ...minimal2023Preset.apple,
      padding: 0,
      resizeOptions: { background: gold },
    },
  },
  images: ['icon-source.svg'],
})
