import { CollectionQuery } from '@/lib/query/types';
import { encodeCollectionQuery } from '@/lib/query/query-builder';
import { baseQuery } from '@/store/base-query';
import { createApi } from '@reduxjs/toolkit/query/react';

export interface User {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  phone?: string;
  role?: string;
  status?: string;
  organizationName?: string;
  bankAccount?: string;
  profilePicture?: string;
  accountId?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * What `POST /api/accounts/create-account` accepts. This is the ONLY
 * endpoint that creates a sign-in-capable user: it writes the `accounts`
 * row (with a generated first-time password) and the `users` row together.
 *
 * `POST /api/user` cannot be used for this — it inserts straight into
 * `users`, whose `accountId` is NOT NULL, so it fails with a constraint
 * error and no account is ever created.
 */
export interface CreateAccountRequest {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  /** Required by the DTO; the portal and admin are both 'web'. */
  type: 'web' | 'mobile';
  /** Required by the DTO and then ignored by the service — there is no
   *  organisations table. Sent as a constant until one exists. */
  organizationId: string;
}

/** The account row the API returns. `firstTimePassword` is the credential
 *  to hand the new user: nothing is emailed, so it is shown once. */
export interface CreateAccountResponse {
  id: string;
  email: string;
  firstTimePassword: string;
  isPasswordUpdated: boolean;
  role?: string;
}

/**
 * `POST /api/accounts/update-password` exchanges the generated first-time
 * password for a real one and flips `isPasswordUpdated`. Until that runs,
 * sign-in refuses the account with `password_not_updated`, so creating a
 * user is a two-step operation.
 */
export interface SetFirstPasswordRequest {
  email: string;
  firstTimePassword: string;
  password: string;
}

/** The only user columns that exist, and so the only ones an edit can set. */
export interface UpdateUser {
  firstName: string;
  lastName: string;
  email: string;
}

export interface UserListResponse {
  total: number;
  items: User[];
}

const baseURL = '/user';

export const usersApi = createApi({
  reducerPath: 'usersApi',
  baseQuery: baseQuery,
  refetchOnFocus: true,
  tagTypes: ['User'],
  endpoints: (builder) => ({
    getUsers: builder.query<
      UserListResponse,
      { listId: string; query?: CollectionQuery }
    >({
      query: ({ listId, query }) => {
        let q = '';
        if (query) {
          q = `?q=${encodeCollectionQuery(query)}`;
        }
        return { url: `${baseURL}/list/${listId}${q}`, method: 'GET' };
      },
      providesTags: ['User'],
    }),

    getUser: builder.query<User, string>({
      query: (id) => ({ url: `${baseURL}/${id}`, method: 'GET' }),
      providesTags: ['User'],
    }),

    createAccount: builder.mutation<CreateAccountResponse, CreateAccountRequest>({
      query: (data) => ({
        url: '/accounts/create-account',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['User'],
    }),

    setFirstPassword: builder.mutation<unknown, SetFirstPasswordRequest>({
      query: (data) => ({
        url: '/accounts/update-password',
        method: 'POST',
        body: data,
      }),
    }),

    updateUser: builder.mutation<User, { id: string; data: Partial<UpdateUser> }>({
      query: ({ id, data }) => ({
        url: `${baseURL}/${id}`,
        method: 'PUT',
        body: { ...data, id },
      }),
      invalidatesTags: ['User'],
    }),

    deleteUser: builder.mutation<User, { id: string }>({
      query: ({ id }) => ({ url: `${baseURL}/${id}`, method: 'DELETE' }),
      invalidatesTags: ['User'],
    }),
  }),
});

export const {
  useGetUsersQuery,
  useGetUserQuery,
  useCreateAccountMutation,
  useSetFirstPasswordMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
} = usersApi;
