import { Section } from '@/components/layout/section';
import { Heading } from '@/components/typography/heading';
import { Eyebrow } from '@/components/typography/eyebrow';
import { QuoteBlock } from '@/components/data/quote-block';
import { Reveal } from '@/components/motion/reveal';
import { highlightSurface, panelSurface } from '@/components/content/surface';
import { testimonials } from '@/content/testimonials';
import { cn } from '@/lib/utils';

/**
 * S4b — In their words.
 *
 * Client voices, verbatim from the Company Profile 2026 (see
 * content/testimonials.ts — approved copy, do not paraphrase). Sits directly
 * after the featured work so the quotes read as commentary on engagements the
 * reader has just seen, not as free-floating praise.
 *
 * The LEAD quote (top-left — display order lives in
 * content/testimonials.ts) carries the section's ONE highlight surface;
 * everything else sits on the plain panel hairline — four highlighted
 * cards would just be a teal wall. Leadership order: Mastercard AGF
 * first, highlighted.
 */
export function Testimonials() {
  return (
    <Section tone="navy" label="In their words" atmosphere="quiet">
      <Eyebrow>In their words</Eyebrow>
      <Heading level={2} className="mt-6 max-w-[14em]">
        What our clients say.
      </Heading>

      <div className="mt-14 grid gap-6 lg:grid-cols-2">
        {testimonials.map((t, i) => {
          const lead = i === 0;
          return (
            <Reveal key={t.attribution} delay={i * 90}>
              <QuoteBlock
                quote={t.text}
                attribution={t.attribution}
                role={t.context}
                source={t.source}
                className={cn(
                  'h-full p-6 md:p-8',
                  lead ? highlightSurface : panelSurface,
                )}
              />
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}
