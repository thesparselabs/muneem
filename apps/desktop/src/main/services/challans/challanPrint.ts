import { CHALLAN_PURPOSE_LABELS, type Challan } from '@muneem/contracts';
import type { DocumentVariant } from '../invoice/invoiceData.js';

const MODES = { road: 'Road', rail: 'Rail', air: 'Air', ship: 'Ship' } as const;

// A challan prints on the shop's invoice template with what CGST Rule 55 and a later e-way bill need: purpose and transport.
export function challanVariant(c: Challan): DocumentVariant {
  const t = c.transport;
  const rows = [
    { label: 'Purpose', value: CHALLAN_PURPOSE_LABELS[c.purpose] },
    { label: 'Transport', value: [MODES[t.mode], t.vehicleNo].filter(Boolean).join(' · ') },
    ...(t.transporterName || t.transporterId ? [{ label: 'Transporter', value: [t.transporterName, t.transporterId].filter(Boolean).join(' · ') }] : []),
    ...(t.distanceKm !== undefined ? [{ label: 'Distance', value: `${t.distanceKm} km` }] : []),
    ...(t.docNo ? [{ label: 'LR / transport doc', value: t.docNo }] : []),
    ...(c.notes ? [{ label: 'Note', value: c.notes }] : []),
  ];
  return { title: 'Delivery Challan', numberLabel: 'Challan No', buyerLabel: 'Consignee', declaration: false, rows };
}

export const challanFileName = (c: Pick<Challan, 'docNumber'>): string => `challan-${c.docNumber}`;
