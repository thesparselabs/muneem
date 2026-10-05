import type { Dashboard, StockRow } from '@muneem/contracts';
import { dashboardFigures, type Db } from '@muneem/db-sqlite';

export const TREND_DAYS = 30;
const TOP_PRODUCTS = 5;
const LOW_STOCK_SHOWN = 8;

export interface DashboardDeps { readDb: () => Db; businessId: () => string; today: () => string; lowStock: () => StockRow[] }

// FR-072: the Home screen's figures, all local, so it works offline; low stock is this branch's warehouse, as on the stock screen.
export class DashboardService {
  constructor(private readonly d: DashboardDeps) {}

  get(): Dashboard {
    const today = this.d.today();
    const { today: sales, ...f } = dashboardFigures(this.d.readDb(), { businessId: this.d.businessId(), today, days: TREND_DAYS, topN: TOP_PRODUCTS });
    const low = this.d.lowStock();
    return {
      today, sales, ...f,
      lowStock: { count: low.length, items: low.slice(0, LOW_STOCK_SHOWN).map((r) => ({ productId: r.productId, name: r.name, uomCode: r.uomCode, qtyMilli: r.qtyMilli })) },
    };
  }
}
