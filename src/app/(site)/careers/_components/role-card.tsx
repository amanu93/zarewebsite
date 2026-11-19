import Link from 'next/link';

import type { JobType } from '@/types/job';
import { htmlToPlainText, parseSkills } from '@/lib/roles';
import { Heading } from '@/components/typography/heading';
import { MonoLabel } from '@/components/typography/mono-label';
import { panelSurface, linkSurface } from '@/components/content/surface';

/**
 * An open role.
 *
 * Links to the EXISTING /careers/[id] detail page, which owns the application
 * flow, the JobPosting JSON-LD and the S3 resume upload. None of that is
 * touched: this is a new listing surface over an unchanged pipeline.
 */
export function RoleCard({ job }: { job: JobType }) {
  const preview = htmlToPlainText(job.aboutJob) || htmlToPlainText(job.description);
  const skills = parseSkills(job.skills);

  return (
    <article className={`${panelSurface} ${linkSurface} group flex flex-col`}>
      <Link
        href={`/careers/${job.id}`}
        className="flex h-full flex-col gap-4 p-7 no-underline"
      >
        <div className="flex items-start justify-between gap-4">
          <Heading level={3} size="heading">
            {job.title}
          </Heading>
          <span
            aria-hidden="true"
            className="shrink-0 text-[var(--accent-text)] transition-transform group-hover:translate-x-1"
          >
            →
          </span>
        </div>

        <MonoLabel muted size="caption">
          {[job.location, job.type, job.workType].filter(Boolean).join(' · ')}
        </MonoLabel>

        {preview ? (
          <p className="line-clamp-4 whitespace-pre-line text-body-sm text-[var(--muted-color)]">
            {preview}
          </p>
        ) : null}

        {skills.length > 0 ? (
          <ul className="mt-auto flex flex-wrap gap-2 pt-3">
            {skills.map((skill) => (
              <li
                key={skill}
                className="border border-[var(--rule-color)] px-2.5 py-1 font-mono text-[11px] text-[var(--muted-color)]"
              >
                {skill}
              </li>
            ))}
          </ul>
        ) : null}
      </Link>
    </article>
  );
}
