export interface ReportRange { businessId: string; from: string; to: string; branchId: string | null }

// The document filter every range report shares; `a` is the table alias and `date` its business-date column.
export const inRange = (a: string, date = 'doc_date'): string =>
  `${a}.business_id = @businessId AND ${a}.${date} BETWEEN @from AND @to AND (@branchId IS NULL OR ${a}.branch_id = @branchId)`;

export const rangeParams = (r: ReportRange) => ({ businessId: r.businessId, from: r.from, to: r.to, branchId: r.branchId });
