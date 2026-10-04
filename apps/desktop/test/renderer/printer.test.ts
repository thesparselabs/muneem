import { describe, expect, it } from 'vitest';
import { configToForm, formToConfig, type PrinterForm } from '../../src/renderer/src/lib/printerForm.js';

const form = (patch: Partial<PrinterForm>): PrinterForm => ({
  kind: 'simulator', host: '', port: '9100', printerName: '', mode: 'escpos', rupee: 'Rs', widthChars: 42, openDrawer: true, ...patch,
});

describe('printer settings form', () => {
  it('saves a Windows printer with its mode and rupee option', () => {
    expect(formToConfig(form({ kind: 'spooler', printerName: 'TVS RP3160 Gold', mode: 'image', rupee: 'symbol', widthChars: 32 }))).toEqual({
      ok: true, config: { kind: 'spooler', printerName: 'TVS RP3160 Gold', mode: 'image', rupee: 'symbol', port: 9100, widthChars: 32, openDrawer: true },
    });
  });

  it('asks for a printer to be chosen', () => {
    expect(formToConfig(form({ kind: 'spooler' }))).toEqual({ ok: false, message: 'choose a Windows printer' });
  });

  it('drops fields that belong to another kind, so image mode never sticks to a network printer', () => {
    const r = formToConfig(form({ kind: 'network', host: '192.168.1.50', printerName: 'Old USB', mode: 'image' }));
    expect(r).toMatchObject({ ok: true, config: { kind: 'network', host: '192.168.1.50', mode: 'escpos' } });
    expect(r.ok && r.config.printerName).toBeFalsy();
  });

  it('round-trips a saved configuration', () => {
    const saved = { kind: 'spooler', printerName: 'EPSON TM-T82', mode: 'escpos', rupee: 'symbol', port: 9100, widthChars: 48, openDrawer: false } as const;
    expect(formToConfig(configToForm(saved))).toEqual({ ok: true, config: saved });
  });
});
