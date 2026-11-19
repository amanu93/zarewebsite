/**
 * Resend credentials for the two lead-generating Server Actions.
 *
 * The key comes from the environment only. Set RESEND_API_KEY on the host
 * (docker-compose passes it through). When it is unset the forms reject with
 * 'temporarily unavailable', by design.
 *
 * `||` rather than `??` on purpose: docker-compose passes
 * `RESEND_API_KEY: ${RESEND_API_KEY}`, which resolves to an EMPTY STRING when
 * the variable is unset on the host. Both consumers treat an empty key as
 * "not configured".
 *
 * Never paste a key literal into this file.
 */
export const RESEND_KEY = process.env.RESEND_API_KEY || '';

/**
 * Sender. The old main sent from the resend.dev sandbox domain, which is the
 * part that governs deliverability and is proven to work on that account —
 * zareinnovations.com is not confirmed verified in Resend, and an unverified
 * sending domain makes Resend reject every send.
 *
 * The display name stays FIXED. Old main interpolated it from the submitter's
 * own name field (`${rawData.name} <contact@resend.dev>`), which let anyone
 * forge the apparent sender; that was fixed on purpose in this codebase and
 * is not part of 'how main handles it' as far as the sending domain goes.
 */
export const CONTACT_FROM =
  process.env.CONTACT_FROM_EMAIL || 'Zare Website <contact@resend.dev>';
