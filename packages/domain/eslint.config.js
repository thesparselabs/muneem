// Money-safety lint (LLD §1.2): nothing in the domain package may use float rounding
// or float division on financial identifiers. divRound/pctOf/apportion are the only paths.
import tseslint from 'typescript-eslint';

const FINANCIAL = /paise|qty|bp|amount|price|rate|total|tax|discount|cess|gross|taxable/i;

const noFloatMoney = {
  meta: { type: 'problem', docs: { description: 'No float arithmetic on money' } },
  create(ctx) {
    const nameOf = (n) =>
      n.type === 'Identifier' ? n.name : n.type === 'MemberExpression' ? nameOf(n.property) : '';
    return {
      CallExpression(node) {
        const c = node.callee;
        if (c.type === 'MemberExpression') {
          const obj = c.object.type === 'Identifier' ? c.object.name : '';
          const prop = nameOf(c.property);
          if (obj === 'Math' && (prop === 'round' || prop === 'trunc' || prop === 'ceil')) {
            ctx.report({ node, message: `Math.${prop} is banned in domain code; use divRound` });
          }
          if (prop === 'toFixed') ctx.report({ node, message: 'toFixed is banned in domain code' });
        }
      },
      BinaryExpression(node) {
        if (node.operator === '/' && (FINANCIAL.test(nameOf(node.left)) || FINANCIAL.test(nameOf(node.right)))) {
          ctx.report({ node, message: 'Float division on a financial value; use divRound' });
        }
      },
    };
  },
};

export default tseslint.config(
  { ignores: ['dist/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    plugins: { money: { rules: { 'no-float-money': noFloatMoney } } },
    rules: { 'money/no-float-money': 'error' },
  },
);
