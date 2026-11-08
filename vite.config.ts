import { fileURLToPath } from 'node:url';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vitest/config';
import { pseudolocales } from './build/vite-plugin-pseudolocales.ts';

const page = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  // Relative asset URLs, so the build works from any static host and sub-path.
  base: './',
  plugins: [preact(), pseudolocales()],
  build: {
    target: 'es2022',
    rolldownOptions: {
      input: {
        control: page('./index.html'),
        display: page('./display/index.html'),
        fleet: page('./fleet/index.html'),
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    environment: 'node',
  },
});
