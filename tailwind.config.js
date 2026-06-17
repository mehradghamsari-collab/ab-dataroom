/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#15181E',
        paper: '#FAFAF7',
        surface: '#FFFFFF',
        line: '#E8E6DF',
        muted: '#6C7077',
        subtle: '#9AA0A6',
        // A&B Smart Materials brand
        navy: {
          DEFAULT: '#0B1F3A',
          600: '#13294A',
          500: '#1C3358',
        },
        brand: {
          DEFAULT: '#0E8A94',
          dark: '#0A6E76',
          bright: '#2CC5CD',
          tint: '#E3F5F6',
          ring: '#6FCCD2',
        },
        orange: {
          DEFAULT: '#FF4700',
          dark: '#E03E00',
          tint: '#FFE9E0',
        },
        positive: '#2F7D5B',
        warn: '#B7791F',
        danger: '#C2453B',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '0.875rem' }],
      },
      boxShadow: {
        card: '0 1px 2px rgba(21,24,30,0.04), 0 1px 3px rgba(21,24,30,0.06)',
        pop: '0 8px 28px rgba(21,24,30,0.12)',
      },
      borderRadius: { xl: '0.75rem' },
    },
  },
  plugins: [],
}
