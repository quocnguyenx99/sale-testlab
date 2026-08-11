/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--color-background)',
        surface: 'var(--color-surface)',
        line: 'var(--color-border)',
        ink: 'var(--color-text-primary)',
        muted: 'var(--color-text-secondary)',
        brand: 'var(--color-primary)',
      },
      boxShadow: {
        card: '0 8px 30px rgba(15, 31, 61, 0.06)',
        float: '0 18px 50px rgba(15, 31, 61, 0.14)',
      },
      borderRadius: {
        card: '1.25rem',
      },
    },
  },
  plugins: [],
}
