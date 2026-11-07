/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: Object.fromEntries(
        ['paper', 'surface', 'sunken', 'ink', 'muted', 'line', 'line-strong', 'accent', 'ok', 'warn', 'bad'].map(
          (n) => [n, token(n)]
        )
      ),
      fontFamily: {
        // IPs and MACs only: fixed width keeps octets and byte pairs aligned in columns.
        mono: ['ui-monospace', 'Cascadia Mono', 'Consolas', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
