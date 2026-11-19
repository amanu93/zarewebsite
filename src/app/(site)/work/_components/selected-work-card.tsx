import Image from 'next/image';

import type { WorkReference } from '@/content/work';

/**
 * One card from the Company Profile 2026 "Selected Work" spread.
 *
 * The profile's own card, reproduced: a client mark on a white plate, the
 * client's name, one line. Nothing else — no industry chip, no location
 * column, no read-more. These engagements are recorded, not narrated; the
 * featured cases above carry the argument.
 *
 * The card is white on the mist section rather than transparent. The profile
 * prints these on a white page, so its marks already sit on white, and the
 * house rule is that a client's logo never sits on a tinted ground — their
 * brand, their colours.
 */
export function SelectedWorkCard({ reference }: { reference: WorkReference }) {
  return (
    <li className="flex flex-col border-2 border-[var(--rule-color)] bg-white px-[22px] py-5">
      {/* Fixed 38px band, exactly as the profile sets it: the marks vary
          wildly in aspect, and a shared band is what keeps a row of them
          reading as one line rather than twelve different sizes. */}
      <div className="mb-3 flex h-[38px] items-center">
        {reference.logo ? (
          <Image
            src={reference.logo.src}
            alt={`${reference.logo.alt} logo`}
            width={140}
            height={38}
            className="h-full w-auto max-w-[140px] object-contain object-left"
          />
        ) : null}
      </div>

      <h3 className="font-display text-[20px] font-bold leading-tight text-[var(--heading-color)]">
        {reference.client}
      </h3>

      <p className="mt-1.5 text-[17px] leading-[1.4] text-[var(--muted-color)]">
        {reference.note}
      </p>
    </li>
  );
}
