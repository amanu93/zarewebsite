'use server';

import { headers } from 'next/headers';
import { Resend } from 'resend';
import { z } from 'zod';

import { createRateLimiter } from '@/lib/rate-limit';
import { CONTACT_FROM, RESEND_KEY } from '@/lib/resend-config';
import { careersEmail, email as contactEmail, siteName } from '@/constants';

/** Same constraint, same reason as the contact action — see the note there. */
const DELIVER_TO = careersEmail;

export interface BlueprintState {
  status: 'idle' | 'success' | 'error';
  message?: string;
  errors?: Record<string, string>;
  values?: Record<string, string>;
}

/** Three visible fields — half the contact form's ceiling. The summary is
 *  game-generated and hidden; the honeypot is never seen by a human. */
const blueprintSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(80),
  email: z.string().trim().email('Please enter a valid email address').max(200),
  company: z.string().trim().max(120).optional().or(z.literal('')),
  summary: z.string().trim().min(10).max(4000),
  website: z.string().max(0),
});

const rateLimited = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 5 });

export async function submitBlueprint(
  _prev: BlueprintState,
  formData: FormData,
): Promise<BlueprintState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const values = { ...raw };
  delete values.website;

  // Same check, and the same reasoning, as the contact action: compare the
  // Origin against the REQUEST's own host rather than the canonical siteUrl.
  // One build serves zareinnovations.com, preview domains and localhost, and
  // a hardcoded host rejected every legitimate submit off-domain.
  const h = await headers();
  const origin = h.get('origin');
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (origin && host && process.env.NODE_ENV === 'production') {
    try {
      if (new URL(origin).host !== host) {
        return { status: 'error', message: 'Request rejected.', values };
      }
    } catch {
      return { status: 'error', message: 'Request rejected.', values };
    }
  }

  const ip = h.get('x-forwarded-for')?.split(',')[0].trim() ?? h.get('x-real-ip') ?? 'unknown';
  if (rateLimited(ip)) {
    return { status: 'error', message: `Too many submissions. Please email ${contactEmail} directly.`, values };
  }

  if (typeof raw.website === 'string' && raw.website.length > 0) {
    return { status: 'success' };
  }

  const parsed = blueprintSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (key && !errors[key]) errors[key] = issue.message;
    }
    return { status: 'error', message: 'Please check the highlighted fields.', errors, values };
  }

  // See lib/resend-config: the key always resolves, so this only trips if a
  // deploy blanks the env var deliberately.
  if (!RESEND_KEY) {
    console.error('No Resend key available. Blueprint lead dropped.');
    return {
      status: 'error',
      message: `Our form is temporarily unavailable. Please email ${contactEmail} and we will reply within one business day.`,
      values,
    };
  }

  const d = parsed.data;
  try {
    const resend = new Resend(RESEND_KEY);

    // TWO EMAILS, and the order of importance is deliberate.
    //
    // 1. The blueprint, to the person who asked for it. This is the point of
    //    the button — they played the game, they get their numbers.
    // 2. The lead, to careers@, so a strategist can follow up.
    //
    // (1) CANNOT DELIVER until zareinnovations.com is verified in Resend.
    // An unverified account may only send to its own registered address, so
    // any visitor address comes back 403 validation_error — see the note in
    // lib/resend-config. (2) is that registered address, so it works today.
    //
    // The visitor's outcome therefore hangs on (2), not (1): the success
    // copy promises a strategist will follow up within one business day,
    // and that promise is kept the moment careers@ has the lead. When the
    // domain is verified, (1) starts landing and the blueprint arrives
    // automatically as well — no further change needed here.
    const [blueprintToVisitor, leadToTeam] = await Promise.all([
      resend.emails.send({
        from: CONTACT_FROM,
        to: [d.email],
        replyTo: DELIVER_TO,
        subject: 'Your Scale Challenge team blueprint',
        text: [
          `Hi ${d.name},`,
          '',
          'Here is the team blueprint from the mission you just played.',
          '',
          d.summary,
          '',
          'These figures are illustrative — a strategist will follow up with',
          'the real numbers for your roles and market within one business day.',
          '',
          'Reply to this email if you would like to talk sooner.',
          '',
          siteName,
        ].join('\n'),
      }),
      resend.emails.send({
        from: CONTACT_FROM,
        to: [DELIVER_TO],
        replyTo: d.email,
        subject: `Scale Challenge blueprint — ${d.company || d.name}`,
        text: `name: ${d.name}\nemail: ${d.email}\ncompany: ${d.company || '—'}\n\n${d.summary}`,
      }),
    ]);

    // Logged rather than surfaced: until the domain is verified this fails
    // every time, and it is not the visitor's problem — they are still
    // getting a follow-up.
    if (blueprintToVisitor.error) {
      console.error(
        'Blueprint could not be sent to the visitor (verify zareinnovations.com in Resend):',
        blueprintToVisitor.error,
      );
    }

    // This one IS the visitor's problem: if the lead never reached the team,
    // nobody is following up and the success copy would be a lie.
    if (leadToTeam.error) {
      console.error('Blueprint lead send error:', leadToTeam.error);
      return { status: 'error', message: `We could not send that. Please email ${contactEmail} directly.`, values };
    }

    return { status: 'success' };
  } catch (err) {
    console.error('submitBlueprint failed:', err);
    return { status: 'error', message: `Something went wrong. Please email ${contactEmail} directly.`, values };
  }
}
