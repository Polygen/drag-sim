/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // RS Garage (Red) and Preditech (Blue) primary colors
        rs: '#ef4444', 
        preditech: '#3b82f6',
        dark: '#121212',
        darker: '#0a0a0a',
        darkSecondary: '#1f1f1f',
        accent: '#f59e0b'
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
