/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        'c-bg':         'var(--c-bg)',
        'c-surface':    'var(--c-surface)',
        'c-surfaceHi':  'var(--c-surfaceHi)',
        'c-border':     'var(--c-border)',
        'c-borderHi':   'var(--c-borderHi)',
        'c-text':       'var(--c-text)',
        'c-textMuted':  'var(--c-textMuted)',
        'c-textDim':    'var(--c-textDim)',
        'c-accent':     'var(--c-accent)',
        'c-accentHot':  'var(--c-accentHot)',
        'c-diamond':    'var(--c-diamond)',
        'c-foul':       'var(--c-foul)',
        'c-bone':       'var(--c-bone)',
        'c-legit':      'var(--c-legit)',
        'c-mickey':     'var(--c-mickey)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        ui:      ['var(--font-ui)',      'system-ui', 'sans-serif'],
        mono:    ['var(--font-mono)',    'ui-monospace', 'monospace'],
        digital: ['var(--font-digital)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
