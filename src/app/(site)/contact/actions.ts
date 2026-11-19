'use server';

import { headers } from 'next/headers';
import { Resend } from 'resend';

import { inquirySchema, LABELS } from '@/lib/inquiry-schema';
import { createRateLimiter } from '@/lib/rate-limit';
import { CONTACT_FROM, RESEND_KEY } from '@/lib/resend-config';
import { careersEmail, email as contactEmail } from '@/constants';

/**
 * Where the inquiry is DELIVERED — not the address shown to visitors.
 *
 * Resend refuses any other recipient while zareinnovations.com is unverified:
 *
 *   403 validation_error — "You can only send testing emails to your own
 *   email address (careers@zareinnovations.com). To send emails to other
 *   recipients, please verify a domain at resend.com/domains, and change the
 *   `from` address to an email using this domain."
 *
 * careers@ is the address the Resend account is registered under, so it is
 * the only one that delivers. The old site learned this the same way and
 * switched on 2025-03-07 (zare-website cf7f221, four days after Resend was
 * introduced sending to info@); it has delivered to careers@ ever since.
 *
 * Verify the domain and this goes back to `contactEmail` — that is the
 * address enquiries belong in, and the only reason it is not used here.
 */
const DELIVER_TO = careersEmail;

export interface InquiryState {
  status: 'idle' | 'success' | 'error';
  message?: string;
  /** Field name -> first error. Drives inline messages. */
  errors?: Record<string, string>;
  /** Echoed back so a failed submit never wipes what was typed. */
  values?: Record<string, string>;
}

const rateLimited = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 5 });

function renderBody(data: Record<string, unknown>): string {
  const label = (v: unknown) =>
    typeof v === 'string' && LABELS[v] ? LABELS[v] : String(v);

  return Object.entries(data)
    .filter(([k]) => k !== 'website')
    .map(([k, v]) => `${k}: ${label(v)}`)
    .join('\n');
}

export async function submitInquiry(
  _prev: InquiryState,
  formData: FormData,
): Promise<InquiryState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;

  // Echo everything except the honeypot, so a rejected submit is not punished
  // by an emptied form.
  const values = { ...raw };
  delete values.website;

  // Next validates Origin against Host for Server Actions already. This is a
  // second, explicit check so the intent is visible in the code. It compares
  // against the REQUEST's own host, not the canonical siteUrl — the same
  // build serves zareinnovations.com, Vercel preview domains, and localhost,
  // and a hardcoded host rejected every legitimate submit off-domain.
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

  const ip =
    h.get('x-forwarded-for')?.split(',')[0].trim() ??
    h.get('x-real-ip') ??
    'unknown';

  if (rateLimited(ip)) {
    return {
      status: 'error',
      message: `Too many submissions. Please email ${contactEmail} directly.`,
      values,
    };
  }

  // Honeypot. Report success so the bot does not retry, and send nothing.
  if (typeof raw.website === 'string' && raw.website.length > 0) {
    return { status: 'success' };
  }

  const parsed = inquirySchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (key && !errors[key]) errors[key] = issue.message;
    }
    return {
      status: 'error',
      message: 'Please check the highlighted fields.',
      errors,
      values,
    };
  }

  // RESEND_KEY is empty when RESEND_API_KEY is not set on the host.
  if (!RESEND_KEY) {
    console.error('No Resend key available. Inquiry dropped.');
    return {
      status: 'error',
      message: `Our form is temporarily unavailable. Please email ${contactEmail} and we will reply within one business day.`,
      values,
    };
  }

  const data = parsed.data;
  const subjectKind =
    data.pathway === 'project' ? 'Project inquiry' : 'Embedded team inquiry';

  try {
    const resend = new Resend(RESEND_KEY);
    const { error } = await resend.emails.send({
      // Fixed sender. The display name was previously interpolated from user
      // input, which let a submitter forge the apparent sender.
      from: CONTACT_FROM,
      to: [DELIVER_TO],
      replyTo: data.email,
      subject: `${subjectKind} — ${data.company}`,
      text: renderBody(data),
    });

    if (error) {
      console.error('Inquiry send error:', error);
      return {
        status: 'error',
        message: `We could not send that. Please email ${contactEmail} directly.`,
        values,
      };
    }

    return { status: 'success' };
  } catch (err) {
    console.error('submitInquiry failed:', err);
    return {
      status: 'error',
      message: `Something went wrong. Please email ${contactEmail} directly.`,
      values,
    };
  }
}
