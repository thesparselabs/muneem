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

function readCsv(bytes: Buffer): Table {
  const text = bytes.toString('utf8').replace(/^﻿/u, '');
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' });
  return toTable(parsed.data.map((cells, i) => ({ line: i + 1, cells })));
}

type CellValue = ExcelJS.CellValue;
function cellText(v: CellValue): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
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
    const values = (row.values as CellValue[]).slice(1);
    lines.push({ line, cells: values.map(cellText) });
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
