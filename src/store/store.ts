import { configureStore } from '@reduxjs/toolkit';

import entityApi from './entity/api';
import { authApi } from './api/auth/auth.api';
import { jobApi } from './api/job.api';
import { appliedJobsApi } from './api/applied-jobs.api';
import { usersApi } from './api/users.api';
import { candidatesApi } from './api/candidates.api';
import { resetPasswordReducer } from './api/auth/resetPasswordSlice';


// Entity slices are generated from ENTITY_LIST at module load, so the store
// picks up new entities without another edit here. Carried over from dev.
const { reducers: entityReducers, middleware: entityMiddleware } = entityApi;

export const store = configureStore({
  reducer: {
    ...entityReducers,
    resetPassword: resetPasswordReducer,
    [authApi.reducerPath]: authApi.reducer,
    [jobApi.reducerPath]: jobApi.reducer,
    [appliedJobsApi.reducerPath]: appliedJobsApi.reducer,
    [usersApi.reducerPath]: usersApi.reducer,
    [candidatesApi.reducerPath]: candidatesApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      ...entityMiddleware,
      authApi.middleware,
      jobApi.middleware,
      appliedJobsApi.middleware,
      usersApi.middleware,
      candidatesApi.middleware,
    ),
  devTools: process.env.NODE_ENV !== 'production',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
