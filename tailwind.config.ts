import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          navy:         '#00250e',
          'navy-light': '#0a3d22',
          'navy-dark':  '#001a09',
          'navy-muted': '#2f5a44',
          // Warning/highlight token — used for "needs attention" states like
          // today's not-yet-completed cleans. Matches the amber already used
          // ad-hoc elsewhere in the portal (weekend catch-up, bond cleans).
          warning:       '#f59e0b',
          'warning-tint': '#fef3c7',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
