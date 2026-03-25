/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Dark theme base
        bg:      '#0d0d0d',
        surface: '#161616',
        border:  '#2a2a2a',
        muted:   '#888',
        // Accent
        accent:  '#f5c518',
      },
      fontFamily: {
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
