import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

export default [
  // Browser
  {
    input: 'src/index.ts',
    output: {
      name: 'zod-defaults',
      file: "dist/zod-defaults.umd.js",
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
      { file: "dist/zod-defaults.cjs", format: 'cjs' },
      { file: "dist/zod-defaults.esm.js", format: 'es' },
    ],
    external: ['zod'],
    plugins: [typescript({ tsconfig: './tsconfig.json' })],
  },
];
