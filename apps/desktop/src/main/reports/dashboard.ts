import type { Dashboard, DashboardPeriod, StockRow } from '@muneem/contracts';
import { dashboardFigures, type Db } from '@muneem/db-sqlite';

export const TREND_DAYS = 30;
const WINDOW_DAYS: Record<DashboardPeriod, number> = { today: 1, week: 7, month: 30 };
const TREND_DAYS_BY_PERIOD: Record<DashboardPeriod, number> = { today: TREND_DAYS, week: 7, month: TREND_DAYS };
const TOP_PRODUCTS = 5;
const LOW_STOCK_SHOWN = 8;

export interface DashboardDeps { readDb: () => Db; businessId: () => string; today: () => string; lowStock: () => StockRow[] }

// FR-072: the Home screen's figures, all local, so it works offline; low stock is this branch's warehouse, as on the stock screen.
export class DashboardService {
  constructor(private readonly d: DashboardDeps) {}

  get(period: DashboardPeriod = 'today'): Dashboard {
    const today = this.d.today();
    const { today: sales, ...f } = dashboardFigures(this.d.readDb(), { businessId: this.d.businessId(), today, days: TREND_DAYS_BY_PERIOD[period], topN: TOP_PRODUCTS, windowDays: WINDOW_DAYS[period] });
    const low = this.d.lowStock();
    return {
      today, period, sales, ...f,
      lowStock: { count: low.length, items: low.slice(0, LOW_STOCK_SHOWN).map((r) => ({ productId: r.productId, name: r.name, uomCode: r.uomCode, qtyMilli: r.qtyMilli })) },
    };
  }
}
