/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: '#0f172a',
                primary: '#f8fafc', // slate-50
                secondary: '#94a3b8', // slate-400
                accent: '#38bdf8', // sky-400
                'accent-hover': '#0ea5e9', // sky-500
                danger: '#ef4444', // red-500
                success: '#22c55e', // green-500
                'glass-border': 'rgba(255, 255, 255, 0.1)',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            borderRadius: {
                'lg': '16px',
                'md': '12px',
                'sm': '8px',
                'xs': '4px',
            }
        },
    },
    plugins: [],
}
