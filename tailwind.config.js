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
        navy: { DEFAULT: '#0B1F3A', 600: '#13294A', 500: '#1C3358' },
        brand: { DEFAULT: '#0E8A94', dark: '#0A6E76', bright: '#2CC5CD', tint: '#E3F5F6', ring: '#6FCCD2' },
        orange: { DEFAULT: '#FF4700', dark: '#E03E00', tint: '#FFE9E0' },
        // Metric accents
        fsc: { DEFAULT: '#0E8A94', tint: '#E3F5F6' },
        crc: { DEFAULT: '#6C5CE0', tint: '#ECEAFB' },
        aup: { DEFAULT: '#FF4700', tint: '#FFE9E0' },
        positive: '#2F7D5B',
        warn: '#B7791F',
        danger: '#C2453B',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: { '2xs': ['0.6875rem', { lineHeight: '0.875rem' }] },
      boxShadow: {
        card: '0 1px 2px rgba(21,24,30,0.04), 0 1px 3px rgba(21,24,30,0.06)',
        pop: '0 8px 28px rgba(21,24,30,0.12)',
        lift: '0 6px 20px rgba(21,24,30,0.10)',
      },
      borderRadius: { xl: '0.75rem', '2xl': '1rem' },
      keyframes: {
        fadeUp: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        scaleIn: { '0%': { opacity: '0', transform: 'scale(0.97)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        pop: { '0%': { transform: 'scale(0.9)' }, '60%': { transform: 'scale(1.04)' }, '100%': { transform: 'scale(1)' } },
        barGrow: { '0%': { transform: 'scaleY(0)' }, '100%': { transform: 'scaleY(1)' } },
      },
      animation: {
        fadeUp: 'fadeUp 0.45s cubic-bezier(0.22,1,0.36,1) both',
        fadeIn: 'fadeIn 0.4s ease both',
        scaleIn: 'scaleIn 0.28s cubic-bezier(0.22,1,0.36,1) both',
        slideUp: 'slideUp 0.5s cubic-bezier(0.22,1,0.36,1) both',
        pop: 'pop 0.3s ease both',
      },
    },
  },
  plugins: [],
}
