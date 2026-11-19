import { formatDateLong } from '@/bench/dates';
// Straight from the rules and types, not the data layer, so the data layer
// can use this module to build and check what it exports.
import { exportBlockReason, IMMEDIATE, NOTICE_OPTIONS, scoreLabel } from '@/bench/data/logic';
import type { Archetype, CandidateView, ClientRequest, User } from '@/bench/data/types';

/**
 * The client-facing shortlist, as data.
 *
 * HARD REQUIREMENT: a candidate's name, phone, email, LinkedIn, salary
 * expectation and internal notes never reach a client. This module is how
 * that is guaranteed, and it works by WHITELIST, not by exclusion:
 *
 *   - ExportCandidate names every field a client may see. Nothing else exists
 *     on it, so the PDF renderer (which accepts only ExportDocument) has no
 *     way to print anything else.
 *   - toExportCandidate copies fields one by one. It never spreads a
 *     candidate, so a column added to the schema tomorrow is invisible here
 *     until someone deliberately adds it to this file.
 *
 * Free text is the one place identity can still leak — a recruiter typing a
 * name or a salary figure into a strength. findLeaks catches that and the
 * export is blocked until the text is reworded.
 */

export interface ExportCandidate {
  ref_code: string;
  experience: string | null;
  seniority: string | null;
  stack: string[];
  english: string | null;
  assessment: {
    overall: string;
    communication: string | null;
    technical: string | null;
  };
  availability: {
    confirmed_on: string;
    earliest_start: string | null;
    notice_period: string | null;
  };
  work_setup: {
    shifts: string[];
    setup_verified: boolean;
  };
  strengths: string[];
  consideration: string;
}

export interface ExportDocument {
  client_name: string;
  role_name: string;
  quantity: number;
  prepared_on: string;
  prepared_by: { name: string; email: string };
  freshness_days: number;
  /**
   * Candidates whose availability is not currently confirmed well enough to
   * send. Always 0 in anything exported: the export gate refuses otherwise.
   * A draft preview uses it so the cover never claims what is not true.
   */
  unconfirmed: number;
  candidates: ExportCandidate[];
}

const dateFmt = (iso: string) => formatDateLong(iso);

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function toExportCandidate(v: CandidateView, verifiedAt: string): ExportCandidate {
  return {
    ref_code: v.ref_code,
    experience:
      v.years_experience === null
        ? null
        : `${v.years_experience} ${v.years_experience === 1 ? 'year' : 'years'}`,
    seniority: v.seniority ? cap(v.seniority) : null,
    // Engineers are described by stack; support roles by their tools.
    stack: v.stack.length > 0 ? [...v.stack] : [...v.skills],
    english: v.english_level === 'below' ? 'Below B1' : v.english_level,
    assessment: {
      overall: scoreLabel(v.overall_score) ?? '',
      communication: scoreLabel(v.communication_score),
      technical: scoreLabel(v.technical_score),
    },
    availability: {
      confirmed_on: dateFmt(verifiedAt),
      // Immediate is its own answer: no start date, and no "notice" line.
      earliest_start:
        v.notice_period === IMMEDIATE
          ? 'immediately'
          : v.earliest_start_date
            ? dateFmt(v.earliest_start_date)
            : null,
      notice_period: v.notice_period === IMMEDIATE ? null : v.notice_period,
    },
    work_setup: {
      shifts: [...v.shift_flexibility],
      setup_verified: v.setup_verified,
    },
    strengths: [...v.strengths],
    consideration: v.concern ?? '',
  };
}

export function buildShortlistExport(input: {
  request: Pick<ClientRequest, 'client_name' | 'quantity'>;
  archetype: Pick<Archetype, 'name' | 'freshness_days'>;
  preparedBy: Pick<User, 'full_name' | 'email'>;
  entries: { candidate: CandidateView; verified_at: string }[];
  now?: Date;
  /** A sent shortlist: every candidate was confirmed at the moment of export. */
  frozen?: boolean;
}): ExportDocument {
  return {
    client_name: input.request.client_name,
    role_name: input.archetype.name,
    quantity: input.request.quantity,
    prepared_on: dateFmt((input.now ?? new Date()).toISOString()),
    prepared_by: { name: input.preparedBy.full_name, email: input.preparedBy.email },
    freshness_days: input.archetype.freshness_days,
    unconfirmed: input.frozen ? 0 : input.entries.filter((e) => exportBlockReason(e.candidate) !== null).length,
    candidates: input.entries.map((e) => toExportCandidate(e.candidate, e.verified_at)),
  };
}

export interface Leak {
  ref_code: string;
  reason: string;
}

/**
 * Last line of defence. Scans the exported free text for anything that
 * identifies the person or discloses pay. Deliberately strict: a false
 * positive costs a recruiter ten seconds of rewording, a false negative puts
 * a candidate's identity in a client's inbox.
 */
export function findLeaks(candidates: CandidateView[]): Leak[] {
  const leaks: Leak[] = [];
  for (const v of candidates) {
    // Everything free-text that reaches the client page.
    const raw = [...v.strengths, v.concern ?? '', ...v.stack, ...v.skills, v.notice_period ?? ''].join(' \n ');
    const text = raw.toLowerCase();
    const add = (reason: string) => leaks.push({ ref_code: v.ref_code, reason });

    // Name parts of two letters or more, as whole words, in any script.
    const nameParts = (v.full_name ?? '')
      .toLowerCase()
      .split(/\s+/)
      .filter((p) => p.length >= 2);
    if (nameParts.some((p) => new RegExp(`(^|[^\\p{L}])${escape(p)}($|[^\\p{L}])`, 'u').test(text))) {
      add('Strengths or consideration mention their name.');
    }

    const digits = (v.phone ?? '').replace(/\D/g, '');
    if (
      (digits.length >= 6 && text.replace(/\D/g, '').includes(digits.slice(-6))) ||
      (v.email && (text.includes(v.email.toLowerCase()) || text.includes(v.email.toLowerCase().split('@')[0]))) ||
      /@[a-z0-9-]+\./.test(text) ||
      /\b(ends|ending) (in|with) \d{3,}/.test(text)
    ) {
      add('Contact details appear in the assessment text.');
    }

    // Any link at all: a profile, a portfolio, a CV.
    if (/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|dev|me|co|et|app)\b|lnkd\.in|linkedin|github\.com/.test(text)) {
      add('A link appears in the assessment text.');
    }

    if (v.location && v.location.trim().length >= 3 && text.includes(v.location.trim().toLowerCase())) {
      add('Their location appears in the assessment text.');
    }

    if (
      /\bsalar(y|ies)|\bpay(s|ment|ing)?\b|\bpaid\b|\bcompensation|\bwages?\b|\bincome\b|\bearnings?\b|\bctc\b|\b(gross|net) (pay|salary)|\bper month\b|\bbirr\b|ብር|\betb\b|\busd\b|\beur\b|\bgbp\b|[$€£]\s?\d|\b\d{2,3}\s?k\b|\b\d{1,3}(,\d{3})+\b/.test(
        text,
      )
    ) {
      add('Consideration or strengths mention salary. Reword before export.');
    }

    if (v.notice_period && !(NOTICE_OPTIONS as readonly string[]).includes(v.notice_period)) {
      add('Notice period is not one of the standard answers. Confirm it on a call.');
    }
  }
  return leaks;
}

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
