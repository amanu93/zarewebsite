import { EntityStoreConfig } from './api';

export const ENTITY_LIST: EntityStoreConfig[] = [
  {
    entity: 'employees',
    baseUrl: process.env. NEXT_PUBLIC_API_URL ?? '/employees/api/',
  }

]