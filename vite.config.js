import { defineConfig } from 'vite';
import reactRefresh from '@vitejs/plugin-react-refresh';
import react from '@vitejs/plugin-react';
import linaria from 'vite-plugin-linaria-styled';
import path from 'path';
// https://vitejs.dev/config/
export default defineConfig({
  root: 'public/',
  plugins: [
    react({
      babel: {
        plugins: ['@babel/plugin-transform-react-jsx'],
      },
    }),
    // reactRefresh(),
    // linaria({
    //   sourceMap: true,
    //   classNameSlug: '[title]-[hash]',
    //   cacheDirectory: '.linaria-cache',
    // }),
  ],
  resolve: {
    alias: {
      'y-draft-js': path.resolve(__dirname, 'src/y-draft-js.js'),
    },
  },
  build: {
    rollupOptions: {
      input: [],
    },
  },
  optimizeDeps: {
    entries: [],
  },
});
