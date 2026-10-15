import type { Config } from 'tailwindcss';
// Design tokens live as CSS variables in app/globals.css; Tailwind maps to them
// so new components can use utilities without drifting from the brand.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)', surface: 'var(--surface)', sunk: 'var(--sunk)', line: 'var(--line)',
        fg: 'var(--fg)', fg2: 'var(--fg2)', fg3: 'var(--fg3)', accent: 'var(--accent)',
        crit: 'var(--crit)', warn: 'var(--warn)', ok: 'var(--ok)', info: 'var(--info)',
      },
      fontFamily: { display: 'var(--display)', body: 'var(--body)', mono: 'var(--mono)' },
    },
  },
  plugins: [],
};
export default config;
