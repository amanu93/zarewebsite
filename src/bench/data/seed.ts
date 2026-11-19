/**
 * Demo seed.
 *
 * Built relative to the moment the app boots, not to fixed dates, so the
 * demo shows the same states next month as it does today. Every offset below
 * is chosen to put a specific screen into a specific state:
 *
 *   CSR  target 20, freshness 30 days  -> seeded to land AMBER
 *   SWE  target 12, freshness 45 days  -> seeded to land GREEN
 *
 * Between them the queue carries all four reasons (expired, expiring_soon,
 * no_answer_retry, recall_due), the never_verified edge case, one candidate
 * inside the 48h cooldown who must NOT appear, and one anonymised
 * do_not_contact record that must appear nowhere at all.
 */

import { dateKey, startOfToday } from '@/bench/dates';
import { nextRun } from '@/bench/jobs';
import type {
  Archetype,
  ArchiveReason,
  JobRun,
  Placement,
  CallLog,
  Candidate,
  ClientRequest,
  Shortlist,
  ShortlistCandidate,
  User,
} from './types';
import { buildShortlistExport } from '@/bench/export/shortlist';
import { applyCall, applyOverallScore, IMMEDIATE, overallScoreProblem, toCandidateView } from './logic';

const DAY = 86_400_000;
const HOUR = 3_600_000;

const iso = (ms: number) => new Date(ms).toISOString();
/** A calendar date in East Africa Time. */
const day = (ms: number) => dateKey(new Date(ms));

export const ARCHETYPE_CSR = 'a1000000-0000-4000-8000-000000000001';
export const ARCHETYPE_SWE = 'a1000000-0000-4000-8000-000000000002';

export const USER_RECRUITER_1 = 'u1000000-0000-4000-8000-000000000001';
export const USER_RECRUITER_2 = 'u1000000-0000-4000-8000-000000000002';
export const USER_AM = 'u1000000-0000-4000-8000-000000000003';
export const USER_EXEC = 'u1000000-0000-4000-8000-000000000004';

export function seedUsers(now: number): User[] {
  return [
    {
      id: USER_RECRUITER_1,
      full_name: 'Hanna Tesfaye',
      email: 'hanna@zareinnovations.com',
      role: 'recruiter',
      notify_scarcity: true,
      notify_decay_warning: true,
      notify_new_request: true,
      notify_weekly_summary: false,
      created_at: iso(now - 300 * DAY),
    },
    {
      id: USER_RECRUITER_2,
      full_name: 'Dawit Bekele',
      email: 'dawit@zareinnovations.com',
      role: 'recruiter',
      notify_scarcity: true,
      notify_decay_warning: true,
      notify_new_request: true,
      notify_weekly_summary: false,
      created_at: iso(now - 260 * DAY),
    },
    {
      id: USER_AM,
      full_name: 'Selamawit Girma',
      email: 'selam@zareinnovations.com',
      role: 'recruiter',
      notify_scarcity: true,
      notify_decay_warning: false,
      notify_new_request: true,
      notify_weekly_summary: false,
      created_at: iso(now - 240 * DAY),
    },
    {
      id: USER_EXEC,
      full_name: 'Emanuel Nebiyu',
      email: 'emanuel@zareinnovations.com',
      role: 'exec',
      notify_scarcity: true,
      notify_decay_warning: false,
      notify_new_request: true,
      notify_weekly_summary: true,
      created_at: iso(now - 400 * DAY),
    },
  ];
}

export function seedArchetypes(now: number): Archetype[] {
  return [
    {
      id: ARCHETYPE_CSR,
      name: 'Customer Service Representative',
      code: 'CSR',
      target_ready: 20,
      freshness_days: 30,
      coverage_ratio: 4.0,
      color: '#10cfd1',
      communication_weight: 0.7,
      technical_weight: 0.3,
      // Recorded as green at the last check, so the demo opens mid-slide:
      // CSR is amber now, and running the scarcity check shows a real alert.
      last_health_status: 'green',
      retired_at: null,
      created_at: iso(now - 400 * DAY),
    },
    {
      id: ARCHETYPE_SWE,
      name: 'Software Engineer',
      code: 'SWE',
      target_ready: 12,
      freshness_days: 45,
      coverage_ratio: 5.0,
      color: '#7c8cf8',
      communication_weight: 0.4,
      technical_weight: 0.6,
      last_health_status: 'amber',
      retired_at: null,
      created_at: iso(now - 400 * DAY),
    },
  ];
}

/** How a seeded candidate should sit when the demo opens. */
type Spec = {
  name: string;
  location: string;
  arch: 'CSR' | 'SWE';
  /**
   * Calendar days ago availability was last confirmed (0 = earlier today).
   * null = never verified.
   */
  verifiedDaysAgo: number | null;
  /** An earlier confirmation, for candidates re-confirmed once they were due. */
  previousVerifiedDaysAgo?: number;
  /** Days ago they were archived. Defaults to 25. */
  archivedDaysAgo?: number;
  /** Shifts they can work, as asked at assessment and on the last call. */
  shifts?: string[];
  /** Internal notes. Never exported. */
  notes?: string;
  status: 'available' | 'not_available' | 'unknown';
  /** Omit to leave the candidate Raw. */
  assessedDaysAgo?: number;
  years?: number;
  seniority?: 'junior' | 'mid' | 'senior' | 'lead';
  english?: 'C2' | 'C1' | 'B2' | 'B1';
  comm?: number;
  tech?: number;
  /**
   * Leave unset: overall is calculated from comm and tech, as the database
   * does. Set it only to seed a deliberate override, with overrideReason.
   */
  overall?: number;
  overrideReason?: string;
  stack?: string[];
  skills?: string[];
  strengths?: [string, string];
  concern?: string;
  archived?: ArchiveReason;
  /**
   * Days until the recall date. For archived candidates, negative means the
   * recall is already due. For Not available, the date they asked to be
   * called again.
   */
  recallInDays?: number;
  owner?: string;
  notice?: string;
  startInDays?: number;
  /** Seeds an unanswered call this many hours ago. */
  noAnswerHoursAgo?: number;
};

