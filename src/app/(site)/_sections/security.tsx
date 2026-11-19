import {
  IconShieldLock,
  IconScale,
  IconRoute,
} from '@tabler/icons-react';

import { Section } from '@/components/layout/section';
import { Heading } from '@/components/typography/heading';
import { Eyebrow } from '@/components/typography/eyebrow';
import { MonoLabel } from '@/components/typography/mono-label';
import { Reveal } from '@/components/motion/reveal';
import { securityColumns } from '@/content/security';

/**
 * S6b — Security and IP.
 *
 * Clears the largest objection a technical buyer has, and the one they usually
 * will not raise out loud: where does my code live, who can reach it, and who
 * owns what at the end.
 *
 * Three columns rather than prose because this is a reference surface. A
 * procurement reader needs to complete a vendor file by scanning, and a CTO
 * needs to find "full IP assignment" without reading a paragraph to get there.
 *
 * Deliberately still, like the trust strip. Motion on a security claim reads
 * as salesmanship.
 */
export function Security() {
  return (
    <Section tone="paper" id="security" label="Security and IP">
      <Eyebrow>Security and IP</Eyebrow>
      <Heading level={2} className="mt-6 max-w-[16em]">
        How we protect your work.
      </Heading>

      <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
        {securityColumns.map((col, i) => (
          <Reveal
            key={col.tag}
            delay={i * 70}
            className="border-t-2 border-accent pt-6"
          >
            <span className="flex items-center gap-3">
              {(() => {
                // In data order: practised, contractual, roadmap.
                const ColIcon = [IconShieldLock, IconScale, IconRoute][i];
                return ColIcon ? (
                  <ColIcon
                    size={22}
                    stroke={1.9}
                    aria-hidden="true"
                    className="shrink-0 text-[var(--accent-text)]"
                  />
                ) : null;
              })()}
              <MonoLabel className="text-[var(--accent-text)]">
                {col.tag}
              </MonoLabel>
            </span>
            <ul className="mt-6 flex flex-col gap-4">
              {col.items.map((item) => (
                <li key={item.lead} className="text-body-sm">
                  <span className="font-semibold text-[var(--heading-color)]">
                    {item.lead}
                  </span>{' '}
                  <span className="text-[var(--muted-color)]">{item.rest}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        ))}
      </div>

      {/* The no-badges / references-on-request band was removed in the
          2026-08 leadership comment round; the copy stays in
          content/security.ts should it return. */}
    </Section>
  );
}
