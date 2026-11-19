/**
 * Reads the first sheet of a CSV or Excel (.xlsx) file into rows of text.
 *
 * No spreadsheet library: an .xlsx file is a zip of XML parts, and the
 * browser's DecompressionStream inflates the parts we need. Only what an
 * import needs is read: cell text, never formatting or formulas.
 */

export interface SheetRow {
  /** The row number as the spreadsheet shows it, for messages. */
  line: number;
  cells: string[];
}

export interface Sheet {
  headers: string[];
  rows: SheetRow[];
}

export async function readSpreadsheet(file: Blob & { name: string }): Promise<Sheet> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xls')) {
    throw new Error('Old .xls files cannot be read. Save it as .xlsx or .csv and try again.');
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  // A zip starts with PK, whatever the file is called.
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (name.endsWith('.xlsx') || isZip) return toSheet(await readXlsx(bytes));
  return toSheet(parseCsv(new TextDecoder().decode(bytes)));
}

/** Header row first; rows with nothing in them are dropped. */
function toSheet(rows: SheetRow[]): Sheet {
  const filled = rows
    .map((r) => ({ ...r, cells: r.cells.map((c) => c.trim()) }))
    .filter((r) => r.cells.some(Boolean));
  if (filled.length === 0) throw new Error('This file has no rows.');
  const [head, ...rest] = filled;
  return { headers: head.cells, rows: rest };
}

/* ----------------------------------------------------------------- CSV --- */

/**
 * RFC 4180, plus what Excel writes: a byte-order mark, CRLF, and a
 * semicolon or tab separator in some locales.
 */
export function parseCsv(text: string): SheetRow[] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const delimiter = [',', ';', '\t'].reduce((best, d) =>
    firstLine.split(d).length > firstLine.split(best).length ? d : best,
  );

  const rows: SheetRow[] = [];
  let cells: string[] = [];
  let cell = '';
  let quoted = false;
  let line = 1;
  let rowLine = 1;

  const endCell = () => {
    cells.push(cell);
    cell = '';
  };
  const endRow = () => {
    endCell();
    rows.push({ line: rowLine, cells });
    cells = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        if (ch === '\n') line++;
        cell += ch;
      }
    } else if (ch === '"' && cell === '') {
      quoted = true;
    } else if (ch === delimiter) {
      endCell();
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      endRow();
      line++;
      rowLine = line;
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || cells.length > 0) endRow();
  return rows;
}

/* ---------------------------------------------------------------- XLSX --- */

export async function readXlsx(bytes: Uint8Array<ArrayBuffer>): Promise<SheetRow[]> {
  const zip = new ZipReader(bytes);
  const workbook = await zip.text('xl/workbook.xml');
  if (!workbook) throw new Error('This does not look like an Excel file.');

  // The first sheet in the workbook, found through its relationship.
  const relId = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(workbook)?.[1];
  const rels = (await zip.text('xl/_rels/workbook.xml.rels')) ?? '';
  const target = relId
    ? new RegExp(`<Relationship\\b[^>]*\\bId="${relId}"[^>]*\\bTarget="([^"]+)"`).exec(rels)?.[1] ??
      new RegExp(`<Relationship\\b[^>]*\\bTarget="([^"]+)"[^>]*\\bId="${relId}"`).exec(rels)?.[1]
    : undefined;
  const sheetPath = target ? (target.startsWith('/') ? target.slice(1) : `xl/${target}`) : 'xl/worksheets/sheet1.xml';
  const sheet = await zip.text(sheetPath);
  if (!sheet) throw new Error('Could not find the first sheet in this file.');

  const shared = [...((await zip.text('xl/sharedStrings.xml')) ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    textRuns(m[1]),
  );

  const rows: SheetRow[] = [];
  for (const row of sheet.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const line = Number(/\br="(\d+)"/.exec(row[1])?.[1] ?? rows.length + 1);
    const cells: string[] = [];
    let next = 0;
    for (const c of (row[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const ref = /\br="([A-Z]+)\d+"/.exec(attrs)?.[1];
      const col = ref ? columnIndex(ref) : next;
      next = col + 1;
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1];
      const body = c[2] ?? '';
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value = '';
      if (type === 's') value = shared[Number(raw)] ?? '';
      else if (type === 'inlineStr') value = textRuns(body);
      else if (type === 'b') value = raw === '1' ? 'TRUE' : 'FALSE';
      else if (type === 'e') value = '';
      else if (raw !== undefined) value = plainNumber(decode(raw));
      cells[col] = value;
    }
    rows.push({ line, cells: Array.from(cells, (v) => v ?? '') });
  }
  return rows;
}

/** 'A' → 0, 'Z' → 25, 'AA' → 26. */
function columnIndex(letters: string): number {
  return [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
}

/** The text of a string item: every <t> run, phonetic hints left out. */
function textRuns(xml: string): string {
  return [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
    .map((m) => decode(m[1]))
    .join('');
}

/** Excel stores a long phone number as 2.51911234567E+11 at times. */
function plainNumber(v: string): string {
  return /^-?\d+(\.\d+)?E[+-]?\d+$/i.test(v) ? String(Number(v)) : v;
}

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Just enough of a zip reader: the central directory, stored and deflated entries. */
class ZipReader {
  private entries = new Map<string, { method: number; size: number; offset: number }>();
  private view: DataView;

  constructor(private bytes: Uint8Array<ArrayBuffer>) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let end = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (this.view.getUint32(i, true) === 0x06054b50) {
        end = i;
        break;
      }
    }
    if (end < 0) throw new Error('This file is damaged or is not an Excel file.');
    const count = this.view.getUint16(end + 10, true);
    let p = this.view.getUint32(end + 16, true);
    const names = new TextDecoder();
    for (let n = 0; n < count && this.view.getUint32(p, true) === 0x02014b50; n++) {
      const method = this.view.getUint16(p + 10, true);
      const size = this.view.getUint32(p + 20, true);
      const nameLen = this.view.getUint16(p + 28, true);
      const extraLen = this.view.getUint16(p + 30, true);
      const commentLen = this.view.getUint16(p + 32, true);
      const offset = this.view.getUint32(p + 42, true);
      this.entries.set(names.decode(bytes.subarray(p + 46, p + 46 + nameLen)), { method, size, offset });
      p += 46 + nameLen + extraLen + commentLen;
    }
  }

  async text(name: string): Promise<string | null> {
    const e = this.entries.get(name);
    if (!e) return null;
    const start = e.offset + 30 + this.view.getUint16(e.offset + 26, true) + this.view.getUint16(e.offset + 28, true);
    const data = this.bytes.subarray(start, start + e.size);
    if (e.method === 0) return new TextDecoder().decode(data);
    if (e.method !== 8) throw new Error('This Excel file uses a compression this import cannot read.');
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new TextDecoder().decode(await new Response(stream).arrayBuffer());
  }
}
