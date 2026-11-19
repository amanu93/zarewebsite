import React from 'react';
import type { JobType } from '@/types/job';

export default function Hero({job}:{job: JobType}) {
  return (
    <div
      className="w-full flex flex-col justify-center gap-4 min-h-[278px] bg-cyan-600 relative text-white px-5 md:px-16"
      style={{
        backgroundImage: `url(/careers/hero.svg)`,
        backgroundPosition: "center",
        backgroundSize: "cover",
        backgroundColor: "#0a293b"
      }}
    >
      <div className="flex flex-col">
        <h1 className="z-10 text-[36px] font-bold uppercase">{job.title}</h1>
      </div>
      <div className="flex flex-wrap gap-2.5 text-sm capitalize">
        <span className="bg-cyan-500/5 backdrop-blur-sm text-cyan-500 border border-cyan-500 rounded-full px-3 py-1">
          {job.location}
        </span>
        <span className="bg-cyan-500/5 backdrop-blur-sm text-cyan-500 border border-cyan-500 rounded-full px-3 py-1">
          {job.type}
        </span>
        <span className="bg-cyan-500/5 backdrop-blur-sm text-cyan-500 border border-cyan-500 rounded-full px-3 py-1">
          {job.workType}
        </span>
      </div>
    </div>
  );
}
