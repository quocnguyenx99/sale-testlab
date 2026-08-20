/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F7F8FA',
        surface: {
          DEFAULT: '#FFFFFF',
          subtle: '#F3F5F7',
          hover: '#F8FAFC',
        },
        border: {
          DEFAULT: '#E5E7EB',
          strong: '#D0D5DD',
        },
        ink: {
          DEFAULT: '#111827',
          secondary: '#667085',
          muted: '#98A2B3',
        },
        brand: {
          DEFAULT: '#4F46E5',
          hover: '#4338CA',
          soft: '#EEF2FF',
          border: '#C7D2FE',
        },
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(16, 24, 40, 0.04)',
        card: '0 1px 3px 0 rgba(16, 24, 40, 0.06), 0 1px 2px -1px rgba(16, 24, 40, 0.06)',
        dropdown: '0 4px 6px -2px rgba(16, 24, 40, 0.05), 0 12px 16px -4px rgba(16, 24, 40, 0.08)',
        float: '0 8px 8px -4px rgba(16, 24, 40, 0.03), 0 20px 24px -4px rgba(16, 24, 40, 0.08)',
      },
      borderRadius: {
        card: '0.75rem',
      },
    },
  },
  plugins: [],
}
