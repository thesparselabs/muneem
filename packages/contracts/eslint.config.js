import tseslint from 'typescript-eslint';
export default tseslint.config({ ignores: ['dist/**', 'src/http/generated.ts'] }, ...tseslint.configs.recommended);
