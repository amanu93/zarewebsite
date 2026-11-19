/**
 * Client testimonials, verbatim from the official Company Profile 2026
 * (docs/zare-company-profile — "In their words", p12). Attribution and dating
 * are part of the evidence: an undated quote is an assertion, a dated one is
 * a record. Do not paraphrase these; they are approved copy.
 *
 * Not yet rendered — staged for the testimonial section (integration plan M3,
 * docs/profile-integration-plan.md).
 */

export interface Testimonial {
  text: string;
  attribution: string;
  /** What the quote is about — engagement, not flattery. */
  context: string;
  /** Where/when it was given. Verifiable beats glowing. */
  source: string;
}

export const testimonials: Testimonial[] = [
  // Order is display order; leadership asked for the Mastercard AGF quote
  // first (top-left card).
  {
    text: "Over the past six months, the Zare team has demonstrated exceptional commitment, quality, and thoughtfulness. The final product received overwhelmingly positive feedback, with very few change requests — a true reflection of the team's excellence and hard work. I'm incredibly proud of what we've built together and excited to carry this momentum forward.",
    attribution: 'Mastercard Africa Growth Fund',
    context: 'On the Womentor Africa platform',
    source: 'Six months into the engagement',
  },
  {
    text: "The developers we hired through Zare Innovations have been a great addition to our team, reliable, skilled, and solid contributors. We've also been impressed with how Zare proactively managed performance, making sure their developers meet expectations. A great partner to work with!",
    attribution: 'Pickrell Global Technologies',
    context: 'On their three-developer embedded pod',
    source: '5.0 review on Clutch, February 2025',
  },
  {
    text: 'Great experience with Zare; we have one of the most talented engineers to work with, couldn\'t be happier!',
    attribution: 'KeySquare Labs',
    context: 'On their embedded engineer',
    source: 'Client feedback',
  },
  {
    text: 'We are all very impressed with his designs, his professionalism, and how well he manages relationships with our clients. He is a diamond and we are extremely happy to have him as part of the Exelia family.',
    attribution: 'Exelia Technologies',
    context: 'On the senior designer Zare placed',
    source: 'Client feedback',
  },
];
