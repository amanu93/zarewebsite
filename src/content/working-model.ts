/**
 * How Zare works with a client's team.
 *
 * Deliberately not a world map. "Six countries served" is a vanity metric: no
 * buyer has ever chosen a partner because of a count, and a globe with dots on
 * it answers none of the questions they actually have. The question underneath
 * is always the same, and it is operational:
 *
 *   "My team is in Boston. Will yours be awake?"
 *
 * So the section is built from time, not territory. Every region below is a
 * place Zare has actually delivered, traceable to a named engagement in
 * src/content/work.ts. None of it is a market we would like to be in.
 */

export interface ClientRegion {
  region: string;
  /** Hours behind Addis under standard time. */
  hoursBehind: number;
  /** Hours behind under the region's daylight saving time, where observed. */
  hoursBehindDst?: number;
}

/**
 * Addis Ababa is UTC+3 and does not observe daylight saving, so the offset to
 * a client only moves when the CLIENT changes clocks. That is a real
 * operational advantage and it is worth stating plainly: the working
 * relationship shifts twice a year at most, and never at our end.
 */
export const ADDIS_UTC_OFFSET = '+3';

// Client-name evidence labels removed per the 2026-08 leadership comment
// round: the band is a timezone reference, and the engagements are named
// where they belong — in the work section. Ethiopia ("same time") was
// removed earlier for the same reason; the zero row was noise. US Central
// sits under US East by request, not by distance.
export const clientRegions: ClientRegion[] = [
  {
    region: 'US West',
    hoursBehind: 11,
    hoursBehindDst: 10,
  },
  {
    region: 'US East',
    hoursBehind: 8,
    hoursBehindDst: 7,
  },
  {
    region: 'US Central',
    hoursBehind: 9,
    hoursBehindDst: 8,
  },
  {
    region: 'GMT',
    hoursBehind: 3,
    hoursBehindDst: 2,
  },
  {
    region: 'Germany',
    hoursBehind: 2,
    hoursBehindDst: 1,
  },
  {
    region: 'South Africa',
    hoursBehind: 1,
  },
  {
    region: 'Cyprus',
    hoursBehind: 1,
    hoursBehindDst: 0,
  },
];

/**
 * The communication model. These describe how an embedded engineer actually
 * works, not a service level we have invented.
 */
export const communicationModel: readonly string[] = [
  'In your Slack, not a ticketing portal',
  'In your standups, on your schedule',
  'In your codebase, on your permissions',
  'On your roadmap, not a separate backlog',
];

/**
 * The overlap commitment (how many hours of the client's day engineers
 * cover) still has no agreed number in writing. The pending placeholder
 * box was removed from the homepage in the 2026-08 leadership comment
 * round; when the commitment is agreed it can return as a stated fact.
 * See docs/CONTENT-CHECKLIST.md item 17.
 */
