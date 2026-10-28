import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Space Grotesk"', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        paper: '#FAF7F0',
        paperDark: '#F3EEDF',
        coral: '#FF5A5F',
        coralHover: '#E04A4E',
        ink: '#18181B',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        '3xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      boxShadow: {
        'brutal-sm': '2px 2px 0px 0px #18181B',
        'brutal': '3px 3px 0px 0px #18181B',
        'brutal-lg': '4px 4px 0px 0px #18181B',
        'brutal-xl': '6px 6px 0px 0px #18181B',
      },
    },
  },
  plugins: [],
};
export default config;
