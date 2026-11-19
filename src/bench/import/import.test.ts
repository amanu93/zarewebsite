import { describe, expect, it } from 'vitest';

import { toCandidateView } from '@/bench/data/logic';
import { seedArchetypes, seedCandidates } from '@/bench/data/seed';
import { buildImportRows, guessColumns, mappingProblem } from './columns';
import { parseCsv, readSpreadsheet } from './spreadsheet';

const NOW = new Date('2026-09-17T09:00:00Z');

function bench() {
  const t = NOW.getTime();
  const archetypes = seedArchetypes(t);
  return seedCandidates(t)
    .candidates.filter((c) => c.deleted_at === null)
    .map((c) => toCandidateView(c, archetypes.find((a) => a.id === c.archetype_id)!, NOW));
}

async function deflate(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** A minimal .xlsx: a zip of XML parts, stored or deflated as Excel writes them. */
async function xlsx(parts: Record<string, string>, compress = false): Promise<Uint8Array<ArrayBuffer>> {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(parts)) {
    const n = enc.encode(name);
    const plain = enc.encode(text);
    const data = compress ? await deflate(plain) : plain;
    const method = compress ? 8 : 0;
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(8, method, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, plain.length, true);
    local.setUint16(26, n.length, true);
    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(10, method, true);
    dir.setUint32(20, data.length, true);
    dir.setUint32(24, plain.length, true);
    dir.setUint16(28, n.length, true);
    dir.setUint32(42, offset, true);
    chunks.push(new Uint8Array(local.buffer), n, data);
    central.push(new Uint8Array(dir.buffer), n);
    offset += 30 + n.length + data.length;
  }
  const size = central.reduce((s, c) => s + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(10, Object.keys(parts).length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  const all = [...chunks, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((s, c) => s + c.length, 0));
  let p = 0;
  for (const c of all) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}

const file = (bytes: Uint8Array<ArrayBuffer> | string, name: string) => Object.assign(new Blob([bytes]), { name });

describe('reading a CSV', () => {
  it('handles quotes, embedded commas and newlines, CRLF and a BOM', () => {
    const rows = parseCsv('﻿Name,Notes\r\n"Kebede, Abebe","said ""yes""\nthen left"\r\nSara,\r\n');
    expect(rows.map((r) => r.cells)).toEqual([
      ['Name', 'Notes'],
      ['Kebede, Abebe', 'said "yes"\nthen left'],
      ['Sara', ''],
    ]);
    expect(rows.map((r) => r.line)).toEqual([1, 2, 4]);
  });

  it('reads semicolon and tab separated files', () => {
    expect(parseCsv('Name;Phone\nSara;0911 234 567')[1].cells).toEqual(['Sara', '0911 234 567']);
    expect(parseCsv('Name\tPhone\nSara\t0911')[1].cells).toEqual(['Sara', '0911']);
  });

  it('drops empty rows and splits off the header', async () => {
    const sheet = await readSpreadsheet(file('Name,Phone\n\n,\nSara,0911\n', 'list.csv'));
    expect(sheet.headers).toEqual(['Name', 'Phone']);
    expect(sheet.rows).toEqual([{ line: 4, cells: ['Sara', '0911'] }]);
  });
});

describe('reading an Excel file', () => {
  const book = (sheet: string, strings = '', compress = false) =>
    xlsx(
      {
      'xl/workbook.xml': '<workbook><sheets><sheet name="People" sheetId="1" r:id="rId3"/></sheets></workbook>',
      'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId3" Type="x" Target="worksheets/people.xml"/></Relationships>',
      'xl/sharedStrings.xml': `<sst>${strings}</sst>`,
      'xl/worksheets/people.xml': `<worksheet><sheetData>${sheet}</sheetData></worksheet>`,
      },
      compress,
    );

  it('reads shared and inline strings, numbers, and gaps between cells', async () => {
    const bytes = await book(
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>' +
        '<row r="2"><c r="A2" t="inlineStr"><is><t>Abebe &amp; Co</t></is></c><c r="C2"><v>911234567</v></c></row>' +
        '<row r="3"><c r="A3" t="s"><v>2</v></c><c r="C3"><v>2.51911234568E+11</v></c></row>',
      '<si><t>Name</t></si><si><r><t>Pho</t></r><r><t>ne</t></r></si><si><t xml:space="preserve">Sara </t></si>',
    );
    const sheet = await readSpreadsheet(file(bytes, 'people.xlsx'));
    expect(sheet.headers).toEqual(['Name', '', 'Phone']);
    expect(sheet.rows).toEqual([
      { line: 2, cells: ['Abebe & Co', '', '911234567'] },
      { line: 3, cells: ['Sara', '', '251911234568'] },
    ]);
  });

  it('inflates compressed parts, as Excel saves them', async () => {
    const bytes = await book('<row r="1"><c r="A1" t="s"><v>0</v></c></row><row r="2"><c r="A2" t="s"><v>1</v></c></row>', '<si><t>Name</t></si><si><t>Meron</t></si>', true);
    const sheet = await readSpreadsheet(file(bytes, 'people.xlsx'));
    expect(sheet).toEqual({ headers: ['Name'], rows: [{ line: 2, cells: ['Meron'] }] });
  });

  it('refuses the old .xls format with a way forward', async () => {
    await expect(readSpreadsheet(file('x', 'old.xls'))).rejects.toThrow(/\.xlsx or \.csv/);
  });
});

describe('matching columns and checking rows', () => {
  it('guesses columns from common header names', () => {
    const map = guessColumns(['First Name', 'Surname', 'Mobile Number', 'E-mail', 'City', 'Remarks']);
    expect(map).toMatchObject({ full_name: null, first_name: 0, last_name: 1, phone: 2, email: 3, location: 4, notes: 5 });
    expect(mappingProblem(map)).toBeNull();
    expect(mappingProblem(guessColumns(['Name']))).toMatch(/Phone/);
  });

  it('skips bad and duplicate rows with the reason, and keeps the rest', () => {
    const all = bench();
    const onBench = all.find((v) => v.phone)!;
    const sheet = {
      headers: ['Name', 'Phone', 'Email'],
      rows: [
        { line: 2, cells: ['Hanna Tesfaye', '0912 000 111', 'hanna@example.com'] },
        { line: 3, cells: ['Dawit Bekele', '12345', ''] },
        { line: 4, cells: ['Someone', onBench.phone!, ''] },
        { line: 5, cells: ['Hanna Again', '+251912000111', ''] },
        { line: 6, cells: ['', '0912 000 222', ''] },
        { line: 7, cells: ['Sara Alemu', '0912 000 333', 'not-an-email'] },
      ],
    };
    const rows = buildImportRows(sheet, guessColumns(sheet.headers), all);
    expect(rows.map((r) => r.problem)).toEqual([
      null,
      'Phone: Enter a valid phone number.',
      `Phone already on the bench as ${onBench.ref_code}.`,
      'Same phone as row 2.',
      'No name.',
      'Email: Enter a valid email address.',
    ]);
  });
});
