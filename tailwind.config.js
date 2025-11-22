/** @type {import('tailwindcss').Config} */
import daisyui from "daisyui"
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,vue}",
  ],
  theme: {
    extend: {
      fontFamily: {
        minecraft: ['minecraft']
      }
    },
  },
  plugins: [
    daisyui
  ],
  daisyui : {
    themes: false
  }
}

