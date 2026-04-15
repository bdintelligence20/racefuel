
/** @type {import('tailwindcss').Config} */
export default {
  content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        surfaceHighlight: 'var(--color-surfaceHighlight)',
        accent: {
          DEFAULT: 'var(--color-accent)',
          light: 'var(--color-accent-light)',
          muted: 'var(--color-accent-muted)',
        },
        warm: {
          DEFAULT: 'var(--color-warm)',
          light: 'var(--color-warm-light)',
          muted: 'var(--color-warm-muted)',
        },
        golden: 'var(--color-golden)',
        terrain: {
          rust: 'var(--color-terrain-rust)',
          deep: 'var(--color-terrain-deep)',
          orange: 'var(--color-terrain-orange)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
        }
      },
      fontFamily: {
        display: ['"Montserrat"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'terrain-gradient': 'linear-gradient(180deg, #FFCD6B 0%, #F5A020 25%, #E8671A 50%, #C94A1A 75%, #3D2152 100%)',
        'terrain-gradient-soft': 'linear-gradient(180deg, #FFF9F0 0%, #FFCD6B 50%, #F5A020 100%)',
        'sky-gradient': 'linear-gradient(180deg, #FFCD6B 0%, #F5A020 100%)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 3s ease-in-out infinite',
        'slide-up': 'slide-up 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 15px rgba(245, 160, 32, 0.3)' },
          '50%': { opacity: '.8', boxShadow: '0 0 5px rgba(245, 160, 32, 0.1)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
      }
    },
  },
  plugins: [],
}
