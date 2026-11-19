import { fetchBaseQuery } from '@reduxjs/toolkit/query';
import { getCookie, setCookie, deleteCookie } from 'cookies-next';
import { jwtDecode } from 'jwt-decode';

const baseURL = `${process.env.NEXT_PUBLIC_API_URL}/api`;

export const baseQuery = fetchBaseQuery({
  baseUrl: baseURL,
  fetchFn: (...args) => fetch(...args),
  prepareHeaders: async (headers) => {
    const token = getCookie('access_token');
    const refreshToken = getCookie('refreshToken');

    if (typeof token === 'string') {
      try {
        const decoded: Record<string, any> = jwtDecode(token);
        const now = Math.floor(Date.now() / 1000);

        if (decoded.exp < now && typeof refreshToken === 'string') {
          // token expired, refresh
          const refreshed = await fetch(`${baseURL}/employees/refresh-token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${refreshToken}`,
            },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });

          if (refreshed.ok) {
            const data = await refreshed.json();
            setCookie('access_token', data.access_token);
            headers.set('authorization', `Bearer ${data.access_token}`);
          } else {
            deleteCookie('access_token');
            deleteCookie('refreshToken');
          }
        } else {
          headers.set('authorization', `Bearer ${token}`);
        }
      } catch {
        deleteCookie('access_token');
        deleteCookie('refreshToken');
      }
    }

    return headers;
  },
});
