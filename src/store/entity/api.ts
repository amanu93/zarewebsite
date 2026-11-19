import { createApi } from '@reduxjs/toolkit/query/react';
import { ENTITY_LIST } from './list';
import { baseQuery } from '@/store/base-query';

export interface EntityStoreConfig {
    entity: string;
    baseUrl: string;
  }  

interface EntityApi {
  entitySliceApi: Record<string, any>;
  reducers: Record<string, any>;
  middleware: any[];
}

const entityApi: EntityApi = {
  entitySliceApi: {},
  reducers: {},
  middleware: [],
};
// loop through all entities and create api
ENTITY_LIST.forEach(({ entity }: EntityStoreConfig) => {
  const api = createApi({
    reducerPath: entity,
    tagTypes: [entity],
    baseQuery, // ✅ use it directly
    endpoints: () => ({}),
  });

  entityApi.entitySliceApi[entity] = api;
  entityApi.reducers[api.reducerPath] = api.reducer;
  entityApi.middleware = [...entityApi.middleware, api.middleware];
});


export default entityApi;
