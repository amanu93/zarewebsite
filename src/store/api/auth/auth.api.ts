
import { baseQuery } from '@/store/base-query';
import { createApi } from '@reduxjs/toolkit/query/react';

interface User {
  email: string;
  password: string;
}

interface Profile {
  email: string
  id: string
  name: string

}
interface ResetPasswordUpdate {
  email: string;
  otp: string;
  confirmPassword: string;
}

interface ResetPasswordEmail {
  email: string;
}

interface ResetPasswordOTPVerify {
  email: string;
  otp: string
}

const baseURL = `${process.env.NEXT_PUBLIC_API_URL}/api/accounts`;

export const authApi = createApi({
  reducerPath: 'authApi',
  refetchOnFocus: true,
  baseQuery: baseQuery,
  endpoints: (builder) => ({
    signIn: builder.mutation<any, User>({
      query: (data) => ({
        url: `${baseURL}/sign-in`,
        method: 'POST',
        body: {
          ...data,
          phoneNumber: "string",
          type: "string"
        },
      }),
    }),

    resetpasswordEmail: builder.mutation<any, ResetPasswordEmail>({
      query: (data) => ({
        url: `${baseURL}/reset-password`,
        method: 'POST',
        body: data,
      }),
    }),


    resetpasswordUpdate: builder.mutation<any, ResetPasswordUpdate>({
      query: (data) => ({
        url: `${baseURL}/reset-password-update`,
        method: 'POST',
        body: data,
      }),
    }),

    updatePassword: builder.mutation<any, ResetPasswordEmail>({
      query: (data) => ({
        url: `${baseURL}/update-password`,
        method: 'POST',
        body: data,
      }),
    }),
    resetpasswordVerify: builder.mutation<any, ResetPasswordOTPVerify>({
      query: (data) => ({
        url: `${baseURL}/reset-password-verify`,
        method: 'POST',
        body: data,
      }),
    }),

    profile: builder.query<Profile, void>({
      query: () => ({
        url: `${baseURL}/me`,
        method: 'GET',
      }),
    }),

  }),
});

export const {
  useSignInMutation,
  useUpdatePasswordMutation,
  useProfileQuery,
  useResetpasswordVerifyMutation,
  useResetpasswordEmailMutation,
  useResetpasswordUpdateMutation
} = authApi;
