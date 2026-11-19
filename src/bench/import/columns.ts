import { findDuplicates, normalizePhone, validateContact, type ContactInput } from '@/bench/data/logic';
import type { CandidateView } from '@/bench/data/types';
import type { Sheet } from './spreadsheet';

/**
 * Matching a file's columns to candidate fields, and checking every row
 * the way the add-candidate form does before anything is written.
 */

export type ImportField =
  | 'full_name'
  | 'first_name'
  | 'last_name'
  | 'phone'
  | 'email'
  | 'location'
  | 'linkedin_url'
  | 'notes';

export const IMPORT_FIELDS: { key: ImportField; label: string; hint?: string; aliases: string[] }[] = [
  { key: 'full_name', label: 'Full name', hint: 'Or first and last name below', aliases: ['fullname', 'name', 'candidatename', 'candidate', 'applicantname', 'names'] },
  { key: 'first_name', label: 'First name', aliases: ['firstname', 'givenname', 'fname'] },
  { key: 'last_name', label: 'Last name', aliases: ['lastname', 'surname', 'familyname', 'fathersname', 'lname'] },
  { key: 'phone', label: 'Phone', aliases: ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'phoneno', 'mobileno', 'telephone', 'tel', 'cell', 'contactnumber', 'contact'] },
  { key: 'email', label: 'Email', aliases: ['email', 'emailaddress', 'mail'] },
  { key: 'location', label: 'Location', aliases: ['location', 'city', 'address', 'region', 'country'] },
  { key: 'linkedin_url', label: 'LinkedIn', aliases: ['linkedin', 'linkedinurl', 'linkedinprofile'] },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'note', 'comments', 'comment', 'remarks', 'source'] },
];

/** Column index per field; null when the file has no such column. */
export type ColumnMap = Record<ImportField, number | null>;

const key = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

/** Best guess from the header names: exact names first, then names that contain one. Each column is used once. */
export function guessColumns(headers: string[]): ColumnMap {
  const map = Object.fromEntries(IMPORT_FIELDS.map((f) => [f.key, null])) as ColumnMap;
  const used = new Set<number>();
  const keys = headers.map(key);
  for (const pass of ['exact', 'contains'] as const) {
    for (const f of IMPORT_FIELDS) {
      if (map[f.key] !== null) continue;
      const i = keys.findIndex(
        (h, i) => !used.has(i) && h !== '' && f.aliases.some((a) => (pass === 'exact' ? h === a : h.includes(a))),
      );
      if (i >= 0) {
        map[f.key] = i;
        used.add(i);
      }
    }
  }
  return map;
}

/** What the import needs before it can check rows. */
export function mappingProblem(map: ColumnMap): string | null {
  if (map.full_name === null && map.first_name === null) return 'Match a column to Full name, or to First name.';
  if (map.phone === null) return 'Match a column to Phone.';
  return null;
}

export interface ImportRow {
  line: number;
  contact: ContactInput;
  notes: string;
  /** Why this row will be skipped. */
  problem: string | null;
  /** Imported anyway, but worth a look. */
  warning: string | null;
}

/** Every row, checked against the bench and against the rows above it. */
export function buildImportRows(sheet: Sheet, map: ColumnMap, bench: CandidateView[]): ImportRow[] {
  const cell = (cells: string[], f: ImportField) => (map[f] === null ? '' : (cells[map[f]!] ?? '').trim());
  const seen = new Map<string, number>();

  return sheet.rows.map(({ line, cells }) => {
    const full = cell(cells, 'full_name') || [cell(cells, 'first_name'), cell(cells, 'last_name')].filter(Boolean).join(' ');
    const contact: ContactInput = {
      full_name: full,
      phone: cell(cells, 'phone'),
      email: cell(cells, 'email'),
      location: cell(cells, 'location'),
      linkedin_url: cell(cells, 'linkedin_url'),
    };

    const errors = validateContact(contact);
    const matches = findDuplicates(contact, bench);
    const phone = normalizePhone(contact.phone);
    let problem: string | null = null;
    if (errors.full_name) problem = contact.full_name ? `Name: ${errors.full_name}` : 'No name.';
    else if (errors.phone) problem = contact.phone ? `Phone: ${errors.phone}.` : 'No phone number.';
    else if (matches.phone[0]) problem = `Phone already on the bench as ${matches.phone[0].ref_code}.`;
    else if (phone && seen.has(phone)) problem = `Same phone as row ${seen.get(phone)}.`;
    else if (errors.email) problem = `Email: ${errors.email}`;
    else if (errors.linkedin_url) problem = `LinkedIn: ${errors.linkedin_url}`;
    // Only a row that will be imported claims its number.
    if (phone && !problem) seen.set(phone, line);

    const similar = matches.similar[0];
    return {
      line,
      contact,
      notes: cell(cells, 'notes'),
      problem,
      warning: !problem && similar ? `Similar to ${similar.ref_code} ${similar.full_name ?? ''}`.trim() : null,
    };
  });
}