const ADDIS = 'Addis Ababa';

/**
 * The bench.
 *
 * CSR is deliberately short of its target of 20 and SWE deliberately over 12,
 * so the dashboard opens with one amber ring and one green one and the
 * contrast is visible without touching anything.
 */
const SPECS: Spec[] = [
  // ---- CSR, Ready (fresh within 30 days) --------------------------------
  // Meseret, Kalkidan, Rahel, Eden and Tigist were each re-confirmed by
  // Hanna once their previous confirmation had run out: today, today,
  // yesterday, two and three days ago. That is Hanna's calls today and her
  // four-day streak, and every one of those calls was due.
  { name: 'Meseret Alemu', location: ADDIS, arch: 'CSR', verifiedDaysAgo: 0, previousVerifiedDaysAgo: 31, status: 'available', assessedDaysAgo: 60, years: 4, seniority: 'mid', english: 'C1', comm: 4.6, skills: ['Zendesk', 'Live chat', 'Escalation handling'], shifts: ['Day', 'Evening'], strengths: ['Handles escalations without needing a supervisor', 'Writes clear, complete case notes'], concern: 'Has not worked a rotating night shift before', owner: USER_RECRUITER_1, notice: 'Immediate' },
  { name: 'Yonas Haile', location: ADDIS, arch: 'CSR', verifiedDaysAgo: 3, status: 'available', assessedDaysAgo: 80, years: 6, seniority: 'senior', english: 'C1', comm: 4.7, skills: ['Salesforce', 'Team lead', 'QA scoring'], shifts: ['Day'], strengths: ['Six years unbroken in one BPO account', 'Has trained and scored junior agents'], concern: 'Most of that experience is on a single long-running account', owner: USER_RECRUITER_2, notice: '2 weeks', startInDays: 14 },
  { name: 'Bethlehem Assefa', location: ADDIS, arch: 'CSR', verifiedDaysAgo: 5, status: 'available', assessedDaysAgo: 45, years: 3, seniority: 'mid', english: 'C1', comm: 4.4, skills: ['Intercom', 'Order support', 'Refund policy'], shifts: ['Day', 'Weekend'], strengths: ['Very steady under repetitive volume', 'Comfortable with written-only support'], concern: 'Limited voice experience, mostly chat and email', owner: USER_RECRUITER_2, notice: '1 week', startInDays: 7 },
  { name: 'Kalkidan Wolde', location: ADDIS, arch: 'CSR', verifiedDaysAgo: 0, previousVerifiedDaysAgo: 33, status: 'available', assessedDaysAgo: 120, years: 5, seniority: 'senior', english: 'C2', comm: 4.8, skills: ['Voice', 'Complaints', 'CRM admin'], shifts: ['Evening', 'Night'], strengths: ['Near-native English on voice calls', 'Calm with hostile callers'], concern: 'Wants to move toward QA within a year', owner: USER_RECRUITER_1, notice: '2 weeks', startInDays: 14 },
  { name: 'Nahom Getachew', location: ADDIS, arch: 'CSR', verifiedDaysAgo: 8, status: 'available', assessedDaysAgo: 90, years: 2, seniority: 'junior', english: 'B2', comm: 4.0, skills: ['Freshdesk', 'Email support'], shifts: ['Day', 'Evening'], strengths: ['Fast, accurate typist', 'Follows scripts precisely'], concern: 'Needs supervision on unscripted escalations', owner: USER_RECRUITER_2, notice: 'Immediate' },
  { name: 'Rahel Mekonnen', location: ADDIS, arch: 'CSR', verifiedDaysAgo: 1, previousVerifiedDaysAgo: 32, status: 'available', assessedDaysAgo: 70, years: 4, seniority: 'mid', english: 'C1', comm: 4.5, skills: ['Zendesk', 'Billing support', 'Retention'], shifts: ['Day'], strengths: ['Strong on billing disputes', 'Retention save rate above team average'], concern: 'Prefers not to work weekends', owner: USER_RECRUITER_1, notice: '1 week', startInDays: 7 },
  { name: 'Abel Tadesse', location: ADDIS, arch: 'CSR', verifiedDaysAgo: 11, status: 'available', assessedDaysAgo: 150, years: 7, seniority: 'lead', english: 'C1', comm: 4.6, overall: 4.8, overrideReason: 'Has run a 12-person pod; leadership is not captured by the communication score', skills: ['Team lead', 'Workforce planning', 'Coaching'], shifts: ['Day', 'Evening'], strengths: ['Has run a 12-person support pod', 'Builds rotas and handles shrinkage'], concern: 'Looking for a lead role specifically, not an agent seat', owner: USER_RECRUITER_2, notice: '1 month', startInDays: 30 },
  { name: 'Tigist Girma', location: ADDIS, arch: 'CSR', verifiedDaysAgo: 3, previousVerifiedDaysAgo: 34, status: 'available', assessedDaysAgo: 55, years: 3, seniority: 'mid', english: 'B2', comm: 4.1, overall: 3.8, overrideReason: 'Voice clarity needed a second listen on two of three test calls', skills: ['Voice', 'Outbound', 'Scheduling'], shifts: ['Evening'], strengths: ['Comfortable on outbound as well as inbound', 'Reliable timekeeping record'], concern: 'Accent occasionally needs a second listen on voice', owner: USER_RECRUITER_1, notice: '2 weeks', startInDays: 14 },
  { name: 'Samuel Fikru', location: ADDIS, arch: 'CSR', verifiedDaysAgo: 16, status: 'available', assessedDaysAgo: 100, years: 5, seniority: 'senior', english: 'C1', comm: 4.5, skills: ['HubSpot', 'Onboarding', 'Technical triage'], shifts: ['Day'], strengths: ['Bridges support and technical teams well', 'Has owned customer onboarding end to end'], concern: 'Has only worked with one CRM in depth', owner: USER_RECRUITER_2, notice: '2 weeks', startInDays: 14 },
  { name: 'Eden Solomon', location: ADDIS, arch: 'CSR', verifiedDaysAgo: 2, previousVerifiedDaysAgo: 33, status: 'available', assessedDaysAgo: 65, years: 2, seniority: 'junior', english: 'B2', comm: 4.0, skills: ['Live chat', 'Social support'], shifts: ['Evening', 'Weekend'], strengths: ['Handles three chats concurrently', 'Good tone on social channels'], concern: 'Under two years of experience', owner: USER_RECRUITER_1, notice: 'Immediate' },

  // Expiring within 7 days — the queue's Expiring bucket, and the decay ticker.
  { name: 'Mahlet Desta', location: ADDIS, arch: 'CSR', verifiedDaysAgo: 25, status: 'available', assessedDaysAgo: 85, years: 4, seniority: 'mid', english: 'C1', comm: 4.3, skills: ['Zendesk', 'Voice', 'Complaints'], shifts: ['Day', 'Evening'], strengths: ['Consistent quality scores over two years', 'Handles complaint calls without escalating'], concern: 'Has never worked with a US-hours schedule', owner: USER_RECRUITER_1, notice: '1 week', startInDays: 7 },
  { name: 'Biruk Alemayehu', location: ADDIS, arch: 'CSR', verifiedDaysAgo: 26, status: 'available', assessedDaysAgo: 95, years: 3, seniority: 'mid', english: 'B2', comm: 4.1, skills: ['Freshdesk', 'Order tracking'], shifts: ['Day'], strengths: ['Very low average handling time', 'Meticulous with order records'], concern: 'Written English is stronger than spoken', owner: USER_RECRUITER_2, notice: '2 weeks', startInDays: 14 },
  { name: 'Fikirte Berhanu', location: ADDIS, arch: 'CSR', verifiedDaysAgo: 28, status: 'available', assessedDaysAgo: 110, years: 6, seniority: 'senior', english: 'C1', comm: 4.6, skills: ['Voice', 'Team lead', 'Zendesk'], shifts: ['Evening', 'Night'], strengths: ['Has acted up as a shift lead', 'Trusted with VIP accounts'], concern: 'Has not yet led a team of more than six', owner: USER_RECRUITER_1, notice: '1 month', startInDays: 30 },

  // Expired — the Expired bucket, most overdue first.
  { name: 'Dagmawi Terefe', location: ADDIS, arch: 'CSR', verifiedDaysAgo: 34, status: 'available', assessedDaysAgo: 130, years: 4, seniority: 'mid', english: 'C1', comm: 4.4, skills: ['Salesforce', 'Voice'], shifts: ['Day', 'Evening'], strengths: ['Strong product knowledge retention', 'Good first-contact resolution rate'], concern: 'Wants a hybrid arrangement, not fully remote', owner: USER_RECRUITER_2, notice: '2 weeks', startInDays: 14 },
  // Called this morning, no answer: cooling down, back in Retry in two days.
  { name: 'Sara Girmay', location: ADDIS, arch: 'CSR', verifiedDaysAgo: 41, status: 'available', assessedDaysAgo: 140, years: 3, seniority: 'mid', english: 'B2', comm: 4.0, skills: ['Live chat', 'Email support'], shifts: ['Evening'], strengths: ['Handles high chat volume calmly', 'Clear written English'], concern: 'No voice support experience at all', owner: USER_RECRUITER_1, notice: '1 week', startInDays: 7, noAnswerHoursAgo: 3 },
  { name: 'Henok Mulugeta', location: ADDIS, arch: 'CSR', verifiedDaysAgo: 52, status: 'available', assessedDaysAgo: 160, years: 5, seniority: 'senior', english: 'C1', comm: 4.5, skills: ['Zendesk', 'QA', 'Coaching'], shifts: ['Day'], strengths: ['Has built QA scorecards from scratch', 'Coaches without friction'], concern: 'Prefers QA work over frontline support', owner: USER_RECRUITER_2, notice: '1 month', startInDays: 30 },
  { name: 'Lidya Tesfaye', location: ADDIS, arch: 'CSR', verifiedDaysAgo: 68, status: 'available', assessedDaysAgo: 175, years: 2, seniority: 'junior', english: 'B2', comm: 3.9, skills: ['Intercom', 'Order support'], shifts: ['Day', 'Evening'], strengths: ['Learns new tooling quickly', 'Reliable and punctual'], concern: 'Limited experience with angry customers', owner: USER_RECRUITER_1, notice: 'Immediate' },

  // Said not available four days ago and asked to be called in the new year.
  // Out of the queue and out of every count until then.
  { name: 'Robel Assefa', location: ADDIS, arch: 'CSR', verifiedDaysAgo: 4, status: 'not_available', recallInDays: 105, assessedDaysAgo: 75, years: 4, seniority: 'mid', english: 'C1', comm: 4.3, skills: ['Voice', 'Zendesk'], shifts: ['Day', 'Evening'], strengths: ['Solid all-round support generalist', 'Good escalation judgement'], concern: 'Prefers longer engagements to short placements', notes: 'Just started a contract elsewhere; says he is free from January.', owner: USER_RECRUITER_2, notice: '3 months' },

  // Assessed but never verified — top of the Expired bucket.
  { name: 'Hiwot Kebede', location: ADDIS, arch: 'CSR', verifiedDaysAgo: null, status: 'unknown', assessedDaysAgo: 20, years: 3, seniority: 'mid', english: 'C1', comm: 4.2, skills: ['Zendesk', 'Billing'], shifts: ['Day'], strengths: ['Assessed strongly on billing scenarios', 'Clear and confident on the phone'], concern: 'Has not yet worked a live billing queue', owner: USER_RECRUITER_1 },

  // Expired, and unanswered six hours ago: cooling down, then Retry. His
  // earlier confirmation predates asking for notice and start, so the next
  // Available call is the first to record them.
  { name: 'Bereket Solomon', location: ADDIS, arch: 'CSR', verifiedDaysAgo: 40, status: 'available', assessedDaysAgo: 120, years: 4, seniority: 'mid', english: 'B2', comm: 4.1, skills: ['Voice', 'Freshdesk'], shifts: ['Day'], strengths: ['Dependable on early shifts', 'Good with elderly callers'], concern: 'Slower on written tickets than on voice', owner: USER_RECRUITER_2, noAnswerHoursAgo: 6 },

  // Raw — sourced, not assessed. Never in the queue, no shifts recorded.
  { name: 'Tsion Bekele', location: ADDIS, arch: 'CSR', verifiedDaysAgo: null, status: 'unknown', owner: USER_RECRUITER_1 },
  { name: 'Amanuel Girma', location: 'Bishoftu', arch: 'CSR', verifiedDaysAgo: null, status: 'unknown', owner: USER_RECRUITER_2 },
  { name: 'Feven Haile', location: ADDIS, arch: 'CSR', verifiedDaysAgo: null, status: 'unknown', owner: USER_RECRUITER_1 },

  // Archived.
  { name: 'Yohannes Abera', location: ADDIS, arch: 'CSR', verifiedDaysAgo: 95, status: 'not_available', assessedDaysAgo: 200, years: 4, seniority: 'mid', english: 'C1', comm: 4.2, skills: ['Voice'], shifts: ['Day'], strengths: ['Strong voice presence', 'Good retention numbers'], concern: 'Took a role at a competitor', archived: 'took_other_job', recallInDays: -4, owner: USER_RECRUITER_1 },
  { name: 'Selam Tadesse', location: ADDIS, arch: 'CSR', verifiedDaysAgo: 120, status: 'not_available', assessedDaysAgo: 210, years: 3, seniority: 'mid', english: 'B2', comm: 4.0, skills: ['Chat'], shifts: ['Day'], strengths: ['Good chat throughput', 'Polite under pressure'], concern: 'Was not interested in remote work', archived: 'not_interested', recallInDays: 200, owner: USER_RECRUITER_2 },
  { name: 'Kidus Mengistu', location: ADDIS, arch: 'CSR', verifiedDaysAgo: 150, status: 'not_available', assessedDaysAgo: 220, years: 5, seniority: 'senior', english: 'C1', comm: 4.4, skills: ['Voice', 'Team lead'], shifts: ['Day', 'Evening'], strengths: ['Experienced shift lead', 'Handled a full account migration'], concern: 'Relocated to Nairobi permanently', archived: 'left_country', owner: USER_RECRUITER_1 },

  // ---- SWE, Ready (fresh within 45 days) --------------------------------
  { name: 'Nebiyu Alemu', location: ADDIS, arch: 'SWE', verifiedDaysAgo: 3, status: 'available', assessedDaysAgo: 70, years: 6, seniority: 'senior', english: 'C1', comm: 4.4, tech: 4.7, stack: ['React', 'Node.js', 'PostgreSQL', 'AWS'], skills: ['System design', 'Code review'], shifts: ['Day'], strengths: ['Has owned a production system end to end', 'Reviews others code thoroughly and kindly'], concern: 'Limited exposure to mobile platforms', owner: USER_RECRUITER_1, notice: '2 weeks', startInDays: 14 },
  { name: 'Mikias Tesfaye', location: ADDIS, arch: 'SWE', verifiedDaysAgo: 5, status: 'available', assessedDaysAgo: 55, years: 4, seniority: 'mid', english: 'C1', comm: 4.2, tech: 4.5, stack: ['TypeScript', 'React', 'Next.js'], skills: ['Frontend architecture', 'Accessibility'], shifts: ['Day', 'Evening'], strengths: ['Strong on accessible component work', 'Ships without hand-holding'], concern: 'Backend experience is shallow', owner: USER_RECRUITER_2, notice: '1 month', startInDays: 30 },
  { name: 'Betelhem Assefa', location: ADDIS, arch: 'SWE', verifiedDaysAgo: 8, status: 'available', assessedDaysAgo: 90, years: 7, seniority: 'lead', english: 'C2', comm: 4.8, tech: 4.8, stack: ['Python', 'Django', 'PostgreSQL', 'Docker'], skills: ['Team lead', 'Mentoring', 'CI/CD'], shifts: ['Day'], strengths: ['Has led a four-person team for two years', 'Excellent written and spoken English'], concern: 'Expects a lead role, not an individual contributor seat', owner: USER_RECRUITER_1, notice: '1 month', startInDays: 30 },
  { name: 'Yared Fikru', location: ADDIS, arch: 'SWE', verifiedDaysAgo: 12, status: 'available', assessedDaysAgo: 65, years: 3, seniority: 'mid', english: 'B2', comm: 4.0, tech: 4.3, stack: ['Java', 'Spring', 'MySQL'], skills: ['API design', 'Testing'], shifts: ['Day'], strengths: ['Disciplined about test coverage', 'Comfortable in legacy codebases'], concern: 'Spoken English lags written', owner: USER_RECRUITER_2, notice: '2 weeks', startInDays: 14 },
  { name: 'Rediet Bekele', location: ADDIS, arch: 'SWE', verifiedDaysAgo: 17, status: 'available', assessedDaysAgo: 100, years: 5, seniority: 'senior', english: 'C1', comm: 4.5, tech: 4.6, stack: ['React', 'TypeScript', 'GraphQL', 'AWS'], skills: ['Performance', 'Design systems'], shifts: ['Day', 'Evening'], strengths: ['Rebuilt a design system used by three teams', 'Measures before optimising'], concern: 'Has not worked in a regulated industry', owner: USER_RECRUITER_1, notice: '2 weeks', startInDays: 14 },
  { name: 'Ephrem Wolde', location: ADDIS, arch: 'SWE', verifiedDaysAgo: 22, status: 'available', assessedDaysAgo: 115, years: 4, seniority: 'mid', english: 'C1', comm: 4.3, tech: 4.4, stack: ['Node.js', 'PostgreSQL', 'Redis'], skills: ['Backend', 'Queues'], shifts: ['Day'], strengths: ['Solid with async and queue-based systems', 'Writes clear migration plans'], concern: 'Frontend work is not a strength', owner: USER_RECRUITER_2, notice: '1 month', startInDays: 30 },
  { name: 'Liya Mekonnen', location: ADDIS, arch: 'SWE', verifiedDaysAgo: 28, status: 'available', assessedDaysAgo: 80, years: 3, seniority: 'mid', english: 'C1', comm: 4.4, tech: 4.2, stack: ['Flutter', 'Dart', 'Firebase'], skills: ['Mobile', 'Offline-first'], shifts: ['Day', 'Evening'], strengths: ['Shipped two apps to both stores', 'Thinks carefully about offline states'], concern: 'Mobile only, no web experience', owner: USER_RECRUITER_1, notice: '2 weeks', startInDays: 14 },
  // Assessed over 180 days ago: flagged Re-assess due, still exportable.
  { name: 'Kirubel Haile', location: ADDIS, arch: 'SWE', verifiedDaysAgo: 33, status: 'available', assessedDaysAgo: 200, years: 8, seniority: 'lead', english: 'C1', comm: 4.5, tech: 4.9, stack: ['Go', 'Kubernetes', 'PostgreSQL', 'AWS'], skills: ['Infrastructure', 'Observability'], shifts: ['Day'], strengths: ['Deep infrastructure and reliability experience', 'Has carried a production pager for years'], concern: 'More at home on infrastructure than on product features', owner: USER_RECRUITER_2, notice: '1 month', startInDays: 30 },

  // SWE expiring soon.
  { name: 'Naol Tadesse', location: ADDIS, arch: 'SWE', verifiedDaysAgo: 40, status: 'available', assessedDaysAgo: 95, years: 4, seniority: 'mid', english: 'B2', comm: 4.0, tech: 4.3, stack: ['React', 'Node.js', 'MongoDB'], skills: ['Full-stack'], shifts: ['Day', 'Evening'], strengths: ['Comfortable across the whole stack', 'Pragmatic about scope'], concern: 'Tends to under-document work', owner: USER_RECRUITER_1, notice: '2 weeks', startInDays: 14 },
  { name: 'Mahder Girma', location: ADDIS, arch: 'SWE', verifiedDaysAgo: 43, status: 'available', assessedDaysAgo: 105, years: 5, seniority: 'senior', english: 'C1', comm: 4.4, tech: 4.5, stack: ['Python', 'FastAPI', 'PostgreSQL'], skills: ['Data pipelines', 'API design'], shifts: ['Day'], strengths: ['Strong data modelling instincts', 'Good at making tradeoffs explicit'], concern: 'Prefers backend work exclusively', owner: USER_RECRUITER_2, notice: '1 month', startInDays: 30 },

  // SWE expired.
  { name: 'Abenezer Mulu', location: ADDIS, arch: 'SWE', verifiedDaysAgo: 58, status: 'available', assessedDaysAgo: 145, years: 6, seniority: 'senior', english: 'C1', comm: 4.3, tech: 4.6, stack: ['C#', '.NET', 'SQL Server', 'Azure'], skills: ['Enterprise', 'Integrations'], shifts: ['Day'], strengths: ['Deep enterprise integration experience', 'Handles ambiguous requirements well'], concern: 'Microsoft stack only', owner: USER_RECRUITER_1, notice: '1 month', startInDays: 30 },
  { name: 'Saron Alemayehu', location: ADDIS, arch: 'SWE', verifiedDaysAgo: 72, status: 'available', assessedDaysAgo: 155, years: 3, seniority: 'mid', english: 'B2', comm: 4.0, tech: 4.1, overall: 3.7, overrideReason: 'Stack is older than most client requirements, which the scores do not reflect', stack: ['Vue', 'JavaScript', 'PHP'], skills: ['Frontend', 'WordPress'], shifts: ['Day', 'Evening'], strengths: ['Fast with UI implementation', 'Good eye for visual detail'], concern: 'Stack is older than most client requirements', owner: USER_RECRUITER_2, notice: '2 weeks', startInDays: 14 },

  // SWE Ready but expiring: called three days ago when he fell due, no
  // answer. Past the cooldown now, so back in the queue as Retry.
  { name: 'Tewodros Kebede', location: ADDIS, arch: 'SWE', verifiedDaysAgo: 42, status: 'available', assessedDaysAgo: 110, years: 5, seniority: 'senior', english: 'C1', comm: 4.4, tech: 4.5, stack: ['React', 'Node.js', 'AWS'], skills: ['Full-stack', 'Mentoring'], shifts: ['Day'], strengths: ['Reliable senior generalist', 'Mentors juniors well'], concern: 'Two recent short tenures on the CV', owner: USER_RECRUITER_1, notice: '2 weeks', startInDays: 14, noAnswerHoursAgo: 76 },

  // SWE raw and archived.
  { name: 'Dagim Assefa', location: ADDIS, arch: 'SWE', verifiedDaysAgo: null, status: 'unknown', owner: USER_RECRUITER_2 },
  { name: 'Hana Teshome', location: 'Hawassa', arch: 'SWE', verifiedDaysAgo: null, status: 'unknown', owner: USER_RECRUITER_1 },
  { name: 'Surafel Bekele', location: ADDIS, arch: 'SWE', verifiedDaysAgo: 130, status: 'not_available', assessedDaysAgo: 190, years: 6, seniority: 'senior', english: 'C1', comm: 4.3, tech: 4.6, stack: ['Go', 'PostgreSQL'], skills: ['Backend'], shifts: ['Day'], strengths: ['Strong systems programmer', 'Careful with data integrity'], concern: 'Accepted a role in Dubai', archived: 'took_other_job', recallInDays: -12, owner: USER_RECRUITER_2 },

  // Anonymised do_not_contact — must appear on NO screen, in NO count.
  { name: 'REDACTED', location: ADDIS, arch: 'SWE', verifiedDaysAgo: 200, status: 'unknown', assessedDaysAgo: 240, years: 4, seniority: 'mid', english: 'B2', comm: 4.0, tech: 4.0, stack: ['Java'], skills: ['Backend'], strengths: ['Assessment retained', 'Identity stripped'], concern: 'Requested no further contact', archived: 'do_not_contact', owner: USER_RECRUITER_1 },

  // Placed with Harbor Retail when that request closed this quarter. Added
  // last so every earlier seeded id stays the same.
  { name: 'Mekdes Ayele', location: ADDIS, arch: 'CSR', verifiedDaysAgo: 20, status: 'available', assessedDaysAgo: 70, years: 3, seniority: 'mid', english: 'C1', comm: 4.4, skills: ['Zendesk', 'Order support'], shifts: ['Day'], strengths: ['Consistent quality on high volume', 'Picks up new tooling in days'], concern: 'Has only worked for retail clients', archived: 'placed', archivedDaysAgo: 12, owner: USER_RECRUITER_1, notice: '1 week', startInDays: 7 },
  { name: 'Yeabsira Tadesse', location: ADDIS, arch: 'CSR', verifiedDaysAgo: 20, status: 'available', assessedDaysAgo: 90, years: 4, seniority: 'mid', english: 'B2', comm: 4.1, skills: ['Freshdesk', 'Returns'], shifts: ['Day', 'Weekend'], strengths: ['Calm with frustrated customers', 'Accurate with refunds and returns'], concern: 'Prefers not to work nights', archived: 'placed', archivedDaysAgo: 12, owner: USER_RECRUITER_2, notice: 'Immediate' },
];

