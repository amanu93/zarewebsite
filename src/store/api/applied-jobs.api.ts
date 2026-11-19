import { CollectionQuery } from '@/lib/query/types';
import { encodeCollectionQuery } from '@/lib/query/query-builder';
import { baseQuery } from '@/store/base-query';
import { createApi } from '@reduxjs/toolkit/query/react';

export type AppliedJobStatus =
  | 'Pending'
  | 'Shortlisted'
  | 'Rejected'
  | 'Hired'
  | string;

export interface AppliedJob {
  id: string;
  jobId: string;
  fullName: string;
  email: string;
  phone: string;
  coverLetter: string;
  status: AppliedJobStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppliedJob {
  jobId: string;
  fullName: string;
  email: string;
  phone: string;
  coverLetter: string;
  status: AppliedJobStatus;
}

export interface AppliedJobListResponse {
  total: number;
  items: AppliedJob[];
}

const baseURL = '/applied-jobs';

export const appliedJobsApi = createApi({
  reducerPath: 'appliedJobsApi',
  baseQuery: baseQuery,
  refetchOnFocus: true,
  tagTypes: ['AppliedJob'],
  endpoints: (builder) => ({
    getAppliedJobs: builder.query<AppliedJobListResponse, CollectionQuery | undefined>({
      query: (collectionQuery) => {
        let q = '';
        if (collectionQuery) {
          const encoded = encodeCollectionQuery(collectionQuery);
          q = `?q=${encoded}`;
        }
        return { url: `${baseURL}/all${q}`, method: 'GET' };
      },
      providesTags: ['AppliedJob'],
    }),

    getAppliedJob: builder.query<AppliedJob, string>({
      query: (id) => ({ url: `${baseURL}/${id}`, method: 'GET' }),
      providesTags: ['AppliedJob'],
    }),

    updateAppliedJob: builder.mutation<
      AppliedJob,
      { id: string; data: Partial<CreateAppliedJob> }
    >({
      query: ({ id, data }) => ({
        url: `${baseURL}/${id}`,
        method: 'PUT',
        body: { ...data, id },
      }),
      // Optimistic update — patch the cached list immediately so the UI
      // reflects the change without waiting for the round-trip, and skip the
      // `invalidatesTags` refetch (which was replacing the whole table with
      // a loading skeleton on every status change). If the server rejects,
      // we roll back and surface the error to the caller.
      onQueryStarted: async ({ id, data }, { dispatch, queryFulfilled }) => {
        const patch = dispatch(
          appliedJobsApi.util.updateQueryData(
            'getAppliedJobs',
            undefined,
            (draft) => {
              const item = draft.items.find((i) => i.id === id);
              if (item) Object.assign(item, data);
            },
          ),
        );
        try {
          const { data: updated } = await queryFulfilled;
          // Reconcile with the authoritative server payload (in case the
          // backend enriched the response with derived fields).
          if (updated) {
            dispatch(
              appliedJobsApi.util.updateQueryData(
                'getAppliedJobs',
                undefined,
                (draft) => {
                  const item = draft.items.find((i) => i.id === id);
                  if (item) Object.assign(item, updated);
                },
              ),
            );
          }
        } catch {
          patch.undo();
        }
      },
    }),

    deleteAppliedJob: builder.mutation<AppliedJob, { id: string }>({
      query: ({ id }) => ({ url: `${baseURL}/${id}`, method: 'DELETE' }),
      // Optimistic removal — take the row out of the list right away and
      // put it back if the server rejects the delete.
      onQueryStarted: async ({ id }, { dispatch, queryFulfilled }) => {
        const patch = dispatch(
          appliedJobsApi.util.updateQueryData(
            'getAppliedJobs',
            undefined,
            (draft) => {
              draft.items = draft.items.filter((i) => i.id !== id);
              if (typeof draft.total === 'number') {
                draft.total = Math.max(0, draft.total - 1);
              }
            },
          ),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),
  }),
});

export const {
  useGetAppliedJobsQuery,
  useGetAppliedJobQuery,
  useUpdateAppliedJobMutation,
  useDeleteAppliedJobMutation,
} = appliedJobsApi;
