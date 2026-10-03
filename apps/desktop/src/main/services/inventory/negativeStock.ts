import type { Product } from '@muneem/contracts';
import type { PosContext } from '../pos/posContext.js';
import { INVENTORY_SETTINGS } from '../pos/register.js';

export type NegativeStockRule = 'block' | 'warn' | 'allow';

// ADR-0020: the product's own rule wins over the business policy.
export function negativeStockRule(ctx: PosContext, product: Pick<Product, 'allowNegativeStock'>): NegativeStockRule {
  if (product.allowNegativeStock === true) return 'allow';
  if (product.allowNegativeStock === false) return 'block';
  return ctx.setting(INVENTORY_SETTINGS.negativeStock, 'warn');
}
