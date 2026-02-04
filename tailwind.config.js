/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                serif: ['Playfair Display', 'serif'], // For headings/elegant touches
            },
            colors: {
                // Timeless Palette: High contrast, paper-like backgrounds, deep inks.
                paper: '#f8f5f2', // Off-white/cream
                ink: '#2d2a2e',   // Soft Black
                gold: '#c5a059',  // Accent
                // Functional
                success: '#2e7d32',
                danger: '#d32f2f',
            },
            animation: {
                'spin-slow': 'spin 3s linear infinite',
                'fade-in': 'fadeIn 0.5s ease-out forwards',
                'slide-up': 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(20px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                }
            }
        },
    },
    plugins: [],
}
