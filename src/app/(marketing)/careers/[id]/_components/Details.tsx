"use client";

import { Flex } from "@mantine/core";
import type { JobType } from "@/types/job";

const proseClasses = [
  "text-[15px] min-[501px]:text-base text-black/80",
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  "[&_p]:my-3 [&_p]:leading-relaxed",
  "[&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:mt-6 [&_h1]:mb-2",
  "[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2",
  "[&_h3]:text-lg [&_h3]:font-medium [&_h3]:mt-4 [&_h3]:mb-1.5",
  "[&_ul]:list-disc [&_ul]:pl-5 sm:[&_ul]:pl-10 [&_ul]:my-3 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1",
  "[&_ol]:list-decimal [&_ol]:pl-5 sm:[&_ol]:pl-10 [&_ol]:my-3 [&_ol]:flex [&_ol]:flex-col [&_ol]:gap-1",
  "[&_li]:leading-relaxed",
  "[&_a]:text-cyan-500 [&_a]:underline hover:[&_a]:text-cyan-600",
  "[&_strong]:font-semibold [&_b]:font-semibold",
  "[&_em]:italic [&_i]:italic",
  "[&_mark]:bg-yellow-200 [&_mark]:px-1 [&_mark]:rounded-sm",
  "[&_u]:underline",
  "[&_blockquote]:border-l-4 [&_blockquote]:border-cyan-500 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-black/70",
  "[&_code]:bg-black/5 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.9em]",
].join(" ");

const defaultAboutCompany = `
  <p>
    At Zare Innovations, our mission is to build a super-powerful, exceptionally
    delightful team. We help businesses find exceptional creative talent to bring
    their brand visions to life — through a modern recruiting stack that
    replaces spreadsheets, inboxes and endless tool switching with a single,
    automated platform.
  </p>
`;

const formatDate = (dateString?: string) => {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
};

const HtmlSection = ({ title, html }: { title: string; html: string }) => (
  <div className="flex flex-col gap-1.5">
    <h3 className="z-10 text-[26px] min-[501px]:text-[32px] font-medium uppercase">
      {title}
    </h3>
    <div className={proseClasses} dangerouslySetInnerHTML={{ __html: html }} />
  </div>
);

const Details = ({ job }: { job: JobType | null }) => {
  if (!job) {
    return (
      <Flex className="relative flex flex-col gap-10 md:gap-14 px-5 md:px-16 pt-10 pb-20">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-5">
            <span className="w-1/4 z-10 h-10 bg-cyan-500/20 rounded-sm animate-pulse" />
            <div className="w-3/4 flex flex-col gap-2">
              <div className="w-full h-6 z-10 bg-cyan-500/20 rounded-sm animate-pulse" />
              <div className="w-full h-6 z-10 bg-cyan-500/20 rounded-sm animate-pulse" />
              <div className="w-1/2 h-6 z-10 bg-cyan-500/20 rounded-sm animate-pulse" />
            </div>
          </div>
        ))}
      </Flex>
    );
  }

  const aboutCompanyHtml = job.aboutCompany?.trim()
    ? job.aboutCompany
    : defaultAboutCompany;

  return (
    <Flex className="relative flex flex-col gap-10 md:gap-14 px-5 md:px-16 pt-10 pb-20">
      <HtmlSection title="About the Company" html={aboutCompanyHtml} />

      {job.aboutJob?.trim() && (
        <HtmlSection title="About the Job" html={job.aboutJob} />
      )}

      {job.description?.trim() ? (
        <HtmlSection title="The Role" html={job.description} />
      ) : (
        <div className="flex flex-col gap-1.5">
          <h3 className="z-10 text-[26px] min-[501px]:text-[32px] font-medium uppercase">
            The Role
          </h3>
          <p className="text-[15px] min-[501px]:text-base text-black/60">
            No description provided.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <h3 className="z-10 text-base font-medium uppercase">Job Details</h3>
        <dl className="px-5 grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-2 text-[15px] min-[501px]:text-base">
          <div className="flex">
            <dt className=" min-w-[140px]">Location:</dt>
            <dd className="ml-2">{job.location || "-"}</dd>
          </div>
          <div className="flex">
            <dt className=" min-w-[140px]">Work Type:</dt>
            <dd className="ml-2">{job.workType || "-"}</dd>
          </div>
          <div className="flex">
            <dt className=" min-w-[140px]">Job Type:</dt>
            <dd className="ml-2">{job.type || "-"}</dd>
          </div>
          <div className="flex">
            <dt className=" min-w-[140px]">Years Experience:</dt>
            <dd className="ml-2">
              {typeof job.yearsOfExperience === "number"
                ? job.yearsOfExperience
                : "-"}
            </dd>
          </div>
          <div className="flex">
            <dt className=" min-w-[140px]">Skills Required:</dt>
            <dd className="ml-2">
              {job.skills
                ? job.skills.split(",").map((s, i) => (
                    <span
                      key={i}
                      className="inline-block text-cyan-500 bg-cyan-500/10 backdrop-blur-md px-2 py-0.5 rounded text-sm mr-2 mb-1"
                    >
                      {s.trim()}
                    </span>
                  ))
                : "-"}
            </dd>
          </div>
          <div className="flex">
            <dt className=" min-w-[140px]">Salary:</dt>
            <dd className="ml-2">Based on company scale</dd>
          </div>
          <div className="flex">
            <dt className=" min-w-[140px]">Start Date:</dt>
            <dd className="ml-2">{formatDate(job.startDate)}</dd>
          </div>
          <div className="flex">
            <dt className=" min-w-[140px]">End Date:</dt>
            <dd className="ml-2">{formatDate(job.endDate)}</dd>
          </div>
        </dl>
      </div>
    </Flex>
  );
};

export default Details;
