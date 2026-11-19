import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * False during server rendering and hydration, true once running in the
 * browser. React reads the server snapshot while hydrating, so the first
 * client render matches the server HTML, then re-renders with `true`.
 *
 * The demo needs this because its data lives in sessionStorage, which the
 * server cannot see. It is the same gate as `useEffect(() => setMounted(true))`
 * without setting state inside an effect.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
