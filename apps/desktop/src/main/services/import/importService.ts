import type { ImportCommitInput, ImportPreview, ImportPreviewInput, ImportRow, ImportSummary } from '@muneem/contracts';
import { createProduct, getMeta, getProduct, setMeta, updateProduct, withTransaction } from '@muneem/db-sqlite';
import type { CatalogContext } from '../catalogContext.js';
import { DbCatalogLookup } from './catalogLookup.js';
import { suggestMapping } from './columnMapping.js';
import { planImport, toProductInput, type ImportPlan, type PlannedRow } from './importPlanner.js';
import type { PreviewStore } from './previewStore.js';
import { mergeForUpdate } from './productMerge.js';
import { readTable } from './tableReader.js';

const MAX_PROBLEM_ROWS = 500;
const SAMPLE_OK_ROWS = 20;

const toImportRow = (r: PlannedRow): ImportRow => ({
  line: r.line, status: r.status, errors: r.errors as Record<string, string>,
  ...(r.draft.name && { name: r.draft.name }),
  ...(r.draft.sku && { sku: r.draft.sku }),
  ...(r.existingProductId && { existingProductId: r.existingProductId }),
});

function previewRows(plan: ImportPlan): ImportRow[] {
  const problems = plan.rows.filter((r) => r.status !== 'ok').slice(0, MAX_PROBLEM_ROWS);
  const sample = plan.rows.filter((r) => r.status === 'ok').slice(0, SAMPLE_OK_ROWS);
  return [...problems, ...sample].map(toImportRow);
}

export class ImportService {
  constructor(private readonly ctx: CatalogContext, private readonly previews: PreviewStore, private readonly onChange: () => void) {}

  async preview(input: ImportPreviewInput): Promise<ImportPreview> {
    const businessId = this.ctx.businessId();
    const session = input.importId
      ? this.previews.get(input.importId, businessId)
      : await this.load(businessId, input.fileName!, input.contentBase64!);
    if (input.mapping) this.previews.update(Object.assign(session, { mapping: input.mapping }));
    const plan = planImport(session.table, session.mapping, new DbCatalogLookup(this.ctx.db(), businessId));
    const count = (s: PlannedRow['status']) => plan.rows.filter((r) => r.status === s).length;
    return {
      importId: session.id, fileName: session.fileName, columns: session.table.columns, mapping: session.mapping,
      counts: { total: plan.rows.length, ok: count('ok'), errors: count('error'), duplicates: count('duplicate') },
      rows: previewRows(plan), willCreate: plan.willCreate,
    };
  }

  commit(input: ImportCommitInput): ImportSummary {
    const db = this.ctx.db();
    const businessId = this.ctx.businessId();
    const doneKey = `import:${input.commandId}`;
    const done = getMeta(db, doneKey);
    if (done) return JSON.parse(done) as ImportSummary;
    const session = this.previews.get(input.importId, businessId);
    const actor = this.ctx.actor();
    const on = this.ctx.today();
    const summary = withTransaction(db, () => {
      const lookup = new DbCatalogLookup(db, businessId);
      const plan = planImport(session.table, session.mapping, lookup);
      const result = { created: 0, updated: 0, skippedDuplicates: 0, skippedErrors: 0 };
      for (const row of plan.rows) {
        if (row.status === 'error') { result.skippedErrors++; continue; }
        if (row.status === 'duplicate' && input.duplicatePolicy === 'skip') { result.skippedDuplicates++; continue; }
        const refs = {
          baseUomId: lookup.ensureUom(row.draft.uomCode, actor),
          categoryId: lookup.ensureCategory(row.draft.category, actor),
          brandId: lookup.ensureBrand(row.draft.brand, actor),
        };
        if (row.existingProductId) {
          updateProduct(db, mergeForUpdate(getProduct(db, row.existingProductId, on)!, row.draft, refs), actor, on);
          result.updated++;
        } else {
          createProduct(db, businessId, toProductInput(row.draft, refs), actor, on);
          result.created++;
        }
      }
      const s: ImportSummary = {
        ...result, categoriesCreated: lookup.created.categories, brandsCreated: lookup.created.brands, uomsCreated: lookup.created.uoms,
      };
      setMeta(db, doneKey, JSON.stringify(s));
      return s;
    });
    this.previews.delete(session.id);
    this.onChange();
    return summary;
  }

  private async load(businessId: string, fileName: string, contentBase64: string) {
    const table = await readTable(fileName, Buffer.from(contentBase64, 'base64'));
    return this.previews.put({ businessId, fileName, table, mapping: suggestMapping(table.columns) });
  }
}
