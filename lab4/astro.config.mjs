import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://ekkusuu.github.io',
  base: '/web-repo/lab4',
  vite: {
    plugins: [tailwindcss()],
  },
});
