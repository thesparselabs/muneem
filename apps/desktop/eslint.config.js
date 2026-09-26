import tseslint from 'typescript-eslint';
export default tseslint.config(
  { ignores: ['out/**', 'release/**', 'native/**', 'src/preload/generated.ts'] },
  ...tseslint.configs.recommended,
  { rules: { '@typescript-eslint/no-explicit-any': 'off' } },
);
