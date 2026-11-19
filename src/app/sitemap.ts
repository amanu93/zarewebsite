import type { MetadataRoute } from "next";
import { getAllJobs } from "@/lib/jobs";
import { SCALE_CHALLENGE_ENABLED, siteUrl } from "@/constants";
import { publishedCases } from "@/content/work";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    {
      url: `${siteUrl}/work`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/careers`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/faq`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    // Listed only while the Scale Challenge is live. The route 404s when the
    // flag is off, and a sitemap must never advertise a page that does not
    // answer.
    ...(SCALE_CHALLENGE_ENABLED
      ? ([
          {
            url: `${siteUrl}/scale-challenge`,
            lastModified: now,
            changeFrequency: "monthly" as const,
            priority: 0.7,
          },
        ] satisfies MetadataRoute.Sitemap)
      : []),
  ];

  // Case studies. Only published ones exist as routes, and publishedCases() is
  // the same gate generateStaticParams uses, so the sitemap cannot list a page
  // that was not built.
  const casePages: MetadataRoute.Sitemap = publishedCases().map((c) => ({
    url: `${siteUrl}/work/${c.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  // Job pages. These were absent from every sitemap until the M6 fix to
  // getAllJobs; see the note there. They are the only pages eligible for
  // Google Jobs, so their discovery matters more than anything else here.
  let jobPages: MetadataRoute.Sitemap = [];
  try {
    const jobs = await getAllJobs();
    jobPages = jobs.map((job) => ({
      url: `${siteUrl}/careers/${job.id}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch {
    // A sitemap missing job URLs beats a build that fails because the jobs API
    // was briefly unavailable.
  }

  return [...staticPages, ...casePages, ...jobPages];
}
