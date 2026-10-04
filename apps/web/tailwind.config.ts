import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: {
        '2xl': '1440px',
      },
    },
    extend: {
      colors: {
        // Calm Density Tokens
        'bg-app': 'var(--bg-app)',
        'bg-surface': 'var(--bg-surface)',
        'bg-raised': 'var(--bg-raised)',
        'border-token': 'var(--border)',
        'border-strong': 'var(--border-strong)',
        'text-main': 'var(--text)',
        'text-muted': 'var(--text-muted)',
        'text-faint': 'var(--text-faint)',

        // Brand colors
        'brand-solid': 'var(--brand-solid)',
        'brand-solid-text': 'var(--brand-solid-text)',
        'brand-hover': 'var(--brand-hover)',
        'brand-text': 'var(--brand-text)',
        'brand-soft': 'var(--brand-soft)',
        'focus-ring': 'var(--focus-ring)',

        // Status Colors
        'status-success': 'var(--status-success-fg)',
        'status-success-bg': 'var(--status-success-bg)',
        'status-success-border': 'var(--status-success-border)',

        'status-info': 'var(--status-info-fg)',
        'status-info-bg': 'var(--status-info-bg)',
        'status-info-border': 'var(--status-info-border)',

        'status-warning': 'var(--status-warning-fg)',
        'status-warning-bg': 'var(--status-warning-bg)',
        'status-warning-border': 'var(--status-warning-border)',

        'status-danger': 'var(--status-danger-fg)',
        'status-danger-bg': 'var(--status-danger-bg)',
        'status-danger-border': 'var(--status-danger-border)',

        'status-neutral': 'var(--status-neutral-fg)',
        'status-neutral-bg': 'var(--status-neutral-bg)',
        'status-neutral-border': 'var(--status-neutral-border)',

        // Component mapping aliases
        border: 'var(--border)',
        input: 'var(--border)',
        ring: 'var(--focus-ring)',
        background: 'var(--bg-app)',
        foreground: 'var(--text)',
        surface: 'var(--bg-surface)',
        raised: 'var(--bg-raised)',
        primary: {
          DEFAULT: 'var(--brand-solid)',
          foreground: 'var(--brand-solid-text)',
        },
        secondary: {
          DEFAULT: 'var(--bg-surface)',
          foreground: 'var(--text)',
        },
        destructive: {
          DEFAULT: 'var(--status-danger-fg)',
          foreground: '#FFFFFF',
        },
        muted: {
          DEFAULT: 'var(--bg-raised)',
          foreground: 'var(--text-muted)',
        },
        card: {
          DEFAULT: 'var(--bg-surface)',
          foreground: 'var(--text)',
        },
        popover: {
          DEFAULT: 'var(--bg-surface)',
          foreground: 'var(--text)',
        },
      },
      borderRadius: {
        DEFAULT: '6px',
        sm: '6px',
        md: '6px',
        lg: '8px',
        xl: '8px',
        panel: '8px',
      },
      boxShadow: {
        popover: 'var(--shadow-elevation)',
        modal: 'var(--shadow-elevation)',
      },
      transitionDuration: {
        DEFAULT: '120ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'ease-out',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'JetBrains Mono', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      keyframes: {
        latePulse: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.3', transform: 'scale(0.85)' },
        },
      },
      animation: {
        'late-pulse': 'latePulse 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
