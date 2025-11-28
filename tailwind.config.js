/** @type {import('tailwindcss').Config} */
import daisyui from "daisyui"
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,vue}",
  ],
  theme: {
    extend: {
      fontFamily: {
        minecraft: ['minecrafter']
      }
    },
  },
  plugins: [
    daisyui
  ],
  daisyui: {
    themes: false
  }
}

