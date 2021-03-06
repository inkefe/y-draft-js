import { defineConfig } from 'vite';
import reactRefresh from '@vitejs/plugin-react-refresh';
import react from '@vitejs/plugin-react';
import path from 'path';
import pkg from './package.json';
// https://vitejs.dev/config/
export default defineConfig({
  root: 'public/',
  define: {
    VERSION: `"${pkg.version}"`,
  },
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
      'y-draft-js': path.resolve(__dirname, 'src/index.js'),
    },
  },
  optimizeDeps: {
    entries: [],
  },
});
