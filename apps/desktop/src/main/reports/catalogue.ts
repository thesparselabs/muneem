import { AppError } from '@muneem/contracts';
import type { ReportDefinition } from './definition.js';

export class ReportCatalogue {
  private readonly byId = new Map<string, ReportDefinition>();

  constructor(definitions: readonly ReportDefinition[]) {
    for (const d of definitions) {
      if (this.byId.has(d.id)) throw new Error(`duplicate report ${d.id}`);
      this.byId.set(d.id, d);
    }
  }

  list(): ReportDefinition[] { return [...this.byId.values()]; }

  get(id: string): ReportDefinition {
    const d = this.byId.get(id);
    if (!d) throw new AppError('NOT_FOUND', 'Unknown report');
    return d;
  }
}
