import { AppError, IMPORT_MAX_BYTES, IMPORT_MAX_ROWS } from '@muneem/contracts';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';

export interface TableRow { line: number; cells: string[] }
export interface Table { columns: string[]; rows: TableRow[] }

const tooBig = () => new AppError('VALIDATION_FAILED', 'File is too large', { file: `import at most ${IMPORT_MAX_ROWS} rows / 10 MB` });

function toTable(lines: TableRow[]): Table {
  const [header, ...rows] = lines;
  if (!header) throw new AppError('VALIDATION_FAILED', 'The file is empty', { file: 'no header row' });
  if (rows.length > IMPORT_MAX_ROWS) throw tooBig();
  return { columns: header.cells.map((c) => c.trim()), rows };
}

// Papa's cursor sits just past each row, so a row's line is 1 + the newlines before its first non-blank character.
function readCsv(bytes: Buffer): Table {
  const text = bytes.toString('utf8').replace(/^\uFEFF/u, '');
  const rows: TableRow[] = [];
  let scanned = 0;
  let newlines = 0;
  Papa.parse<string[]>(text, {
    skipEmptyLines: 'greedy',
    step: ({ data, meta }) => {
      let start = scanned;
      while (start < text.length && /\s/u.test(text[start]!)) start++;
      for (let i = scanned; i < start; i++) if (text[i] === '\n') newlines++;
      rows.push({ line: newlines + 1, cells: data });
      for (let i = start; i < meta.cursor; i++) if (text[i] === '\n') newlines++;
      scanned = meta.cursor;
    },
  });
  return toTable(rows);
}

type CellValue = ExcelJS.CellValue;
function cellText(v: CellValue): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') return String(Number(v.toPrecision(15))); // 0.1+0.2 → "0.3", as Excel displays it
  if (typeof v !== 'object') return String(v);
  if ('richText' in v) return v.richText.map((r) => r.text).join('');
  if ('result' in v) return cellText(v.result as CellValue);
  if ('text' in v) return String(v.text);
  return '';
}

async function readXlsx(bytes: Buffer): Promise<Table> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new AppError('VALIDATION_FAILED', 'The workbook has no sheets', { file: 'no sheets' });
  const lines: TableRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, line) => {
    // row.values is sparse where cells are empty; Array.from fills the gaps that map() would keep.
    lines.push({ line, cells: Array.from((row.values as CellValue[]).slice(1), cellText) });
  });
  return toTable(lines);
}

export async function readTable(fileName: string, bytes: Buffer): Promise<Table> {
  if (bytes.length > IMPORT_MAX_BYTES) throw tooBig();
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'csv' || ext === 'txt') return readCsv(bytes);
  if (ext === 'xlsx') return readXlsx(bytes);
  throw new AppError('VALIDATION_FAILED', 'Use a .csv or .xlsx file', { file: 'unsupported file type' });
}
