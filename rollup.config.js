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
const plugins = [
  // resolve(), // 查找和打包node_modules中的第三方模块
  // commonjs(), // 将 CommonJS 转换成 ES2015 模块供 Rollup 处理
  // typescript() // 解析TypeScript
];
export default [
  {
    input,
    output: {
      format: 'cjs',
      file: './lib/index.cjs.js',
      exports: 'named',
    },
    external,
    plugins: [
      replaceData,
      nodeResolve({ extensions }),
      babel(babelOptions),
      ...plugins,
    ],
  },
  {
    input: `./src/diff.js`,
    output: {
      format: 'cjs',
      file: './lib/diff.js',
      exports: 'named',
    },
    external,
    plugins: [
      replaceData,
      nodeResolve({ extensions }),
      babel(babelOptions),
      ...plugins,
    ],
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
      ...plugins,
    ],
  },
];

// import resolve from 'rollup-plugin-node-resolve';
// import commonjs from 'rollup-plugin-commonjs';
// import typescript from 'rollup-plugin-typescript';
// import pkg from './package.json';

// export default {
//   input: 'src/index.ts', // 打包入口
//   output: { // 打包出口
//     file: pkg.browser, // 最终打包出来的文件路径和文件名，这里是在package.json的browser: 'dist/index.js'字段中配置的
//     format: 'umd', // umd是兼容amd/cjs/iife的通用打包格式，适合浏览器
//   },
//   plugins: [ // 打包插件
//     resolve(), // 查找和打包node_modules中的第三方模块
//     commonjs(), // 将 CommonJS 转换成 ES2015 模块供 Rollup 处理
//     typescript() // 解析TypeScript
//   ]
// };
