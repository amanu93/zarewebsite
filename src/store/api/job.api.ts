import { CollectionQuery } from '@/lib/query/types';
import { encodeCollectionQuery } from '@/lib/query/query-builder';
import { baseQuery } from '@/store/base-query';
import { createApi } from '@reduxjs/toolkit/query/react';

export interface CreateJob {
  title: string;
  yearsOfExperience: number;
  location: string;
  type: 'Remote'| 'On-site'| 'Hybrid';
  workType: string;
  skills: string;
  startDate: string | Date;
  endDate: string | Date;
  description: string;
  aboutJob?: string;
  aboutCompany?: string;
}

export interface Job {
  id: string;
  title: string;
  yearsOfExperience: number;
  location: string;
  type: 'Remote' | 'On-site' | 'Hybrid';
  workType: 'Full-Time' | 'Part-Time' | 'Contract' | 'Freelance';
  skills: string;
  startDate: string;
  endDate: string;
  description: string;
  aboutJob?: string;
  aboutCompany?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobListResponse {
  total: number;
  items: Job[];
}

const baseURL = '/job';

export const jobApi = createApi({
  reducerPath: 'jobApi',
  baseQuery: baseQuery,
  refetchOnFocus: true,
  endpoints: (builder) => ({
    createJob: builder.mutation<any, CreateJob>({
      query: (data) => ({
        url: `${baseURL}`,
        method: 'POST',
        body: data,
      }),
    }),

    updateJob: builder.mutation<any, { id: string; data: CreateJob }>({
      query: ({ id, data }) => ({
        url: `${baseURL}/${id}`,
        method: 'PUT',
        body: data,
      }),
    }),

    deleteJob: builder.mutation<any, { id: string }>({
      query: ({ id }) => ({
        url: `${baseURL}/${id}`,
        method: 'DELETE',
      }),
    }),

    getJobs: builder.query<JobListResponse, CollectionQuery>({
      query: (collectionQuery) => {
        let q = '';
        if (collectionQuery) {
          const query = encodeCollectionQuery(collectionQuery);
          q = `?q=${query}`;
        }
        return {
          url: `${baseURL}${q}`,
          method: 'GET',
        };
      },
    }),

    
    getJob: builder.query<Job, string>({
      query: (id) => ({
        url: `${baseURL}/${id}`,
        method: 'GET',
      }),
    }),
  }),
});

export const {
  useCreateJobMutation,
  useUpdateJobMutation,
  useGetJobsQuery,
  useGetJobQuery,   
  useDeleteJobMutation,
} = jobApi;
