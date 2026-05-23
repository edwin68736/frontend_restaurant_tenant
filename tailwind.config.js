import colors from 'tailwindcss/colors'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /** Color corporativo Tukichef (antes rojo tomate → green-600 y escala Tailwind green). */
        rest: colors.green,
      },
      fontFamily: { sans: ['DM Sans', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
}
