import type { Metadata } from "next";
import { getJob } from "@/lib/jobs";
import JobDetailContent from "./_components/job-detail-content";
import { logo, ogImage, siteName, siteUrl } from "@/constants";

type Props = {
  params: Promise<{ id: string }>;
};

const logoUrl = `${siteUrl}${logo}`;

/**
 * The API returns `description` as rich HTML, which is right for the page
 * body and right for JSON-LD — schema.org JobPosting expects markup there
 * and Google Jobs renders it.
 *
 * A meta description is plain text, though. Pasted raw, the tags showed up
 * as literal text in search results and social cards ("<p>Key
 * Responsibilities</p><ul><li><p>Architect &amp; Build: …"), and slicing at
 * 160 characters landed mid-tag. So: strip the markup, decode the entities
 * the API double-encodes, collapse whitespace, then cut on a word boundary.
 */
function metaDescription(html: string, max = 157): string {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    // &amp;amp; arrives from the API already double-encoded, so decode &amp;
    // last or the first pass re-creates the entities the others just removed.
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(?:39|x27);/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const job = await getJob(id);

  if (!job) {
    return {
      title: "Job Not Found",
      description: "This job posting could not be found or is no longer available.",
    };
  }

  const truncatedDescription = metaDescription(job.description);

  const pageUrl = `${siteUrl}/careers/${id}`;

  return {
    title: `${job.title} - ${job.workType}`,
    description: truncatedDescription,
    openGraph: {
      title: `${job.title} - ${job.workType}`,
      description: truncatedDescription,
      url: pageUrl,
      type: "website",
      images: [
        {
          url: ogImage.careers,
          width: 1200,
          height: 630,
          alt: siteName,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${job.title} - ${job.workType}`,
      description: truncatedDescription,
      images: [ogImage.careers],
    },
    alternates: {
      canonical: pageUrl,
    },
  };
}

export default async function Careers({ params }: Props) {
  const { id } = await params;
  const job = await getJob(id);

  const jobPostingJsonLd = job
    ? {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        title: job.title,
        description: job.description,
        datePosted: job.startDate,
        validThrough: job.endDate,
        employmentType: job.type?.toUpperCase().replace(/[\s-]/g, "_"),
        jobLocationType: job.workType?.toLowerCase() === "remote" ? "TELECOMMUTE" : undefined,
        jobLocation: {
          "@type": "Place",
          address: {
            "@type": "PostalAddress",
            addressLocality: job.location,
          },
        },
        skills: job.skills,
        hiringOrganization: {
          "@type": "Organization",
          name: siteName,
          sameAs: siteUrl,
          logo: logoUrl,
        },
      }
    : null;

  return (
    <>
      {jobPostingJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingJsonLd) }}
        />
      )}
      <JobDetailContent job={job} />
    </>
  );
}
