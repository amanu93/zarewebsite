/**
 * Recruitment-admin domain, as the portal sees it.
 *
 * These are the landing-api's own shapes (camelCase, unlike the bench's
 * snake_case rows), kept separate from `@/bench/data` because they are a
 * different domain with a different lifecycle: a job posting and an
 * applicant belong to hiring, a bench candidate belongs to availability.
 */

export const JOB_TYPES = ['Remote', 'On-site', 'Hybrid'] as const;
export const WORK_TYPES = [
  'Full-Time',
  'Part-Time',
  'Contract',
  'Freelance',
] as const;

export type JobType = (typeof JOB_TYPES)[number];
export type WorkType = (typeof WORK_TYPES)[number];

export interface Job {
  id: string;
  title: string;
  yearsOfExperience: number;
  location: string;
  type: JobType;
  workType: WorkType;
  /** The API stores these comma-separated; the UI works with an array. */
  skills: string;
  startDate: string;
  endDate: string;
  description: string;
  aboutJob?: string | null;
  aboutCompany?: string | null;
  /** The bench role this job hires for. Applicants moved to the bench land in it. */
  archetypeId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobInput {
  title: string;
  yearsOfExperience: number;
  location: string;
  type: JobType;
  workType: WorkType;
  skills: string;
  startDate: string;
  endDate: string;
  description: string;
  aboutJob?: string;
  aboutCompany?: string;
  archetypeId?: string | null;
}

/** A careers application, as `/api/applied-jobs` returns it. */
export interface Applicant {
  id: string;
  jobId: string;
  fullName: string;
  email: string;
  phone: string;
  coverLetter: string;
  status: string;
  createdAt: string;
}

/** A staff account, as `/api/user` returns it. */
export interface StaffUser {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  status?: string | null;
  accountId?: string | null;
  createdAt?: string | null;
}

/** What creating an account returns. The password is shown once. */
export interface CreatedAccount {
  id: string;
  email: string;
  firstTimePassword: string;
}

/** A job posting is closed once its end date has passed. */
export const isExpired = (job: Job): boolean =>
  new Date(job.endDate).getTime() < Date.now();

export const jobSkills = (job: Pick<Job, 'skills'>): string[] =>
  (job.skills ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export const staffName = (u: StaffUser): string =>
  [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
