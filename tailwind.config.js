/** @type {import('tailwindcss').Config} */
// ============================================================================
// TO_BE_COPIED: 架构师建项目后复制到项目根的 tailwind.config.js
// ============================================================================
// novel-creator · Tailwind config (Bauhaus / 瑞士极简)
// 严格对齐 design-brief.md 与 design-tokens.md
// 风格：白底、纯黑白灰、1px 细线、2px 圆角、无阴影、无渐变
// ============================================================================
export default {
  darkMode: 'media', // 本项目明确不做深色模式；保留 media 以满足 Tailwind v3.4 警告
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
    },
    extend: {
      colors: {
        // shadcn 命名空间（HSL 格式，对应 globals.css 中的 CSS 变量）
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },

        // 业务命名（HEX 格式，方便直接使用）
        'bg-base':     '#FFFFFF',
        'surface':     '#FAFAFA',
        'surface-2':   '#F5F5F5',
        'border-soft': '#E5E5E5',
        'text':        '#000000',
        'text-2':      '#6B6B6B',
        'text-3':      '#A3A3A3',
        'disabled':    '#BDBDBD',
      },
      borderRadius: {
        // 默认 0，仅按钮 / 输入框 / 徽章 2px
        DEFAULT: '0',
        none:    '0',
        sm:      '0',
        md:      '2px',
        lg:      '2px',
        xl:      '2px',
        full:    '9999px',
      },
      borderWidth: {
        DEFAULT: '1px',
        0:       '0',
        1:       '1px',
        2:       '2px',
        3:       '3px',
      },
      fontFamily: {
        sans:  ['Inter', 'Source Han Sans SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'system-ui', 'sans-serif'],
        serif: ['Source Han Serif SC', 'Noto Serif SC', 'Songti SC', 'SimSun', 'serif'],
        mono:  ['JetBrains Mono', 'Fira Code', 'SF Mono', 'Menlo', 'monospace'],
      },
      fontSize: {
        xs:   ['12px', { lineHeight: '1.5' }],
        sm:   ['13px', { lineHeight: '1.55' }],
        base: ['14px', { lineHeight: '1.6' }],
        md:   ['16px', { lineHeight: '1.55' }],
        lg:   ['18px', { lineHeight: '1.5' }],
        xl:   ['20px', { lineHeight: '1.4' }],
        '2xl':['24px', { lineHeight: '1.3' }],
        '3xl':['30px', { lineHeight: '1.25' }],
        '4xl':['36px', { lineHeight: '1.2' }],
      },
      fontWeight: {
        // 仅 Regular / Medium / Semibold
        normal:   '400',
        medium:   '500',
        semibold: '600',
      },
      spacing: {
        // 8px 基准网格
        0.5: '2px',
        1:   '4px',
        2:   '8px',
        3:   '12px',
        4:   '16px',
        6:   '24px',
        8:   '32px',
        12:  '48px',
        16:  '64px',
      },
      transitionDuration: {
        fast: '100ms',
        base: '180ms',
        slow: '280ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      boxShadow: {
        // 游戏感立体阴影：按钮 / 卡片按压与上浮
        none: 'none',
        DEFAULT: 'none',
        sm: 'none',
        md: 'none',
        lg: 'none',
        xl: 'none',
        game: '0 4px 0 0 #000',
        'game-hover': '0 6px 0 0 #000',
        'game-active': '0 1px 0 0 #000',
        'game-primary': '0 4px 0 0 #333',
        'game-ghost': '0 3px 0 0 #E5E5E5',
        'game-card': '0 4px 0 0 #E5E5E5',
      },
      backgroundImage: {
        // 明确禁止渐变。保留无
        'none': 'none',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
