import type { Config } from "tailwindcss";

/**
 * Tailwind Config
 * ------------------------------------------------------------
 * This tells Tailwind where to look for class names so it can
 * generate the correct CSS.
 *
 * Your project uses the Next.js App Router inside /src/app,
 * and you also have components inside /src/app/components.
 *
 * If these paths are missing, Tailwind won't generate styles
 * for those files → your modal will look "unstyled".
 */
const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",        // App Router pages/layouts
    "./src/app/components/**/*.{js,ts,jsx,tsx,mdx}", // Your components folder
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",      // If you ever add /pages
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}", // If you ever add /components
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;