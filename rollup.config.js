import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import pkg from './package.json' assert { type: 'json' };

export default [
  // Browser
  {
    input: 'src/index.ts',
    output: {
      name: 'zod-defaults',
      file: pkg.browser,
      format: 'umd',
    },
    plugins: [
      resolve(),
      commonjs(),
      typescript({ tsconfig: './tsconfig.json' }),
    ],
  },

  // NodeJS
  {
    input: 'src/index.ts',
    output: [
      { file: pkg.main, format: 'cjs' },
      { file: pkg.module, format: 'es' },
    ],
    external: ['zod'],
    plugins: [typescript({ tsconfig: './tsconfig.json' })],
  },
];
