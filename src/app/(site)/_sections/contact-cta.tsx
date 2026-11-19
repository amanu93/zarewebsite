import Link from 'next/link';
import { IconSend, IconMail, IconPhoneCall } from '@tabler/icons-react';

import { Section } from '@/components/layout/section';
import { Heading } from '@/components/typography/heading';
import { Eyebrow } from '@/components/typography/eyebrow';
import { MonoLabel } from '@/components/typography/mono-label';
import {
  pathways,
  whatHappensNext,
  OPENING_OFFER,
  RESPONSE_PROMISE,
} from '@/content/contact';
import { email } from '@/constants';

/**
 * S8 — Contact.
 *
 * The homepage previously ended on "How we work with your team" and then a
 * footer. The reader most likely to convert is the one who reached the bottom,
 * and they were handed navigation. This is the ask.
 *
 * Two pathway rows rather than a form. The form lives on /contact and asking
 * for six fields at the end of a long scroll is a worse trade than asking for
 * one click: the visitor has already decided which of the two they are, and
 * that is the only thing this section needs to capture.
 *
 * Reuses the /contact copy so the promise and the three steps cannot drift
 * between the two surfaces.
 */
/** The three what-happens-next steps, in data order: send, reply, call. */
const STEP_ICONS = [IconSend, IconMail, IconPhoneCall] as const;

export function ContactCta() {
  return (
    <Section
      tone="deep"
      id="contact"
      label="Contact"
      atmosphere="rings"
      atmosphereAnchors={['82% 22%', '96% 22%']}
    >
      <Eyebrow>Next step</Eyebrow>
      <Heading level={2} size="display-1" className="mt-6 max-w-[12em]">
        What should we build together?
      </Heading>

      {/* The profile's closing offer, verbatim. */}
      <p className="mt-6 max-w-[38em] text-body text-on-dark-muted">
        {OPENING_OFFER}
      </p>

      <div className="mt-14 grid gap-14 lg:grid-cols-[1.3fr_1fr] lg:gap-20">
        <div>
          <ul className="flex flex-col border-t border-[var(--rule-color)]">
            {(['project', 'team'] as const).map((key) => {
              const p = pathways[key];
              return (
                <li key={key}>
                  <Link
                    href={`/contact?pathway=${key}`}
                    className="group flex items-center justify-between gap-6 border-b border-[var(--rule-color)] py-8 no-underline transition-[padding,background-color] duration-150 hover:bg-[rgba(64,193,199,.05)] hover:pl-5"
                  >
                    <span className="flex flex-col gap-2">
                      <span className="font-display text-display-3 text-on-dark-strong">
                        {p.tab}
                      </span>
                      <span className="max-w-[34em] text-body-sm text-on-dark-muted">
                        {p.description}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-[26px] text-accent transition-transform duration-150 group-hover:translate-x-1.5"
                    >
                      →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <p className="mt-8 font-mono text-caption text-on-dark-muted">
            Or write to us directly:{' '}
            <a
              href={`mailto:${email}`}
              className="text-[var(--accent-text)] hover:underline"
            >
              {email}
            </a>
          </p>
        </div>

        {/* Buyers hesitate at unknown process more than at price. Naming what
            happens next, and committing to a reply window, removes the
            black-hole fear that stops a first message being sent. */}
        <div className="border-t border-[var(--rule-color)] pt-8 lg:border-l lg:border-t-0 lg:pl-16 lg:pt-0">
          <MonoLabel muted>What happens next</MonoLabel>
          <ol className="mt-6 flex flex-col">
            {whatHappensNext.map((step, i) => {
              const StepIcon = STEP_ICONS[i];
              return (
              <li
                key={step.n}
                className="grid gap-2 border-b border-[var(--rule-color)] py-4 first:pt-0 sm:grid-cols-[auto_1fr] sm:gap-5"
              >
                <MonoLabel className="text-[var(--accent-text)]">
                  {step.n}
                </MonoLabel>
                <div>
                  <p className="flex items-center gap-2.5 font-display text-body font-semibold text-on-dark-strong">
                    {StepIcon ? (
                      <StepIcon
                        size={20}
                        stroke={1.9}
                        aria-hidden="true"
                        className="shrink-0 text-[var(--accent-text)]"
                      />
                    ) : null}
                    {step.title}
                  </p>
                  <p className="mt-1 text-body-sm text-on-dark-muted">
                    {step.body}
                  </p>
                </div>
              </li>
              );
            })}
          </ol>
          <MonoLabel className="mt-6 block text-[var(--accent-text)]">
            {RESPONSE_PROMISE}
          </MonoLabel>
        </div>
      </div>
    </Section>
  );
}
