import type { StaticImageData } from 'next/image';

import workspaceWide from '../../public/office/workspace-wide.webp';
import workspaceCalm from '../../public/office/workspace-calm.webp';
import engineeringCode from '../../public/office/engineering-code.webp';
import engineeringPair from '../../public/office/engineering-pair.webp';
import whiteboardSession from '../../public/office/whiteboard-session.webp';
import boardroomPresentation from '../../public/office/boardroom-presentation.webp';
import coffeeCorner from '../../public/office/coffee-corner.webp';
import deskLaughter from '../../public/office/desk-laughter.webp';
import coffeeCeremonyPour from '../../public/office/coffee-ceremony-pour.webp';
import coffeeCeremonyTasting from '../../public/office/coffee-ceremony-tasting.webp';
import operationsStation from '../../public/office/operations-station.webp';
import operationsDesk from '../../public/office/operations-desk.webp';
import boardroomScreen from '../../public/office/boardroom-screen.webp';

/**
 * Photography from the September 2026 delivery-centre shoot (Addis Ababa).
 *
 * Twelve frames were selected from the 92-photo brand shoot; originals live
 * outside the repo in the shared assets drive. Exports are 1800px WebP under
 * public/office/. One record per frame so every placement shares the same
 * src and alt — a photo is a fact about the office, and facts live in data.
 *
 * STATIC IMPORTS, not path strings: the build then carries each frame's
 * dimensions and a base64 blur preview, so `placeholder="blur"` shows a
 * soft version of the actual photograph the instant the layout paints and
 * sharpens when the file arrives — no white box, no layout shift. Every
 * placement must pass `placeholder="blur"` alongside `src={photo.src}`.
 *
 * Placement discipline: photos go where they substantiate a claim the page
 * is already making (the delivery centre exists, the ceremony is real, the
 * operations desk is staffed). Sections that argue with data — trust strip,
 * testimonials, security — deliberately carry none.
 */

export interface OfficePhoto {
  src: StaticImageData;
  alt: string;
}

export const officePhotos = {
  /** Wide frontal frame of the open workspace, logo wall lit, four at work. */
  workspaceWide: {
    src: workspaceWide,
    alt: 'The Zare Innovations delivery centre in Addis Ababa: four engineers at workstations under the lit company logo wall',
  },
  /** Calmer wide frame of the same room, all heads down. */
  workspaceCalm: {
    src: workspaceCalm,
    alt: 'Engineers working at their desks in the Zare delivery centre, Addis Ababa',
  },
  /** Over-shoulder frame, real code on both screens. */
  engineeringCode: {
    src: engineeringCode,
    alt: 'A Zare engineer writing code across a laptop and an external monitor',
  },
  /** Developer at code with a colleague reviewing beside the desk. */
  engineeringPair: {
    src: engineeringPair,
    alt: 'Two Zare engineers reviewing code together at a workstation',
  },
  /** Two engineers sketching a system flow on the whiteboard. */
  whiteboardSession: {
    src: whiteboardSession,
    alt: 'Two Zare engineers sketching a system flow on a whiteboard during a planning session',
  },
  /** Presenter at the meeting-room TV, team seated around the table. */
  boardroomPresentation: {
    src: boardroomPresentation,
    alt: 'A Zare team member presenting to colleagues around the meeting-room table',
  },
  /** Coffee-corner conversation by the logo wall. */
  coffeeCorner: {
    src: coffeeCorner,
    alt: 'Zare team members talking over coffee in the office lounge',
  },
  /** Candid laughing frame at a desk near the logo wall. */
  deskLaughter: {
    src: deskLaughter,
    alt: 'Two Zare team members laughing together at a desk',
  },
  /** The jebena pour — Ethiopian coffee ceremony in the office. */
  coffeeCeremonyPour: {
    src: coffeeCeremonyPour,
    alt: 'Coffee poured from a jebena during an Ethiopian coffee ceremony at the Zare office',
  },
  /** Two colleagues tasting during the ceremony. */
  coffeeCeremonyTasting: {
    src: coffeeCeremonyTasting,
    alt: 'Two Zare team members tasting coffee during the office coffee ceremony',
  },
  /** Operations specialist at her station under the logo wall — the frame
   *  leadership picked in the 2026-09 comment round (replaces the earlier
   *  headset-call frame). */
  operationsStation: {
    src: operationsStation,
    alt: 'A Zare operations specialist working at her station beneath the company logo wall',
  },
  /** Boardroom walkthrough: presenter at the wall screen, team following. */
  boardroomScreen: {
    src: boardroomScreen,
    alt: 'A Zare team member walking colleagues through delivered work on the meeting-room screen',
  },
  /** Operations specialist at her desk, headset on. */
  operationsDesk: {
    src: operationsDesk,
    alt: 'A Zare operations specialist working at her desk with a headset',
  },
} as const satisfies Record<string, OfficePhoto>;
