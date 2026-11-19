import { z } from 'zod';

export const jobSchema = z
  .object({
    title: z.string().min(2).max(100).nonempty(),
    yearsOfExperience: z.number().min(0).max(50).int(),
    location: z.string().min(2).max(100).nonempty(),
    type: z.enum(['Remote', 'On-site', 'Hybrid']),
    workType: z.enum(['Full-Time', 'Part-Time', 'Contract', 'Freelance']),
    skills: z.array(z.string()).min(1).max(10),

    // Properly parse and validate startDate
    // startDate: z.preprocess((val) => {
    //   if (typeof val === 'string' || val instanceof Date) {
    //     const date = new Date(val);
    //     return isNaN(date.getTime()) ? undefined : date;
    //   }
    //   return undefined;
    // }, z.date().refine((date) => {
    //   const today = new Date();
    //   today.setHours(0, 0, 0, 0);
    //   return date >= today;
    // }, {
    //   message: 'Start date cannot be in the past',
    // })),

    startDate: z.preprocess((val) => {
  if (typeof val === 'string' || val instanceof Date) {
    const date = new Date(val);
    return isNaN(date.getTime()) ? undefined : date;
  }
  return undefined;
}, z.date()),


    // Properly parse endDate
    endDate: z.preprocess((val) => {
      if (typeof val === 'string' || val instanceof Date) {
        const date = new Date(val);
        return isNaN(date.getTime()) ? undefined : date;
      }
      return undefined;
    }, z.date()),

    description: z.string().min(10).nonempty(),
    aboutJob: z.string().optional(),
    aboutCompany: z.string().optional(),
  })
  .refine((data) => {
    if (!data.startDate || !data.endDate) return false;
    return data.endDate > data.startDate;
  }, {
    path: ['endDate'],
    message: 'End date must be after start date',
  });

export type JobFormData = z.infer<typeof jobSchema>;
