import type { Archetype, CandidateView, ClientRequest, HealthStatus, User } from '@/bench/data/types';
import { LEAVING_READY_ALERT_HOURS } from '@/bench/data/logic';
import { daysFromToday, formatShortDate, plural } from '@/bench/dates';
import type { DecayWarning, ScarcityTransition, WeeklyStats } from '@/bench/jobs';

/**
 * Email templates: plain functions from data to { subject, preheader, html,
 * text }.
 *
 * Like the jobs, these survive the database swap. The cron and request
 * handlers pass the same output straight to Resend; the demo renders it in
 * the preview screen. No React Email, no dependency: table layout and inline
 * styles are what Outlook and Gmail actually render, and a string template
 * is the most honest way to write that.
 *
 * Every interpolated value goes through esc(). Client names, candidate names
 * and notes are user-entered and end up inside HTML.
 *
 * These are INTERNAL emails to staff, so candidate names and phone numbers
 * are allowed here. The client-facing whitelist in lib/export does not apply
 * and must not be loosened to match.
 */

export interface RenderedEmail {
  subject: string;
  preheader: string;
  html: string;
  text: string;
}

export interface EmailContext {
  /** Absolute portal root, e.g. https://zareinnovations.com/portal */
  portalUrl: string;
  now: Date;
}

// ---------------------------------------------------------------- tokens ----

const C = {
  page: '#f4f6f8',
  card: '#ffffff',
  ink: '#0b0f14',
  dim: '#4b5563',
  faint: '#8a94a1',
  line: '#e5e7eb',
  accent: '#0a8f91',
  accentTint: '#e8f7f7',
  green: '#047857',
  amber: '#b45309',
  red: '#b91c1c',
};

const STATUS_COLOR: Record<HealthStatus, string> = { green: C.green, amber: C.amber, red: C.red };
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace";

