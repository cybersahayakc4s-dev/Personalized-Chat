/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--bg-canvas)',
        sidebar: 'var(--bg-sidebar)',
        rail: 'var(--bg-rail)',
        surface: 'var(--bg-surface)',
        'surface-hover': 'var(--bg-surface-hover)',
        subtle: 'var(--border-subtle)',
        focus: 'var(--border-focus)',
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'accent-muted': 'var(--accent-muted)',
        danger: 'var(--danger)',
        'border-subtle': 'var(--border-subtle)',
        'border-focus': 'var(--border-focus)',
        'border-accent': 'var(--accent)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        'text-accent': 'var(--accent)',
        'text-danger': 'var(--danger)',
        'bg-canvas': 'var(--bg-canvas)',
        'bg-sidebar': 'var(--bg-sidebar)',
        'bg-rail': 'var(--bg-rail)',
        'bg-surface': 'var(--bg-surface)',
        'bg-surface-hover': 'var(--bg-surface-hover)',
        'bg-accent': 'var(--accent)',
        'bg-accent-hover': 'var(--accent-hover)',
        'bg-accent-muted': 'var(--accent-muted)',
        'bg-danger': 'var(--danger)'
      }
    }
  },
  plugins: []
};
