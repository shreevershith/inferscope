/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Precision Slate — Primary (warm gold)
        primary: '#ffe188',
        'primary-container': '#ffcf04',
        'primary-dim': '#efc200',
        'on-primary': '#453a00',

        // Secondary (rich gold)
        secondary: '#f6e24b',
        'secondary-container': '#6a5f00',
        'secondary-dim': '#e7d33d',

        // Tertiary (electric cyan)
        tertiary: '#f8ffb8',
        'tertiary-dim': '#dfef64',
        'tertiary-fixed': '#eefe71',

        // Surfaces
        surface: '#110e00',
        'surface-dim': '#110e00',
        'surface-bright': '#322c00',
        'surface-container-lowest': '#000000',
        'surface-container-low': '#171400',
        'surface-container': '#1e293b',
        'surface-container-high': '#252230',
        'surface-container-highest': '#302d1e',

        // On-surface
        'on-surface': '#f8f9fa',
        'on-surface-variant': '#b6ac6c',
        'on-background': '#f8eca7',

        // Outline
        outline: '#475569',
        'outline-variant': '#504913',

        // Error
        error: '#ff7351',
        'error-dim': '#d53d18',

        // Dashboard-specific overrides
        'dash-bg': '#0f172a',
        'dash-card': '#1e293b',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-lg': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'headline-sm': ['1.5rem', { lineHeight: '1.3' }],
        'title-md': ['1.125rem', { lineHeight: '1.4' }],
        'body-md': ['0.875rem', { lineHeight: '1.6' }],
        'label-sm': ['0.6875rem', { lineHeight: '1.2', letterSpacing: '0.05em' }],
      },
      boxShadow: {
        'glow-primary': '0 0 25px rgba(255, 225, 136, 0.3), 0 0 50px rgba(255, 225, 136, 0.1)',
        'ambient': '0 0 40px rgba(255, 225, 136, 0.05)',
      },
    },
  },
  plugins: [],
}
