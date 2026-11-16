import tseslint from 'typescript-eslint';

export default [
  { ignores: ['**/dist/**', '**/src/generated/**', '.npm-cache/**'] },
  ...tseslint.configs.recommended,
];

