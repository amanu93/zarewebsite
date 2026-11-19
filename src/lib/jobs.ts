import type { JobType } from "@/types/job";

export async function getJob(id: string): Promise<JobType | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/job/${id}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data ?? null;
  } catch {
    return null;
  }
}

// BUGFIX (M6): this used to be `Array.isArray(data) ? data : []`, but the
// endpoint returns `{ total, items }` -- which is how the RTK Query client in
// store/api/job.api.ts has always typed it. So this returned an empty array on
// every call, and the sitemap has never contained a single job URL. Verified
// against the live API: 4 open roles, 0 of them in sitemap.xml. That is a
// silent loss on the only page type eligible for Google Jobs.
//
// Behaviour is otherwise unchanged: still returns [] on any failure, still
// accepts a bare array if the endpoint ever returns one.
export async function getAllJobs(): Promise<JobType[]> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/job`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return [];

    const data: unknown = await res.json();

    if (Array.isArray(data)) return data as JobType[];
    if (
      data &&
      typeof data === "object" &&
      "items" in data &&
      Array.isArray((data as { items: unknown }).items)
    ) {
      return (data as { items: JobType[] }).items;
    }
    return [];
  } catch {
    return [];
  }
}
