import { execFile, type ExecFileException } from 'node:child_process';
import { win32 } from 'node:path';
import type { Writable } from 'node:stream';
import { assertJobSize, assertPrinterName, type RawJobRunner } from './spooler.js';

// Win32 OpenPrinter / StartDocPrinter("RAW") / WritePrinter via P/Invoke; the printer name comes from the environment and the bytes from stdin, never the command line.
export const RAW_PRINT_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try {
  Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class MuneemRawPrint {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DocInfo { public string DocName; public string OutputFile; public string DataType; }
  [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern bool OpenPrinter(string name, out IntPtr handle, IntPtr defaults);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool ClosePrinter(IntPtr handle);
  [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern int StartDocPrinter(IntPtr handle, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DocInfo info);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool EndDocPrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool StartPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool EndPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool WritePrinter(IntPtr handle, byte[] data, int count, out int written);
  static Win32Exception LastError() { return new Win32Exception(Marshal.GetLastWin32Error()); }
  public static void Send(string printer, byte[] data) {
    IntPtr handle;
    if (!OpenPrinter(printer, out handle, IntPtr.Zero)) throw LastError();
    try {
      if (StartDocPrinter(handle, 1, new DocInfo { DocName = "Muneem receipt", DataType = "RAW" }) == 0) throw LastError();
      try {
        if (!StartPagePrinter(handle)) throw LastError();
        int written;
        if (!WritePrinter(handle, data, data.Length, out written)) throw LastError();
        if (written != data.Length) throw new Exception("the printer took only part of the job");
        EndPagePrinter(handle);
      } finally { EndDocPrinter(handle); }
    } finally { ClosePrinter(handle); }
  }
}
'@
  $buffer = New-Object System.IO.MemoryStream
  [Console]::OpenStandardInput().CopyTo($buffer)
  [MuneemRawPrint]::Send($env:MUNEEM_PRINTER, $buffer.ToArray())
} catch {
  [Console]::Error.WriteLine('MUNEEM-ERROR: ' + $_.Exception.Message)
  exit 3
}
`;

export const POWERSHELL_ARGS: readonly string[] = [
  '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(RAW_PRINT_SCRIPT, 'utf16le').toString('base64'),
];

export interface ExecOptions { env: NodeJS.ProcessEnv; timeout: number; killSignal: 'SIGKILL'; windowsHide: true; maxBuffer: number; encoding: 'utf8' }
export type ExecFn = (
  file: string, args: readonly string[], options: ExecOptions, done: (error: ExecFileException | null, stdout: string, stderr: string) => void,
) => { stdin: Writable | null };

const reason = (stderr: string): string | undefined => stderr.split(/\r?\n/u).find((l) => l.startsWith('MUNEEM-ERROR: '))?.slice(14).trim();

// Runs Windows' own PowerShell by absolute path with no shell, so nothing the user typed is ever parsed as a command.
export class PowerShellRawJob implements RawJobRunner {
  constructor(private readonly o: { timeoutMs: number; exec?: ExecFn; env?: NodeJS.ProcessEnv }) {}

  powershellPath(): string {
    return win32.join(this.env().SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  }

  async run(printerName: string, bytes: Buffer): Promise<void> {
    assertPrinterName(printerName);
    assertJobSize(bytes);
    const exec = this.o.exec ?? (execFile as unknown as ExecFn);
    await new Promise<void>((resolve, reject) => {
      const options: ExecOptions = {
        env: { ...this.env(), MUNEEM_PRINTER: printerName }, timeout: this.o.timeoutMs, killSignal: 'SIGKILL', windowsHide: true, maxBuffer: 64 * 1024, encoding: 'utf8',
      };
      const child = exec(this.powershellPath(), POWERSHELL_ARGS, options, (error, _stdout, stderr) => {
        if (!error) { resolve(); return; }
        if (error.killed) reject(new Error(`The printer "${printerName}" did not take the job within ${Math.round(this.o.timeoutMs / 1000)} s; check it is on and has paper`));
        else reject(new Error(`The printer "${printerName}" refused the job: ${reason(stderr) ?? error.message}`));
      });
      child.stdin?.on('error', () => undefined); // the exit callback reports why the helper stopped reading
      child.stdin?.end(bytes);
    });
  }

  private env(): NodeJS.ProcessEnv { return this.o.env ?? process.env; }
}
