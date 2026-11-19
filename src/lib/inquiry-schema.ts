import { z } from 'zod';

/**
 * Inquiry schemas. One per pathway, six fields each.
 *
 * Six is a hard ceiling, not a target. Every field past the fourth measurably
 * costs completions, and nothing here exists for our convenience: each one
 * either routes the inquiry or tells us whether we can actually help. If a
 * seventh field is ever proposed, one of these has to go.
 *
 * The honeypot does not count toward the six. It is never seen by a human.
 */

const shared = {
  name: z.string().trim().min(2, 'Please enter your name').max(80),
  company: z.string().trim().min(1, 'Please enter your company').max(120),
  email: z.string().trim().email('Please enter a valid email address').max(200),
  /** Bots fill every field they find. Humans never see this one. */
  website: z.string().max(0),
};

export const projectInquirySchema = z.object({
  pathway: z.literal('project'),
  ...shared,
  building: z
    .string()
    .trim()
    .min(20, 'A sentence or two about what you are building')
    .max(2000),
  budget: z.enum(['under-50k', '50k-200k', '200k-plus', 'not-sure']),
  timeline: z.enum(['now', '1-3-months', '3-plus-months', 'exploring']),
});

export const teamInquirySchema = z.object({
  pathway: z.literal('team'),
  ...shared,
  teamType: z.enum(['technology-talent', 'business-operations']),
  roles: z
    .string()
    .trim()
    .min(10, 'Which roles, and how many of each')
    .max(1000),
  startWindow: z.enum(['asap', '1-month', '1-3-months', 'planning']),
});

export const inquirySchema = z.discriminatedUnion('pathway', [
  projectInquirySchema,
  teamInquirySchema,
]);

export type Inquiry = z.infer<typeof inquirySchema>;
export type Pathway = Inquiry['pathway'];

export const isPathway = (v: unknown): v is Pathway =>
  v === 'project' || v === 'team';

/** Human-readable labels for the email body. Keys mirror the enums above. */
export const LABELS: Record<string, string> = {
  'under-50k': 'Under $50,000',
  '50k-200k': '$50,000 to $200,000',
  '200k-plus': '$200,000+',
  'not-sure': 'Not sure yet',
  now: 'Ready now',
  '1-3-months': '1 to 3 months',
  '3-plus-months': '3+ months',
  exploring: 'Exploring options',
  'technology-talent': 'Technology Talent',
  'business-operations': 'Business Operations',
  asap: 'As soon as possible',
  '1-month': 'Within a month',
  planning: 'Planning ahead',
};
