import { CollectionQuery } from '@/lib/query/types';
import { encodeCollectionQuery } from '@/lib/query/query-builder';
import { baseQuery } from '@/store/base-query';
import { createApi } from '@reduxjs/toolkit/query/react';

export interface Candidate {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  salary?: string;
  startDate?: string;
  resume?: string;
  voiceNote?: string;
  remark?: string;
  github?: string;
  extra?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCandidate {
  fullName: string;
  email: string;
  phoneNumber?: string;
  salary?: string;
  startDate?: string;
  resume?: string;
  voiceNote?: string;
  remark?: string;
  github?: string;
  extra?: Record<string, unknown>;
}

export interface CandidateListResponse {
  total: number;
  items: Candidate[];
}

const baseURL = '/candidates';

export const candidatesApi = createApi({
  reducerPath: 'candidatesApi',
  baseQuery: baseQuery,
  refetchOnFocus: true,
  tagTypes: ['Candidate'],
  endpoints: (builder) => ({
    getCandidates: builder.query<
      CandidateListResponse,
      CollectionQuery | undefined
    >({
      query: (collectionQuery) => {
        let q = '';
        if (collectionQuery) {
          const encoded = encodeCollectionQuery(collectionQuery);
          q = `?q=${encoded}`;
        }
        return { url: `${baseURL}${q}`, method: 'GET' };
      },
      providesTags: ['Candidate'],
    }),

    getCandidate: builder.query<Candidate, string>({
      query: (id) => ({ url: `${baseURL}/${id}`, method: 'GET' }),
      providesTags: ['Candidate'],
    }),

    createCandidate: builder.mutation<Candidate, CreateCandidate>({
      query: (data) => ({
        url: `${baseURL}`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Candidate'],
    }),

    updateCandidate: builder.mutation<
      Candidate,
      { id: string; data: Partial<CreateCandidate> }
    >({
      query: ({ id, data }) => ({
        url: `${baseURL}/${id}`,
        method: 'PUT',
        body: { ...data, id },
      }),
      // Optimistic patch to the list cache, roll back on failure.
      onQueryStarted: async ({ id, data }, { dispatch, queryFulfilled }) => {
        const patch = dispatch(
          candidatesApi.util.updateQueryData(
            'getCandidates',
            undefined,
            (draft) => {
              const item = draft.items.find((i) => i.id === id);
              if (item) Object.assign(item, data);
            },
          ),
        );
        try {
          const { data: updated } = await queryFulfilled;
          if (updated) {
            dispatch(
              candidatesApi.util.updateQueryData(
                'getCandidates',
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

    deleteCandidate: builder.mutation<Candidate, { id: string }>({
      query: ({ id }) => ({ url: `${baseURL}/${id}`, method: 'DELETE' }),
      onQueryStarted: async ({ id }, { dispatch, queryFulfilled }) => {
        const patch = dispatch(
          candidatesApi.util.updateQueryData(
            'getCandidates',
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

    importCandidates: builder.mutation<
      { imported?: number; items?: Candidate[] },
      FormData
    >({
      query: (formData) => ({
        url: `${baseURL}/import`,
        method: 'POST',
        body: formData,
      }),
      invalidatesTags: ['Candidate'],
    }),
  }),
});

export const {
  useGetCandidatesQuery,
  useGetCandidateQuery,
  useCreateCandidateMutation,
  useUpdateCandidateMutation,
  useDeleteCandidateMutation,
  useImportCandidatesMutation,
} = candidatesApi;
