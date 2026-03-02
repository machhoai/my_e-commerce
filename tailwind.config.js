/** @type {import('tailwindcss').Config} */
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
                primary: '#1b51a3',
                accent: '#F6F6F6',
                secondary: '#727272',
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
                // Ghi đè lên tên 'pulse' mặc định của Tailwind
                pulse: {
                    '0%, 100%': {
                        opacity: '1',
                        // XÓA BỎ DÒNG NÀY: transform: scale(1)
                    },
                    '50%': {
                        opacity: '0.4', // Giảm độ mờ xuống 0.4 (bạn có thể chỉnh con số này tùy thích, VD: 0.5)
                        // XÓA BỎ DÒNG NÀY: transform: scale(1.05) hoặc bất kỳ scale nào
                    },
                },
            },
            animation: {
                // Tên class vẫn là animate-pulse để không phải sửa code ở các file khác
                pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                // Bạn có thể chỉnh 2s thành nhanh hơn (VD: 1.5s) hoặc cubic-bezier khác để mượt hơn
            },
        }
    },
    plugins: [require("tailwindcss-animate")],
}