export function seedCandidates(now: number): { candidates: Candidate[]; calls: CallLog[] } {
  const candidates: Candidate[] = [];
  const calls: CallLog[] = [];

  // Seeded moments land on real calendar days in East Africa Time, so
  // "today", "yesterday" and the streak are right whatever time the demo
  // starts. Earlier days use 11:00 EAT; today uses an hour or two ago, but
  // never before midnight.
  const midnight = startOfToday(new Date(now)).getTime();
  const onDay = (daysAgo: number, slot = 0) =>
    daysAgo === 0
      ? Math.max(now - (2 + slot) * HOUR, midnight + (slot + 1) * 5 * 60_000)
      : midnight - daysAgo * DAY + (11 + slot) * HOUR;
  const hoursAgo = (h: number) => Math.max(now - h * HOUR, h < 24 ? midnight + 60_000 : now - h * HOUR);

  const call = (c: Omit<CallLog, 'note' | 'notice_period' | 'earliest_start_date' | 'shift_flexibility' | 'recall_at'> & Partial<CallLog>): CallLog => ({
    note: null,
    notice_period: null,
    earliest_start_date: null,
    shift_flexibility: null,
    recall_at: null,
    ...c,
  });

  let todaySlot = 0;

  SPECS.forEach((s, i) => {
    const id = `c1000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
    const archetype_id = s.arch === 'CSR' ? ARCHETYPE_CSR : ARCHETYPE_SWE;
    const assessed = s.assessedDaysAgo !== undefined;
    const isDeleted = s.archived === 'do_not_contact';
    const owner = s.owner ?? USER_RECRUITER_1;
    const shifts = assessed ? (s.shifts ?? []) : [];

    // ---- the call history, oldest first ---------------------------------
    const history: CallLog[] = [];
    if (!isDeleted) {
      if (s.previousVerifiedDaysAgo !== undefined) {
        history.push(
          call({
            id: `l-${id}-v0`,
            candidate_id: id,
            called_by: owner,
            outcome: 'available',
            called_at: iso(onDay(s.previousVerifiedDaysAgo)),
            notice_period: s.notice ?? null,
            earliest_start_date: null,
            shift_flexibility: shifts,
          }),
        );
      }
      if (s.verifiedDaysAgo !== null) {
        const at = onDay(s.verifiedDaysAgo, s.verifiedDaysAgo === 0 ? todaySlot++ : 0);
        const available = s.status === 'available';
        history.push(
          call({
            id: `l-${id}-v`,
            candidate_id: id,
            called_by: owner,
            outcome: available ? 'available' : 'not_available',
            called_at: iso(at),
            // Bereket's confirmation predates asking for notice and start.
            notice_period: available && s.notice ? s.notice : null,
            earliest_start_date:
              available && s.notice && s.notice !== IMMEDIATE && s.startInDays !== undefined
                ? day(now + s.startInDays * DAY)
                : null,
            shift_flexibility: available ? shifts : null,
            recall_at: !available && !s.archived && s.recallInDays !== undefined ? day(now + s.recallInDays * DAY) : null,
          }),
        );
      }
      if (s.noAnswerHoursAgo !== undefined) {
        history.push(
          call({
            id: `l-${id}-na`,
            candidate_id: id,
            called_by: owner,
            outcome: 'no_answer',
            called_at: iso(hoursAgo(s.noAnswerHoursAgo)),
          }),
        );
      }
      if (s.archived) {
        history.push(
          call({
            id: `l-${id}-ar`,
            candidate_id: id,
            called_by: owner,
            outcome: 'archived',
            note: s.archived,
            called_at: iso(now - (s.archivedDaysAgo ?? 25) * DAY),
          }),
        );
      }
    }

    // ---- the record: assessment from the spec, availability from calls ---
    const weights = seedArchetypes(now).find((a) => a.id === archetype_id)!;
    let candidate = applyOverallScore<Candidate>({
      id,
      ref_code: `ZT-${String(i + 1).padStart(4, '0')}`,
      archetype_id,
      full_name: isDeleted ? null : s.name,
      phone: isDeleted ? null : `+2519${String(11000000 + i * 7919).slice(0, 8)}`,
      email: isDeleted
        ? null
        : `${s.name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`,
      location: isDeleted ? null : s.location,
      linkedin_url: null,
      years_experience: s.years ?? null,
      seniority: s.seniority ?? null,
      stack: s.stack ?? [],
      skills: s.skills ?? [],
      english_level: s.english ?? null,
      communication_score: s.comm ?? null,
      technical_score: s.tech ?? null,
      // Placeholders: applyOverallScore below fills these the way the
      // database trigger would.
      overall_score: s.overall ?? null,
      overall_score_calculated: null,
      overall_override_reason: s.overrideReason ?? null,
      assessed_by: assessed ? owner : null,
      assessed_at: assessed ? iso(now - s.assessedDaysAgo! * DAY) : null,
      strengths: s.strengths ? [...s.strengths] : [],
      concern: s.concern ?? null,
      notes: isDeleted ? null : (s.notes ?? null),
      cv_url: null,
      // Availability starts blank and is set only by replaying calls below.
      availability_status: 'unknown',
      earliest_start_date: null,
      notice_period: null,
      last_verified_at: null,
      shift_flexibility: shifts,
      setup_verified: assessed,
      owner_id: owner,
      source: 'manual',
      applied_job_id: null,
      archived_reason: null,
      recall_at: null,
      ready_exit_alerted_for: null,
      deleted_at: isDeleted ? iso(now - 30 * DAY) : null,
      created_at: iso(now - (s.assessedDaysAgo ?? 10) * DAY - 5 * DAY),
      updated_at: iso(now - 10 * DAY),
    }, weights);

    // The record is whatever its calls say, applied by the same rule the
    // app uses, so the last confirmation and "last verified" always agree.
    for (const c of history) candidate = applyCall(candidate, c);
    if (s.archived) {
      candidate = {
        ...candidate,
        archived_reason: s.archived,
        recall_at: s.recallInDays !== undefined ? day(now + s.recallInDays * DAY) : null,
      };
    }
    if (isDeleted) {
      candidate = { ...candidate, availability_status: 'unknown', last_verified_at: null };
    }

    // The seed must satisfy the same constraints the database would, or the
    // demo shows states production could never reach.
    const problem = overallScoreProblem(candidate);
    if (problem) throw new Error(`Seed ${candidate.ref_code}: ${problem}`);
    candidates.push(candidate);
    calls.push(...history);
  });

  return { candidates, calls };
}

/** The seeded id of a candidate, by name. */
export function seedCandidateId(name: string): string {
  const i = SPECS.findIndex((x) => x.name === name);
  if (i < 0) throw new Error(`No seeded candidate named ${name}`);
  return `c1000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
}

/**
 * Requests whose status always matches their data: open has no shortlist,
 * shortlisting has a draft with people on it.
 */
export function seedRequests(
  now: number,
  candidates: Candidate[],
): {
  requests: ClientRequest[];
  shortlists: Shortlist[];
  shortlistCandidates: ShortlistCandidate[];
  placements: Placement[];
} {
  const r1 = 'r1000000-0000-4000-8000-000000000001';
  const r2 = 'r1000000-0000-4000-8000-000000000002';
  const r3 = 'r1000000-0000-4000-8000-000000000003';
  const s1 = 's1000000-0000-4000-8000-000000000001';
  const s2 = 's1000000-0000-4000-8000-000000000002';
  const r4 = 'r1000000-0000-4000-8000-000000000004';
  const s3 = 's1000000-0000-4000-8000-000000000003';

  // Harbor Retail closed this quarter: twelve days ago, or just after the
  // quarter began if that is sooner, so the dashboard always has a figure.
  const [y, m] = day(now).split('-').map(Number);
  const quarterStart = Date.parse(`${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, '0')}-01T02:00:00+03:00`);
  const closedAt = Math.min(now, Math.max(now - 12 * DAY, quarterStart));
  const exportedAt = closedAt - 3 * DAY;
  const open = { outcome: null, closed_at: null, placed_outside: 0 } as const;

  const entry = (shortlist_id: string, name: string, position: number): ShortlistCandidate => {
    const id = seedCandidateId(name);
    const c = candidates.find((x) => x.id === id)!;
    return {
      id: `slc-${shortlist_id.slice(-2)}-${position}`,
      shortlist_id,
      candidate_id: id,
      verified_at: c.last_verified_at ?? iso(now),
      position,
    };
  };

  return {
    requests: [
      {
        id: r1,
        client_name: 'BETA Technologies',
        title: null,
        archetype_id: ARCHETYPE_CSR,
        quantity: 5,
        required_by: day(now + 14 * DAY),
        status: 'open',
        // US Central business hours are evenings in Addis.
        required_skills: ['Voice'],
        required_shifts: ['Evening'],
        notes: 'US Central hours. Zendesk experience preferred.',
        created_by: USER_AM,
        created_at: iso(now - 2 * DAY),
        ...open,
      },
      {
        id: r2,
        client_name: 'Meridian Health',
        title: null,
        archetype_id: ARCHETYPE_SWE,
        quantity: 3,
        required_by: day(now + 30 * DAY),
        status: 'shortlisting',
        required_skills: ['React', 'Node.js'],
        required_shifts: [],
        notes: 'Regulated environment, needs careful documentation.',
        created_by: USER_AM,
        created_at: iso(now - 9 * DAY),
        ...open,
      },
      {
        id: r3,
        client_name: 'Northwind Logistics',
        title: null,
        archetype_id: ARCHETYPE_CSR,
        quantity: 8,
        required_by: day(now + 5 * DAY),
        status: 'shortlisting',
        required_skills: [],
        required_shifts: ['Evening'],
        notes: 'Large intake, phased over two months.',
        created_by: USER_EXEC,
        created_at: iso(now - 1 * DAY),
        ...open,
      },
      {
        id: r4,
        client_name: 'Harbor Retail Group',
        title: null,
        archetype_id: ARCHETYPE_CSR,
        quantity: 3,
        required_by: day(closedAt),
        status: 'closed',
        required_skills: [],
        required_shifts: ['Day'],
        notes: 'Order and returns support.',
        created_by: USER_AM,
        created_at: iso(exportedAt - 10 * DAY),
        // Two from the bench, one sourced outside it.
        outcome: 'filled',
        closed_at: iso(closedAt),
        placed_outside: 1,
      },
    ],
    shortlists: [
      {
        id: s1,
        request_id: r2,
        title: 'Meridian Health — Software Engineers',
        status: 'draft',
        exported_at: null,
        exported_by: null,
        pdf_url: null,
        exported_document: null,
      },
      {
        id: s2,
        request_id: r3,
        title: 'Northwind Logistics — Customer Service Representatives',
        status: 'draft',
        exported_at: null,
        exported_by: null,
        pdf_url: null,
        exported_document: null,
      },
      {
        id: s3,
        request_id: r4,
        title: 'Harbor Retail Group — Customer Service Representatives',
        status: 'exported',
        exported_at: iso(exportedAt),
        exported_by: USER_AM,
        pdf_url: null,
        // Frozen as sent, from the records as they were that day.
        exported_document: buildShortlistExport({
          request: { client_name: 'Harbor Retail Group', quantity: 3 },
          archetype: seedArchetypes(now).find((a) => a.id === ARCHETYPE_CSR)!,
          preparedBy: seedUsers(now).find((u) => u.id === USER_AM)!,
          entries: ['Mekdes Ayele', 'Yeabsira Tadesse', 'Samuel Fikru'].map((name) => {
            const c = candidates.find((x) => x.id === seedCandidateId(name))!;
            const archetype = seedArchetypes(now).find((a) => a.id === c.archetype_id)!;
            const asSent = { ...c, archived_reason: null };
            return { candidate: toCandidateView(asSent, archetype, new Date(exportedAt)), verified_at: c.last_verified_at! };
          }),
          now: new Date(exportedAt),
          frozen: true,
        }),
      },
    ],
    shortlistCandidates: [
      entry(s1, 'Nebiyu Alemu', 0),
      // Last call unanswered: the builder warns before anyone relies on him.
      entry(s1, 'Tewodros Kebede', 1),
      entry(s2, 'Kalkidan Wolde', 0),
      // Her confirmation runs out before Northwind's deadline.
      entry(s2, 'Fikirte Berhanu', 1),
      entry(s3, 'Mekdes Ayele', 0),
      entry(s3, 'Yeabsira Tadesse', 1),
      entry(s3, 'Samuel Fikru', 2),
    ],
    placements: ['Mekdes Ayele', 'Yeabsira Tadesse'].map((name, i) => ({
      id: `pl-${i + 1}`,
      request_id: r4,
      candidate_id: seedCandidateId(name),
      placed_at: iso(closedAt),
    })),
  };
}

/**
 * The last run of each job, so settings opens with history rather than a
 * blank table. Timed from each job's real schedule.
 */
export function seedJobRuns(now: number): JobRun[] {
  const WEEK = 7 * DAY;
  const at = (job: JobRun['job'], back: number) => nextRun(job, new Date(now)).getTime() - back;
  const run = (job: JobRun['job'], started: number, detail: JobRun['detail']): JobRun => ({
    id: `run-${job}`,
    job,
    triggered_by: null,
    started_at: iso(started),
    finished_at: iso(started + 2_000),
    emails_prepared: detail.length,
    detail,
    error: null,
    skipped_reason: null,
  });

  return [
    run('scarcity_check', at('scarcity_check', HOUR), []),
    run('decay_warning', at('decay_warning', WEEK), [
      {
        to_user_id: USER_RECRUITER_1,
        to_name: 'Hanna Tesfaye',
        to_email: 'hanna@zareinnovations.com',
        subject: '4 of your candidates leave Ready this week',
        summary: '4 expiring · 1 recall due',
      },
      {
        to_user_id: USER_RECRUITER_2,
        to_name: 'Dawit Bekele',
        to_email: 'dawit@zareinnovations.com',
        subject: '3 of your candidates leave Ready this week',
        summary: '3 expiring',
      },
    ]),
    run('weekly_summary', at('weekly_summary', WEEK), [
      {
        to_user_id: USER_EXEC,
        to_name: 'Emanuel Nebiyu',
        to_email: 'emanuel@zareinnovations.com',
        subject: 'Bench this week: 25 of 32 Ready',
        summary: '31 calls · 1 shortlist sent · 6 expiring next week',
      },
    ]),
  ];
}
