/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F5F7FB',
        surface: {
          DEFAULT: '#FFFFFF',
          subtle: '#F8FAFC',
          elevated: '#FFFFFF',
          hover: '#F8FAFC',
        },
        border: {
          DEFAULT: '#E4E9F0',
          strong: '#D0D7E2',
        },
        ink: {
          DEFAULT: '#172033',
          secondary: '#667085',
          muted: '#98A2B3',
        },
        brand: {
          DEFAULT: '#0068FF',
          hover: '#0059DE',
          pressed: '#004BC2',
          soft: '#EAF2FF',
          subtle: '#F3F7FF',
          border: '#B8D4FF',
        },
        success: {
          DEFAULT: '#087A55',
          soft: '#ECFDF3',
        },
        warning: {
          DEFAULT: '#B54708',
          soft: '#FFFAEB',
        },
        danger: {
          DEFAULT: '#B42318',
          soft: '#FEF3F2',
        },
        info: {
          DEFAULT: '#175CD3',
          soft: '#EFF8FF',
        },
        focus: '#0068FF',
      },
      boxShadow: {
        subtle: '0 1px 2px rgba(23, 32, 51, 0.04)',
        card: '0 1px 2px rgba(23, 32, 51, 0.04)',
        brand: '0 4px 10px rgba(0, 104, 255, 0.16)',
        dropdown: '0 10px 28px rgba(31, 55, 88, 0.14)',
        dialog: '0 24px 56px rgba(31, 55, 88, 0.20)',
        drawer: '12px 0 40px rgba(31, 55, 88, 0.18)',
        float: '0 20px 40px rgba(31, 55, 88, 0.16)',
      },
      borderRadius: {
        card: '0.75rem',
      },
    },
  },
  plugins: [],
}
