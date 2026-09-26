// LLD §15.3 — resource × action permissions with optional value limits.
export const RESOURCES = [
  'sales', 'purchases', 'inventory', 'products', 'customers', 'suppliers', 'payments', 'expenses',
  'accounting', 'reports', 'settings', 'users', 'business', 'pos', 'sync', 'diagnostics', 'gst',
] as const;
export const ACTIONS = ['view', 'create', 'edit', 'cancel', 'approve', 'manage', 'adjust', 'financial', 'export'] as const;

export type Resource = (typeof RESOURCES)[number];
export type Action = (typeof ACTIONS)[number];
export type Permission = `${Resource}.${Action}`;

export interface GrantLimit {
  maxDiscountBp?: number;
  maxRefundPaise?: number;
  backdateDays?: number;
}
export interface Grant {
  permission: Permission;
  limit?: GrantLimit;
}

/** Server-issued, cached on device, enforced in main (never from the renderer's copy). */
export interface PermissionSnapshot {
  permVer: number;
  roles: string[];
  grants: Grant[];
  issuedAt: string;
}

/** Shipped presets: concrete defaults, never "optional" (PRD §35 clarification). */
export const ROLE_PRESETS: Record<string, Grant[]> = {
  owner: RESOURCES.flatMap((r) => ACTIONS.map((a) => ({ permission: `${r}.${a}` as Permission }))),
  manager: [
    ...(['sales', 'purchases', 'inventory', 'products', 'customers', 'suppliers', 'payments', 'expenses', 'pos', 'gst'] as const)
      .flatMap((r) => (['view', 'create', 'edit', 'cancel', 'approve', 'adjust'] as const).map((a) => ({ permission: `${r}.${a}` as Permission }))),
    { permission: 'reports.view' }, { permission: 'reports.export' }, { permission: 'reports.financial' },
    { permission: 'sync.view' }, { permission: 'diagnostics.view' }, { permission: 'business.view' }, { permission: 'settings.view' },
  ],
  cashier: [
    { permission: 'sales.view' }, { permission: 'sales.create', limit: { maxDiscountBp: 500 } },
    { permission: 'pos.view' }, { permission: 'pos.create' }, { permission: 'products.view' },
    { permission: 'customers.view' }, { permission: 'customers.create' }, { permission: 'payments.view' }, { permission: 'payments.create' },
    { permission: 'sync.view' }, { permission: 'business.view' },
  ],
  accountant: [
    ...(['accounting', 'payments', 'expenses', 'purchases', 'gst'] as const)
      .flatMap((r) => (['view', 'create', 'edit', 'financial'] as const).map((a) => ({ permission: `${r}.${a}` as Permission }))),
    { permission: 'reports.view' }, { permission: 'reports.financial' }, { permission: 'reports.export' },
    { permission: 'sales.view' }, { permission: 'customers.view' }, { permission: 'suppliers.view' }, { permission: 'business.view' },
  ],
  inventory: [
    ...(['inventory', 'products', 'purchases', 'suppliers'] as const)
      .flatMap((r) => (['view', 'create', 'edit', 'adjust'] as const).map((a) => ({ permission: `${r}.${a}` as Permission }))),
    { permission: 'reports.view' }, { permission: 'business.view' },
  ],
};
