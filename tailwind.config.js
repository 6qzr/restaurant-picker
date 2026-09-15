/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,jsx}'],
    theme: {
        extend: {
            fontFamily: {
                // Inter has no Arabic coverage; roughly a third of the places in
                // this dataset are Arabic-named, so we fall through to the OS
                // Arabic face rather than shipping an Arabic webfont.
                sans: [
                    'Inter Variable', 'Inter', '-apple-system', 'BlinkMacSystemFont',
                    'Segoe UI', 'Noto Sans Arabic', 'Geeza Pro', 'system-ui', 'sans-serif',
                ],
            },
            /* Tracking and leading are size-specific. A single global
               letter-spacing is wrong at one end of the scale or the other. */
            fontSize: {
                xs: ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.01em' }],
                sm: ['0.875rem', { lineHeight: '1.5', letterSpacing: '0' }],
                base: ['1rem', { lineHeight: '1.5', letterSpacing: '0' }],
                lg: ['1.125rem', { lineHeight: '1.35', letterSpacing: '-0.01em' }],
                xl: ['1.3rem', { lineHeight: '1.25', letterSpacing: '-0.015em' }],
                '2xl': ['1.65rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
                '3xl': ['2.1rem', { lineHeight: '1.08', letterSpacing: '-0.025em' }],
            },
            colors: {
                paper: 'var(--paper)',
                surface: 'var(--surface)',
                ink: 'var(--ink)',
                gold: 'var(--gold)',
                accent: 'var(--accent)',
                danger: 'var(--danger)',
            },
        },
    },
    plugins: [],
};
