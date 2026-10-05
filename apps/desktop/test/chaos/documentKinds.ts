export const DOCUMENT_KINDS = ['returns', 'purchases', 'payments', 'setoff', 'yearEnd'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
