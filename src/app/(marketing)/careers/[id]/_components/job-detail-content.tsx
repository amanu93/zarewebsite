"use client";

import React from "react";
import Hero from "./hero";
import Details from "./Details";
import ApplyForm from "./apply-form";
import type { JobType } from "@/types/job";

export default function JobDetailContent({ job }: { job: JobType | null }) {
  return (
    <main>
      {job ? (
        <Hero job={job} />
      ) : (
        <div
          className="w-full flex flex-col justify-center gap-3 min-h-[278px] bg-cyan-600 relative text-white px-5 md:px-16"
          style={{
            backgroundImage: `url(/careers/hero.svg)`,
            backgroundPosition: "center",
            backgroundSize: "cover",
            backgroundColor: "#0a293b",
          }}
        >
          <span className="text-red-400 text-base">
            Something went wrong. This job posting may no longer be available.
          </span>
        </div>
      )}
      <Details job={job} />
      <ApplyForm />
    </main>
  );
}
