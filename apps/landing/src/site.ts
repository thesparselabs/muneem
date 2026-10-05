import { BarChart3, Boxes, CloudOff, FileText, Receipt, ShieldCheck, Users, Wallet, Zap } from 'lucide-react';

// The working brand name. Change this one value to rename the product everywhere on the page.
export const BRAND = 'Lekha';
export const TAGLINE = 'Billing & books, built for the Indian counter';

export const NAV = [
  { label: 'Features', href: '#features' },
  { label: 'Product', href: '#product' },
  { label: 'Why Lekha', href: '#why' },
  { label: 'FAQ', href: '#faq' },
];

export const FEATURES = [
  { icon: Receipt, title: 'Lightning billing', body: 'Scan, discount, split tender and print — the whole bill is keyboard-only. A sale saves in under 60 ms, even at 500k invoices.' },
  { icon: FileText, title: 'GST done right', body: 'CGST/SGST/IGST, cess, composition and inclusive pricing handled on every line. GSTR-1 and 3B come out ready to file.' },
  { icon: Boxes, title: 'Live inventory', body: 'Stock moves with every bill, purchase and return. Low-stock alerts, valuation and a full movement ledger per item.' },
  { icon: Wallet, title: 'Parties & udhaar', body: 'Customer and supplier ledgers that always reconcile to your books, with credit limits and ageing at a glance.' },
  { icon: BarChart3, title: 'Real accounting', body: 'Every document posts to a proper double-entry ledger. Trial balance, P&L and balance sheet that actually balance.' },
  { icon: CloudOff, title: 'Offline first', body: 'The shop never stops. Bill with no internet; sync safely to the cloud when it returns, with zero lost transactions.' },
];

export const WHY = [
  { icon: Zap, title: 'Fast on a ₹20,000 PC', body: 'Cold-starts in seconds and stays smooth at 500k transactions, 20k items and 50k customers — on 4 GB of RAM.' },
  { icon: ShieldCheck, title: 'Your data stays yours', body: 'The books live on your own computer. Cloud backups are encrypted with a key only you hold.' },
  { icon: Users, title: 'Made for the counter', body: 'Icons over jargon, keyboard over mouse, Hindi-friendly. A new cashier is billing in minutes.' },
];

export const TABS = [
  { id: 'billing', label: 'Billing' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'gst', label: 'GST' },
  { id: 'reports', label: 'Reports' },
] as const;

export type TabId = (typeof TABS)[number]['id'];

export const FAQS = [
  { q: 'Does it work without internet?', a: 'Yes. Lekha is offline-first — you can bill, manage stock and see reports with no connection. When the internet returns, everything syncs to the cloud with no lost or duplicated transactions.' },
  { q: 'Is it GST compliant?', a: 'Every line computes CGST, SGST, IGST and cess correctly, including composition schemes and tax-inclusive pricing. GSTR-1 and GSTR-3B summaries are generated from your real invoices.' },
  { q: 'Where is my data stored?', a: 'On your own computer, in an encrypted local database. Cloud backups are encrypted with a master key that only you control — we cannot read your books.' },
  { q: 'Will it run on an old computer?', a: 'Yes. It is tuned to stay fast on a 4 GB machine even with hundreds of thousands of invoices, so you do not need new hardware.' },
  { q: 'Can more than one counter use it?', a: 'Multiple devices in a shop sync through the cloud and stay consistent, so a second till or the back office always sees the same books.' },
];