export function esc(s: string | number | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const eatDate = formatShortDate;

const firstName = (u: Pick<User, 'full_name'>) => u.full_name.split(' ')[0];

// -------------------------------------------------------------- building ----

function layout(input: {
  preheader: string;
  eyebrow: string;
  heading: string;
  body: string;
  footerReason: string;
  ctx: EmailContext;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(input.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%;">
<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${esc(input.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
    <tr><td style="padding:0 4px 14px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:2px;color:${C.ink};">ZARE&nbsp;BENCH</td></tr>
    <tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:8px;padding:28px 28px 24px;font-family:${FONT};color:${C.ink};">
      <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${C.faint};">${esc(input.eyebrow)}</div>
      <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;font-weight:700;color:${C.ink};">${esc(input.heading)}</h1>
      ${input.body}
    </td></tr>
    <tr><td style="padding:16px 4px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.faint};">
      ${esc(input.footerReason)} <a href="${esc(input.ctx.portalUrl)}/settings#notifications" style="color:${C.faint};text-decoration:underline;">Change your notifications</a>.<br>
      Zare Innovations · Addis Ababa · Internal: do not forward outside the company.
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

function paragraph(html: string) {
  return `<p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:${C.dim};">${html}</p>`;
}

function button(label: string, href: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;"><tr>
<td style="background:${C.accent};border-radius:6px;">
<a href="${esc(href)}" style="display:inline-block;padding:11px 20px;font-family:${FONT};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${esc(label)}</a>
</td></tr></table>`;
}

function statRow(items: { label: string; value: string | number; color?: string }[]) {
  const width = Math.floor(100 / items.length);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;border-top:1px solid ${C.line};border-bottom:1px solid ${C.line};"><tr>
${items
  .map(
    (s) => `<td width="${width}%" valign="top" style="padding:14px 8px 14px 0;">
  <div style="font-family:${MONO};font-size:24px;font-weight:700;color:${s.color ?? C.ink};">${esc(s.value)}</div>
  <div style="margin-top:2px;font-size:12px;color:${C.faint};">${esc(s.label)}</div>
</td>`,
  )
  .join('')}
</tr></table>`;
}

function sectionTitle(t: string) {
  return `<div style="margin-top:24px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${C.faint};">${esc(t)}</div>`;
}

function rows(cols: { head: string; align?: 'left' | 'right' }[], data: string[][]) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;font-size:14px;">
<tr>${cols
    .map(
      (c) =>
        `<td align="${c.align ?? 'left'}" style="padding:6px 8px 6px 0;border-bottom:1px solid ${C.line};font-size:11px;color:${C.faint};">${esc(c.head)}</td>`,
    )
    .join('')}</tr>
${data
  .map(
    (r) =>
      `<tr>${r
        .map(
          (cell, i) =>
            `<td align="${cols[i].align ?? 'left'}" valign="top" style="padding:9px 8px 9px 0;border-bottom:1px solid ${C.line};color:${C.ink};">${cell}</td>`,
        )
        .join('')}</tr>`,
  )
  .join('\n')}
</table>`;
}

function pill(status: HealthStatus) {
  return `<span style="display:inline-block;padding:2px 8px;border-radius:10px;border:1px solid ${STATUS_COLOR[status]};font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:${STATUS_COLOR[status]};">${status}</span>`;
}

const refCode = (ref: string) => `<span style="font-family:${MONO};font-size:12px;color:${C.faint};">${esc(ref)}</span>`;

// ------------------------------------------------------------ scarcity ----

export function scarcitySubject(transitions: ScarcityTransition[], leaving: CandidateView[] = []): string {
  if (transitions.length === 0) {
    return `${plural(leaving.length, 'candidate leaves', 'candidates leave')} Ready within ${LEAVING_READY_ALERT_HOURS} hours`;
  }
  if (transitions.length !== 1) return `${transitions.length} benches got worse`;
  const t = transitions[0];
  return `${t.health.code} bench is ${t.to}: ${t.health.ready_count} of ${t.health.target_ready} Ready`;
}

export function renderScarcityAlert(input: {
  user: User;
  transitions: ScarcityTransition[];
  /** The recipient's candidates leaving Ready soon (LEAVING_READY_ALERT_HOURS), not alerted before. */
  leaving?: CandidateView[];
  ctx: EmailContext;
}): RenderedEmail {
  const { transitions, ctx } = input;
  const leaving = input.leaving ?? [];
  const oneCallAway = transitions.reduce((n, t) => n + t.health.one_call_away, 0);
  const subject = scarcitySubject(transitions, leaving);
  const preheader =
    transitions.length === 0
      ? `One call each keeps them Ready. First to go: ${leaving[0]?.full_name ?? ''}, ${dayPhrase(leaving[0]?.expires_at ?? null, ctx.now)}.`
      : oneCallAway > 0
        ? `${plural(oneCallAway, 'assessed candidate is', 'assessed candidates are')} one call away from Ready.`
        : 'Nobody is one call away. This needs sourcing.';

  const leavingTable = leaving.length
    ? `${sectionTitle(`Your candidates leaving Ready within ${LEAVING_READY_ALERT_HOURS} hours · ${leaving.length}`)}
${rows(
  [{ head: 'Candidate' }, { head: 'Phone' }, { head: 'Leaves Ready', align: 'right' }],
  leaving.map((v) => [
    `${esc(v.full_name)}<br>${refCode(v.ref_code)}`,
    v.phone ? `<a href="tel:${esc(v.phone.replace(/\s+/g, ''))}" style="color:${C.accent};text-decoration:none;white-space:nowrap;">${esc(v.phone)}</a>` : '—',
    `<span style="white-space:nowrap;color:${C.red};font-weight:600;">${esc(dayPhrase(v.expires_at, ctx.now))}</span>`,
  ]),
)}`
    : '';

  const blocks = transitions
    .map((t) => {
      const short = Math.max(0, t.health.target_ready - t.health.ready_count);
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;border:1px solid ${C.line};border-radius:6px;">
<tr><td style="padding:16px 18px;">
  <div style="font-size:15px;font-weight:600;color:${C.ink};">${esc(t.health.name)} <span style="font-family:${MONO};font-size:12px;color:${C.faint};">${esc(t.health.code)}</span></div>
  <div style="margin-top:6px;font-size:13px;color:${C.dim};">${pill(t.from)} &nbsp;→&nbsp; ${pill(t.to)}</div>
  ${statRow([
    { label: 'Ready', value: `${t.health.ready_count}/${t.health.target_ready}`, color: STATUS_COLOR[t.to] },
    { label: 'Short of target', value: short },
    { label: 'One call away', value: t.health.one_call_away, color: C.accent },
    { label: 'Expiring this week', value: t.health.expiring_this_week },
  ])}
</td></tr></table>`;
    })
    .join('');

  const advice =
    oneCallAway > 0
      ? `${plural(oneCallAway, 'candidate has', 'candidates have')} already been assessed and only ${oneCallAway === 1 ? 'needs' : 'need'} their availability confirmed. That is the fastest way back to green: no sourcing, no interviews, just calls.`
      : 'Nobody assessed is waiting on a call, so the gap can only be closed by sourcing and assessing new candidates.';

  const html = layout({
    preheader,
    eyebrow: 'Scarcity alert',
    heading:
      transitions.length === 0
        ? subject
        : transitions.length === 1
          ? `${transitions[0].health.name} bench dropped to ${transitions[0].to}`
          : 'Bench health got worse',
    body: `${paragraph(
      transitions.length
        ? `Hi ${esc(firstName(input.user))}, since the last check the bench has fewer Ready candidates than the business needs.`
        : `Hi ${esc(firstName(input.user))}, these people are about to leave Ready. One call each keeps them on the bench.`,
    )}
${blocks}
${transitions.length ? paragraph(esc(advice)) : ''}
${leavingTable}
${button(oneCallAway > 0 || leaving.length ? 'Open the call queue' : 'Add candidates', `${ctx.portalUrl}${oneCallAway > 0 || leaving.length ? '/queue' : '/candidates/new'}`)}`,
    footerReason: 'You get scarcity alerts when a role’s bench health gets worse.',
    ctx,
  });

  const text = [
    subject,
    '',
    `Hi ${firstName(input.user)}, since the last check the bench has fewer Ready candidates than the business needs.`,
    '',
    ...transitions.map(
      (t) =>
        `${t.health.name} (${t.health.code}): ${t.from} -> ${t.to}. ${t.health.ready_count}/${t.health.target_ready} Ready, ${t.health.one_call_away} one call away, ${t.health.expiring_this_week} expiring this week.`,
    ),
    ...(leaving.length
      ? ['', `LEAVING READY WITHIN ${LEAVING_READY_ALERT_HOURS} HOURS`, ...leaving.map((v) => `- ${v.full_name} (${v.ref_code}), ${v.phone ?? 'no phone'}: ${dayPhrase(v.expires_at, ctx.now)}`)]
      : []),
    '',
    transitions.length ? advice : '',
    '',
    `${oneCallAway > 0 ? 'Open the call queue' : 'Add candidates'}: ${ctx.portalUrl}${oneCallAway > 0 ? '/queue' : '/candidates/new'}`,
  ].join('\n');

  return { subject, preheader, html, text };
}

// --------------------------------------------------------------- decay ----

export function decaySubject(expiring: number, recalls: number): string {
  return expiring > 0
    ? `${plural(expiring, 'of your candidates leaves', 'of your candidates leave')} Ready this week`
    : `${plural(recalls, 'recall is', 'recalls are')} due`;
}

export function renderDecayWarning(input: { warning: DecayWarning; ctx: EmailContext }): RenderedEmail {
  const { user, expiring, recalls } = input.warning;
  const { ctx } = input;
  const subject = decaySubject(expiring.length, recalls.length);
  const preheader =
    expiring.length > 0
      ? `One call each keeps them on the bench. First to go: ${expiring[0].full_name}, ${dayPhrase(expiring[0].expires_at, ctx.now)}.`
      : 'People who said "not now" are due another call.';

  const expiringTable = expiring.length
    ? `${sectionTitle(`Leaving Ready · ${expiring.length}`)}
${rows(
  [{ head: 'Candidate' }, { head: 'Phone' }, { head: 'Leaves Ready', align: 'right' }],
  expiring.map((v) => [
    `${esc(v.full_name)}<br>${refCode(v.ref_code)} <span style="font-size:12px;color:${C.faint};">· ${esc(v.archetype_code)}</span>`,
    v.phone ? `<a href="tel:${esc(v.phone.replace(/\s+/g, ''))}" style="color:${C.accent};text-decoration:none;white-space:nowrap;">${esc(v.phone)}</a>` : '—',
    `<span style="white-space:nowrap;color:${(calendarDaysUntil(v.expires_at, ctx.now) ?? 0) <= 2 ? C.red : C.amber};font-weight:600;">${esc(dayPhrase(v.expires_at, ctx.now))}</span><br><span style="font-size:12px;color:${C.faint};">${v.expires_at ? esc(eatDate(v.expires_at)) : ''}</span>`,
  ]),
)}`
    : '';

  const recallTable = recalls.length
    ? `${sectionTitle(`Recalls due · ${recalls.length}`)}
${rows(
  [{ head: 'Candidate' }, { head: 'Why they are due' }, { head: 'Recall', align: 'right' }],
  recalls.map((v) => [
    `${esc(v.full_name)}<br>${refCode(v.ref_code)}`,
    `<span style="color:${C.dim};">${esc(recallReason(v))}</span>`,
    `<span style="white-space:nowrap;">${v.recall_at ? esc(eatDate(v.recall_at)) : ''}</span>`,
  ]),
)}`
    : '';

  const html = layout({
    preheader,
    eyebrow: `Decay warning · week of ${eatDate(ctx.now, false)}`,
    heading: subject,
    body: `${paragraph(
      `Morning ${esc(firstName(user))}. ${
        expiring.length
          ? `These people are Ready today and won’t be by the end of the week unless someone confirms they are still available. One short call each keeps them on the bench.`
          : `Nobody of yours is about to expire, but some people who said “not now” are due another call.`
      }`,
    )}
${expiringTable}
${recallTable}
${button('Start calling', `${ctx.portalUrl}/queue`)}`,
    footerReason: 'You get the Monday decay warning because you own candidates on the bench.',
    ctx,
  });

  const text = [
    subject,
    '',
    `Morning ${firstName(user)}.`,
    '',
    ...(expiring.length
      ? ['LEAVING READY', ...expiring.map((v) => `- ${v.full_name} (${v.ref_code}, ${v.archetype_code}) ${v.phone ?? ''}: ${dayPhrase(v.expires_at, ctx.now)}`), '']
      : []),
    ...(recalls.length
      ? ['RECALLS DUE', ...recalls.map((v) => `- ${v.full_name} (${v.ref_code}): ${recallReason(v)}, recall ${v.recall_at ? eatDate(v.recall_at) : ''}`), '']
      : []),
    `Start calling: ${ctx.portalUrl}/queue`,
  ].join('\n');

  return { subject, preheader, html, text };
}

const ARCHIVE_REASON: Record<string, string> = {
  took_other_job: 'Took another job',
  not_interested: 'Not interested at the time',
  left_country: 'Left the country',
};

/** Why someone is due a recall: archived for a reason, or said not available. */
const recallReason = (v: CandidateView) =>
  v.archived_reason ? (ARCHIVE_REASON[v.archived_reason] ?? 'Archived') : 'Said not available';

/** Calendar days in East Africa Time, from the shared date helper. */
const calendarDaysUntil = (iso: string | null, now: Date) => daysFromToday(iso, now);

function dayPhrase(iso: string | null, now: Date) {
  const days = calendarDaysUntil(iso, now);
  if (days === null) return 'unknown';
  if (days < 0) return 'already expired';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

// --------------------------------------------------------- new request ----

export interface NewRequestAlert {
  user: User;
  request: ClientRequest;
  archetype: Pick<Archetype, 'name' | 'code'>;
  raisedBy: string | null;
  /** Ready matches, best score first. */
  ready: CandidateView[];
  oneCallAway: number;
}

/** "React, Node.js · Evening shift". Only these count toward Ready now. */
function requirements(r: Pick<ClientRequest, 'required_skills' | 'required_shifts'>): string {
  const shifts = r.required_shifts.length ? `${r.required_shifts.join(', ')} shift` : '';
  return [r.required_skills.join(', '), shifts].filter(Boolean).join(' · ');
}

export function newRequestSubject(r: Pick<ClientRequest, 'client_name' | 'quantity'>, archetypeName: string, ready: number): string {
  return `New request: ${r.client_name} needs ${r.quantity} ${archetypeName}${r.quantity === 1 ? '' : 's'} · ${ready} Ready`;
}

export function renderNewRequestAlert(input: { alert: NewRequestAlert; ctx: EmailContext }): RenderedEmail {
  const { user, request: r, archetype, ready, oneCallAway, raisedBy } = input.alert;
  const { ctx } = input;
  const subject = newRequestSubject(r, archetype.name, ready.length);
  const gap = Math.max(0, r.quantity - ready.length);
  const covered = gap === 0;
  const shortAfterCalls = Math.max(0, gap - oneCallAway);
  const deadline = r.required_by ? ` by ${eatDate(r.required_by)}` : '';

  const verdict = covered
    ? `The bench can cover this today: ${ready.length} Ready for ${r.quantity} needed.`
    : shortAfterCalls === 0
      ? `${gap} short today, but ${plural(oneCallAway, 'assessed candidate is', 'assessed candidates are')} one call away. Calls can close this without sourcing.`
      : `${shortAfterCalls} short even if every call goes well. This needs sourcing.`;

  const preheader = verdict;
  const top = ready.slice(0, 5);

  const html = layout({
    preheader,
    eyebrow: 'New request',
    heading: `${r.client_name} needs ${plural(r.quantity, archetype.name, `${archetype.name}s`)}${deadline}`,
    body: `${paragraph(
      `Hi ${esc(firstName(user))}${raisedBy ? `, ${esc(raisedBy)} just raised a request` : ', a new request was raised'}.${
        requirements(r) ? `<br>Requirements: <span style="color:${C.ink};">${esc(requirements(r))}</span>` : ''
      }${r.notes ? `<br><span style="color:${C.ink};">“${esc(r.notes)}”</span>` : ''}`,
    )}
${statRow([
  { label: 'Needed', value: r.quantity },
  { label: 'Ready now', value: ready.length, color: covered ? C.green : C.amber },
  { label: 'One call away', value: oneCallAway, color: C.accent },
])}
${paragraph(`<strong style="color:${covered ? C.green : shortAfterCalls === 0 ? C.amber : C.red};">${esc(verdict)}</strong>`)}
${
  top.length
    ? `${sectionTitle('Strongest Ready matches')}
${rows(
  [{ head: 'Candidate' }, { head: 'Assessment' }, { head: 'Ready for', align: 'right' }],
  top.map((v) => [
    `${esc(v.full_name)}<br>${refCode(v.ref_code)}`,
    `${esc(v.overall_score?.toFixed(1) ?? '—')} <span style="color:${C.faint};font-size:12px;">${esc(scoreWord(v.overall_score))}</span>`,
    `<span style="white-space:nowrap;">${esc(v.days_until_expiry === null ? '—' : plural(v.days_until_expiry, 'day', 'days'))}</span>`,
  ]),
)}${ready.length > top.length ? `<div style="margin-top:6px;font-size:12px;color:${C.faint};">and ${ready.length - top.length} more</div>` : ''}`
    : ''
}
${button('Open the request', `${ctx.portalUrl}/requests/${r.id}`)}`,
    footerReason: 'You get new request alerts when a client request is raised.',
    ctx,
  });

  const text = [
    subject,
    '',
    `${r.client_name} needs ${r.quantity} ${archetype.name}${r.quantity === 1 ? '' : 's'}${deadline}.`,
    requirements(r) ? `Requirements: ${requirements(r)}` : null,
    r.notes ? `Notes: ${r.notes}` : null,
    `Needed ${r.quantity} · Ready now ${ready.length} · One call away ${oneCallAway}`,
    verdict,
    '',
    ...(top.length ? ['STRONGEST READY MATCHES', ...top.map((v) => `- ${v.full_name} (${v.ref_code}) ${v.overall_score?.toFixed(1) ?? ''} ${scoreWord(v.overall_score)}`), ''] : []),
    `Open the request: ${ctx.portalUrl}/requests/${r.id}`,
  ]
    .filter((l) => l !== null)
    .join('\n');

  return { subject, preheader, html, text };
}

/**
 * Same thresholds as scoreLabel in the data layer. Duplicated rather than
 * imported because this module runs server-side in the real build, where the
 * client data layer does not exist.
 */
function scoreWord(score: number | null) {
  if (score === null) return '';
  if (score >= 4.5) return 'Excellent';
  if (score >= 4.0) return 'Strong';
  if (score >= 3.5) return 'Good';
  return 'Below export floor';
}

// -------------------------------------------------------------- weekly ----

export function weeklySubject(stats: WeeklyStats): string {
  const ready = stats.health.reduce((n, h) => n + h.ready_count, 0);
  const target = stats.health.reduce((n, h) => n + h.target_ready, 0);
  return `Bench this week: ${ready} of ${target} Ready`;
}

export function renderWeeklySummary(input: { user: User; stats: WeeklyStats; ctx: EmailContext }): RenderedEmail {
  const { user, stats, ctx } = input;
  const subject = weeklySubject(stats);
  const preheader = `${plural(stats.calls, 'call', 'calls')}, ${plural(stats.shortlists_sent, 'shortlist', 'shortlists')} sent, ${stats.expiring_next_week} expiring next week.`;

  const html = layout({
    preheader,
    eyebrow: `Weekly summary · week to ${eatDate(stats.week_ending, false)}`,
    heading: subject,
    body: `${paragraph(`Hi ${esc(firstName(user))}, here is the bench at the end of the week.`)}
${rows(
  [{ head: 'Role' }, { head: 'Ready', align: 'right' }, { head: 'One call away', align: 'right' }, { head: 'Health', align: 'right' }],
  stats.health.map((h) => [
    `${esc(h.name)} <span style="font-family:${MONO};font-size:12px;color:${C.faint};">${esc(h.code)}</span>`,
    `<span style="font-family:${MONO};font-weight:700;color:${STATUS_COLOR[h.status]};">${h.ready_count}</span><span style="color:${C.faint};"> / ${h.target_ready}</span>`,
    `<span style="font-family:${MONO};">${h.one_call_away}</span>`,
    pill(h.status),
  ]),
)}
${sectionTitle('This week')}
${statRow([
  { label: 'Calls logged', value: stats.calls },
  { label: 'Confirmed available', value: stats.confirmed_available },
  { label: 'Requests opened', value: stats.requests_opened },
])}
${statRow([
  { label: 'Shortlists sent', value: stats.shortlists_sent },
  { label: 'Candidates sent', value: stats.candidates_sent },
  { label: 'Expiring next week', value: stats.expiring_next_week, color: stats.expiring_next_week > 0 ? C.amber : C.ink },
])}
${button('Open the dashboard', ctx.portalUrl)}`,
    footerReason: 'You get the Friday summary because it is switched on for you.',
    ctx,
  });

  const text = [
    subject,
    '',
    ...stats.health.map((h) => `${h.name} (${h.code}): ${h.ready_count}/${h.target_ready} Ready, ${h.one_call_away} one call away, ${h.status}`),
    '',
    `Calls logged ${stats.calls} · Confirmed available ${stats.confirmed_available} · Requests opened ${stats.requests_opened}`,
    `Shortlists sent ${stats.shortlists_sent} · Candidates sent ${stats.candidates_sent} · Expiring next week ${stats.expiring_next_week}`,
    '',
    `Open the dashboard: ${ctx.portalUrl}`,
  ].join('\n');

  return { subject, preheader, html, text };
}
