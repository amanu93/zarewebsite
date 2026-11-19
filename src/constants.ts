export const siteUrl = "https://zareinnovations.com";
export const landingApiUrl = "https://landing.zareinnovations.com";
export const siteName = "Zare Innovations";
export const logo = "/zare-logo.jpg";

export const consultationLink = "https://calendly.com/emanuel-ypgh/30min";

/**
 * Site-wide switch for the Scale Challenge. Briefly false in the 2026-08
 * leadership round; back on, with the entry points reworded to invite rather
 * than name ('Try our Scale Challenge').
 *
 * While false: the header link and the footer row disappear, the sitemap
 * stops listing the URL, and /scale-challenge answers 404 with a noindex
 * head. Nothing is deleted either way — src/app/(site)/scale-challenge,
 * src/lib/scale-challenge and src/content/scale-challenge.ts stay in the
 * tree, so this one line is the whole hide/show.
 */
export const SCALE_CHALLENGE_ENABLED = true;

export const email = "info@zareinnovations.com";
export const careersEmail = "careers@zareinnovations.com";
export const phone = "+1 703 395 5235";
export const phoneEthiopia = "+251 93 816 9380";
export const phoneRaw = "+17033955235";
export const phoneEthiopiaRaw = "+251938169380";

export const streetUSA = "651 N Broad St, Suite 201";
export const cityUSA = "Middletown";
export const stateUSA = "DE";
export const postalCodeUSA = "19709";
export const addressUSA = `${streetUSA}, ${cityUSA}, Delaware, ${postalCodeUSA}, United States`;
export const geoUSA = { latitude: 39.4496, longitude: -75.7163 };

export const streetEthiopia =
  "Abyssinia Real Estate Building, 13th floor, Bole Japan, Africa Ave";
export const cityEthiopia = "Addis Ababa";
export const addressEthiopia = `${streetEthiopia}, ${cityEthiopia}, Ethiopia`;
export const geoEthiopia = { latitude: 9.0105, longitude: 38.7612 };

export const linkedin = "https://www.linkedin.com/company/zare-innovations";
export const instagram = "https://www.instagram.com/zareinnovations";
export const facebook = "https://www.facebook.com/zareinnovations";
export const telegram = "https://t.me/zareinnovations";
export const whatsapp = "https://wa.me/17033955235";
export const pinterest = "https://www.pinterest.com/zareinnovations";
export const reddit = "https://www.reddit.com/r/zareinnovations";
export const github = "https://www.github.com/zareinnovations";

export const ogImage = {
  home: "/open-graphs/home.png",
  ourWork: "/open-graphs/our-works.png",
  careers: "/open-graphs/careers.png",
} as const;
