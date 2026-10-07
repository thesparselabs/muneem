import type { PartyType } from '@muneem/domain';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';

const TABLE: Record<PartyType, string> = { customer: 'customer', supplier: 'supplier' };

// A party already on file with this GSTIN or this exact phone number; names alone are not treated as a match.
export function findPartyId(db: Db, businessId: string, partyType: PartyType, by: { gstin?: string | undefined; phone?: string | undefined }): string | null {
  const t = TABLE[partyType];
  const byGstin = by.gstin ? stmt(db, `SELECT id FROM ${t} WHERE business_id = ? AND gstin = ? AND deleted_at IS NULL`).pluck().get(businessId, by.gstin) : undefined;
  if (byGstin) return byGstin as string;
  const byPhone = by.phone ? stmt(db, `SELECT id FROM ${t} WHERE business_id = ? AND phone = ? AND deleted_at IS NULL LIMIT 1`).pluck().get(businessId, by.phone) : undefined;
  return (byPhone as string | undefined) ?? null;
}
