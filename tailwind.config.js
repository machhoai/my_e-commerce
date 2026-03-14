/** @type {import('tailwindcss').Config} */

// Helper to generate a shade map from CSS variable prefix
const tokenShades = (prefix) => {
    const shades = {};
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].forEach(s => {
        shades[s] = `hsl(var(--t-${prefix}-${s}) / <alpha-value>)`;
    });
    shades.DEFAULT = `hsl(var(--t-${prefix}-500) / <alpha-value>)`;
    return shades;
};

module.exports = {
    darkMode: ["class"],
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)'
            },
            colors: {
                // ── Design Tokens ──────────────────────────────
                // Usage: bg-primary-600, text-accent-500, border-success-200, etc.
                primary: tokenShades('primary'),
                accent: tokenShades('accent'),
                success: tokenShades('success'),
                warning: tokenShades('warning'),
                danger: tokenShades('danger'),
                surface: tokenShades('surface'),

                // ── B.Duck Brand ──────────────────────────────
                bduck: {
                    yellow: 'rgb(var(--bduck-yellow) / <alpha-value>)',
                    orange: 'rgb(var(--bduck-orange) / <alpha-value>)',
                    dark:   'rgb(var(--bduck-dark) / <alpha-value>)',
                },
                secondary: {
                    DEFAULT: 'rgb(var(--secondary) / <alpha-value>)',
                    foreground: 'rgb(var(--secondary-foreground) / <alpha-value>)',
                },

                // ── shadcn/ui tokens (keep existing) ───────────
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))'
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))'
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))'
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))'
                },
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                chart: {
                    '1': 'hsl(var(--chart-1))',
                    '2': 'hsl(var(--chart-2))',
                    '3': 'hsl(var(--chart-3))',
                    '4': 'hsl(var(--chart-4))',
                    '5': 'hsl(var(--chart-5))'
                }
            },
            keyframes: {
                pulse: {
                    '0%, 100%': {
                        opacity: '1',
                    },
                    '50%': {
                        opacity: '0.4',
                    },
                },
            },
            animation: {
                pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
        }
    },
    plugins: [require("tailwindcss-animate")],
}