# ADR-0055 — Windows printing: spooler RAW jobs, an image fallback, and ₹ and Indic text as raster lines

**Status:** Accepted, 2026-10-05

## Context
ADR-0015 shipped a simulator and a network ESC/POS printer and left USB / Windows spooler printers for later. Most
pilot shops have a USB thermal printer installed as a Windows printer, and some cheap ones only print through their
driver. The printer's code page has no ₹ and no Indic script, so ₹ printed as "Rs" and Hindi product or shop names as
"?". NFR-012 still holds: a printer problem never blocks or undoes a sale.

Node has no API for a RAW spooler job. The options were a native addon (`printer`, `@thesusheer/electron-printer`,
or our own N-API module), Electron's `webContents.print` (driver only, no RAW), or a small helper process.

## Decision
- **Spooler kind.** `PrinterConfig.kind` gains `spooler`, with `printerName`, `mode: 'escpos' | 'image'` and
  `rupee: 'symbol' | 'Rs'` (defaults keep a saved pre-9d configuration printing exactly as before). Installed
  printers are listed with Electron's `webContents.getPrintersAsync()` (`printer.listInstalled`). Off Windows the list
  is empty and a spooler setting fails each job cleanly; the simulator remains for development.
- **RAW jobs through a PowerShell helper, not a native addon.** A fixed script, passed as `-EncodedCommand`, compiles a
  P/Invoke wrapper for `OpenPrinter` / `StartDocPrinter("RAW")` / `WritePrinter` with `Add-Type` and sends the bytes it
  reads on stdin. It runs as `%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe` via `execFile` (no shell),
  with the printer name in an environment variable and the bytes on stdin, so nothing the user typed is ever on a
  command line or parsed as code. The name must also pass `PrinterName` (no control characters, at most 256) and be
  one Windows currently lists. Jobs are bounded to 4 MB and 20 s (the helper is killed at the limit); the print queue
  adds an outer 30 s deadline for any transport.
  - Why: no prebuild/rebuild for each Electron ABI, nothing to sign separately, and PowerShell 5.1 with .NET Framework
    ships on every Windows 10/11. The cost is ~1–2 s of cold start per job while `Add-Type` compiles, which is fine
    after a committed sale. If a shop's policy blocks PowerShell or `Add-Type` (Constrained Language Mode, AppLocker),
    image mode still works; a native addon stays the fallback if the pilot shows that.
- **Image fallback.** In `image` mode the receipt's laid-out lines become one roll-sized HTML page (58 mm for 32
  columns, 80 mm otherwise), printed with `webContents.print({ silent: true, deviceName, pageSize })` from a hidden,
  script-less, sandboxed window whose session can load nothing but `data:` URLs.
- **₹ and Indic text as raster lines.** Lines the printer's ASCII code page can carry stay text. Any other line (Indic
  script, or ₹ when `rupee` is `symbol`) is drawn on a canvas in one long-lived hidden page and sent as an ESC/POS
  `GS v 0` image, 12 dots per text column (384 dots for 58 mm, 504 for 42 columns, 576 for 48) and 32 dots high (64 for
  double lines). Words keep their text columns so amounts stay aligned; an Indic phrase is drawn as one run so
  Chromium's shaper (HarfBuzz) forms its conjuncts. If drawing fails the line falls back to text with "?" and the
  receipt still prints.
- **Fonts.** Noto Sans Devanagari and Noto Sans Tamil Regular (unmodified v2.001, SIL OFL 1.1, ~300 KB together) ship
  in `resources/fonts` with their licence and load into the raster page as `FontFace`s; ₹ comes from the Devanagari font.
  Other Indic scripts fall back to the system font (Nirmala UI on Windows 10/11 covers all of them). Image mode uses
  the system fonts only.
- **Cash drawer.** On the spooler kind the drawer kick (`ESC p 0 25 250`) is a RAW job in both modes; in ESC/POS mode
  after a cash sale it is part of the receipt's bytes as before. In image mode a drawer kick that fails after the
  receipt printed is logged and does not fail (or reprint) the receipt.
- **Tested with fakes.** `SpoolerTransport` (directory, RAW runner, page printer) and `LineRasteriser` are interfaces;
  tests use fakes. Real printers on a Windows host are checked by hand in 9j.

## Consequences
- A shop's USB printer works with only its Windows driver installed, and receipts can show ₹ and Hindi/Tamil names.
- Raster lines make a job larger (about 2 KB per line at 42 columns) and slower to print than text; receipts that
  are all ASCII are unchanged byte for byte.
- `PrinterConfig` is still device-local (ADR-0015). Supersedes nothing; extends ADR-0015's adapters.
