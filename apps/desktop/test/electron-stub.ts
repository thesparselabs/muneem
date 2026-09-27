// Minimal Electron stub for node-environment unit tests (aliased via vitest.config.ts).
export const exposed: Record<string, unknown> = {};
export const invoked: { channel: string; input: unknown }[] = [];
export const contextBridge = { exposeInMainWorld(name: string, api: unknown) { exposed[name] = api; } };
export const ipcRenderer = {
  invoke: async (channel: string, input: unknown) => { invoked.push({ channel, input }); return { ok: true, data: null }; },
  on: () => undefined, removeListener: () => undefined,
};
export const ipcMain = { handle: () => undefined };
export const app = { isPackaged: false, getPath: () => '/tmp', getVersion: () => '0.0.0-test', quit: () => undefined, requestSingleInstanceLock: () => true };
export const safeStorage = { isEncryptionAvailable: () => false, encryptString: (s: string) => Buffer.from(s), decryptString: (b: Buffer) => b.toString() };
export class BrowserWindow {}
export const dialog = { showMessageBox: async () => ({ response: 0 }), showErrorBox: () => undefined };
export const session = { defaultSession: { webRequest: { onHeadersReceived: () => undefined } } };
export const shell = { openExternal: async () => undefined };
