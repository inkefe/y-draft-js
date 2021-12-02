import path from 'path';
import nodeResolve from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
import replace from '@rollup/plugin-replace';
import { existsSync } from 'fs';
import pkg from './package.json';

// const input = existsSync('./src/index.ts')
//   ? './src/index.ts'
//   : './src/index.tsx';
const external = id => !id.startsWith('.') && !path.isAbsolute(id);
const extensions = ['.ts', '.js', '.tsx', '.jsx'];
const babelOptions = {
  rootMode: 'upward',
  extensions,
  babelHelpers: 'bundled',
};
const index = extensions.findIndex(ext => existsSync(`./src/index${ext}`));
const input = `./src/index${extensions[index]}`;

const replaceData = replace({
  preventAssignment: true,
  VERSION: JSON.stringify(pkg.version),
});
export default [
  {
    input,
    output: {
      format: 'cjs',
      file: './lib/index.cjs.js',
      exports: 'named',
    },
    external,
    plugins: [replaceData, nodeResolve({ extensions }), babel(babelOptions)],
  },
  {
    input,
    output: {
      format: 'esm',
      file: './lib/index.esm.js',
    },
    external,
    plugins: [
      nodeResolve({ extensions }),
      replaceData,
      babel({
        ...babelOptions,
        plugins: [
          [
            'babel-plugin-transform-rename-import',
            {
              replacements: [],
            },
          ],
        ],
      }),
    ],
  },
];
