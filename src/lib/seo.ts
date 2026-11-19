import {
  cityEthiopia,
  cityUSA,
  email,
  facebook,
  geoEthiopia,
  geoUSA,
  github,
  instagram,
  linkedin,
  logo,
  phone,
  phoneEthiopia,
  postalCodeUSA,
  siteName,
  siteUrl,
  stateUSA,
  streetEthiopia,
  streetUSA,
} from '@/constants';

/**
 * Structured data for the homepage.
 *
 * Restored during the M7 cutover. The old marketing homepage carried
 * Organization, WebSite, two LocalBusiness records and a navigation list, and
 * deleting that page in M7.2 took all of it with it. That layer was the
 * strongest SEO asset in the original codebase, so it is rebuilt here rather
 * than lost, with the descriptions updated to the current positioning.
 *
 * Extracted into lib rather than inlined so the next page that needs a
 * builder does not copy one.
 */

const logoUrl = `${siteUrl}${logo}`;

/** The Company Profile 2026 cover subhead, verbatim — both engines, one line. */
const POSITIONING =
  'Custom AI & software builds, and embedded talent strictly vetted to high global standards. Two engines, one firm.';

export const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: siteName,
  url: siteUrl,
  logo: logoUrl,
  description: POSITIONING,
  email,
  telephone: phone,
  address: [
    {
      '@type': 'PostalAddress',
      streetAddress: streetUSA,
      addressLocality: cityUSA,
      addressRegion: stateUSA,
      postalCode: postalCodeUSA,
      addressCountry: 'US',
    },
    {
      '@type': 'PostalAddress',
      streetAddress: streetEthiopia,
      addressLocality: cityEthiopia,
      addressCountry: 'ET',
    },
  ],
  sameAs: [linkedin, instagram, facebook, github],
  knowsAbout: [
    'Embedded engineering teams',
    'Custom software development',
    'AI engineering',
    'Cloud infrastructure',
    'Managed business operations',
  ],
};

export const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: siteName,
  url: siteUrl,
};

/**
 * The old version emitted a bare ARRAY of SiteNavigationElement, which is not
 * valid structured data on its own. Wrapped in an ItemList so it parses.
 */
export const siteNavigationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: `${siteName} navigation`,
  itemListElement: [
    { name: 'Our Work', url: `${siteUrl}/work` },
    { name: 'Careers', url: `${siteUrl}/careers` },
    { name: 'Contact', url: `${siteUrl}/contact` },
  ].map((item, i) => ({
    '@type': 'SiteNavigationElement',
    position: i + 1,
    name: item.name,
    url: item.url,
  })),
};

export const addisOfficeJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': `${siteUrl}/#addis-engineering-centre`,
  name: `${siteName} — Engineering centre`,
  description:
    'Engineering centre in Addis Ababa, Ethiopia. Embedded engineering teams, custom software and AI systems for companies in the US, UK and across Africa.',
  url: siteUrl,
  logo: logoUrl,
  image: logoUrl,
  telephone: phoneEthiopia,
  email,
  address: {
    '@type': 'PostalAddress',
    streetAddress: streetEthiopia,
    addressLocality: cityEthiopia,
    addressCountry: 'ET',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: geoEthiopia.latitude,
    longitude: geoEthiopia.longitude,
  },
  priceRange: '$$',
  sameAs: [linkedin, instagram, facebook, github],
};

export const usOfficeJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': `${siteUrl}/#us-registered-office`,
  name: `${siteName}, LLC`,
  description:
    'Registered office in Middletown, Delaware. Contracting entity for all engagements, under US law with full IP assignment.',
  url: siteUrl,
  logo: logoUrl,
  image: logoUrl,
  telephone: phone,
  email,
  address: {
    '@type': 'PostalAddress',
    streetAddress: streetUSA,
    addressLocality: cityUSA,
    addressRegion: stateUSA,
    postalCode: postalCodeUSA,
    addressCountry: 'US',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: geoUSA.latitude,
    longitude: geoUSA.longitude,
  },
  priceRange: '$$',
  sameAs: [linkedin, instagram, facebook, github],
};

export const homepageJsonLd = [
  organizationJsonLd,
  websiteJsonLd,
  siteNavigationJsonLd,
  addisOfficeJsonLd,
  usOfficeJsonLd,
];
