import { defineConfig } from 'vite';
import reactRefresh from '@vitejs/plugin-react-refresh';
import react from '@vitejs/plugin-react'
import linaria from 'vite-plugin-linaria-styled';

// https://vitejs.dev/config/
export default defineConfig({
  root: 'public/',
  plugins: [
    reactRefresh(),
    react({
      babel: {
        plugins: ['@babel/plugin-transform-react-jsx'],
      }
    })
    // linaria({
    //   sourceMap: true,
    //   classNameSlug: '[title]-[hash]',
    //   cacheDirectory: '.linaria-cache',
    // }),
  ],
  build:{
    rollupOptions:{
      input:[]
    }
  },
  optimizeDeps: {
    entries: [],
  },
});
