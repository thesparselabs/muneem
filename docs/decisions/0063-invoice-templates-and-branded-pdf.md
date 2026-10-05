# ADR-0063 — Invoice templates and branded PDF

**Status:** Accepted, 2026-10-05

## Context
The print layer (`services/print`) lays out till receipts for ESC/POS and roll paper. Customers and GST filing need a
proper **invoice document** — A4 or thermal — carrying the business's logo, signature and accent colour, saved as a PDF.
This is a presentation concern over an existing posted sale, not a new transaction.

## Decision
- A new **`invoice` IPC namespace** with five methods: `listTemplates`, `getBranding`, `setBranding` (permission
  `settings.manage`, audited), `renderHtml` and `savePdf` (permission `pos.view`). Rendering never mutates the sale.
- **Branding is a business-scoped `setting`** (key `invoice.branding`), not device-local `app_meta` like the printer
  config (ADR-0015). A shop's look (template, accent, logo, signature, terms, bank details, footer) should follow it to
  every till and sync, unlike the per-till printer hardware choice.
- **Invoice data is assembled from the posted `Sale`** (reusing the receipt assembly and sales lookup) plus the business
  and active branch for the seller block. An INR **amount-in-words** helper (Indian lakh/crore system) lives with the
  data builder. Money stays in paise; the shape exposes per-line taxable, rate and CGST/SGST/IGST/Cess so A4 templates
  can carry every GST mandatory field.
- **Ten templates**, each a pure `(data, branding) => string` renderer sharing helpers in `templates/base.ts` (money
  formatter, HTML escaping, GST line-item table, totals, signatory and the A4/thermal document shells). Styling is
  inline `<style>`; the only external assets are the embedded logo/signature **data URLs**, which are validated to be
  `data:image/png|jpeg` before embedding so branding text can never break out of the HTML.
- **PDF is produced in a hidden, network-blocked Electron `BrowserWindow`** via `webContents.printToPDF`, written to
  `app.getPath('downloads')`. A4 uses the `A4` page size; a thermal roll has no fixed length, so the window measures the
  laid-out content height and cuts the page to it. Electron is imported lazily so the module stays importable in tests.
- **No new dependencies.** Everything bundles and works offline.

## Consequences
- Branding rows sync like other settings and are audited on write (both by the `settings` write path and the IPC
  `audit` flag, as `settings.set` already is).
- `savePdf` is Electron-only at call time; unit tests exercise `renderHtml`, the data builder and amount-in-words
  without a window.
- Adding a template is one file plus a metadata entry in `services/invoice/index.ts`; the `InvoiceTemplateId` enum in
  the contract is the single source of truth the renderer and backend share.
