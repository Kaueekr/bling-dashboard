/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        bling: {
          50: '#f0f7ff',
          100: '#e0effe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        surface: {
          0: '#0a0a0f',
          1: '#12121a',
          2: '#1a1a25',
          3: '#222230',
          4: '#2a2a3a',
        },
        accent: {
          lime: '#c4f442',
          blue: '#60a5fa',
          rose: '#fb7185',
          amber: '#fbbf24',
        }
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui'],
        body: ['var(--font-body)', 'system-ui'],
      },
    },
  },
  plugins: [],
};
