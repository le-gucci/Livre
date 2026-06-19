/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'serif'],
      },
      colors: {
        parchment: '#f5f0e8',
        ink: '#1c1917',
      },
    },
  },
  plugins: [],
}
