/**
 * Hourly rate comparison, by role.
 *
 * Preserved from the retired `_components/calculator-modal.tsx` and
 * `hooks/calculator.util.ts` during the M7 cutover. The components were deleted
 * because they depend on Mantine and the modal they lived in is gone, but the
 * table itself is business data and the basis of the /rate-calculator page
 * planned for Phase 2.
 *
 * `marketRate` is the comparable US contract rate; `zareRate` is ours. Both are
 * USD per hour. Before this is published on a public page, the basis for the
 * market figures needs stating: an unsourced comparison is exactly the kind of
 * number the content rules exist to prevent.
 * See docs/CONTENT-CHECKLIST.md.
 */

export interface RoleRate {
  role: string;
  /** Comparable US contract rate, USD per hour. */
  marketRate: number;
  /** Zare rate, USD per hour. */
  zareRate: number;
}

export const roleRates: RoleRate[] = [
  { role: 'UI/UX Designer', marketRate: 45, zareRate: 20 },
  { role: 'Fullstack Software Engineer', marketRate: 60, zareRate: 28 },
  { role: 'Back end Software Engineer', marketRate: 55, zareRate: 26 },
  { role: 'Front end Software Engineer', marketRate: 50, zareRate: 25 },
  { role: 'Mobile App Software Developer', marketRate: 55, zareRate: 27 },
  { role: 'QA Engineer', marketRate: 45, zareRate: 22 },
  { role: 'Customer Service Representative', marketRate: 25, zareRate: 10 },
  { role: 'Virtual Assistant', marketRate: 20, zareRate: 8 },
  { role: 'Back Office Support Specialist', marketRate: 22, zareRate: 9 },
];

export const roleOptions = roleRates.map((r) => ({
  value: r.role,
  label: r.role,
}));
