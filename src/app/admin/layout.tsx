import '@/styles/mantine.css';

import RootStyleRegistry from '@/providers/mantine';
import { Providers } from '@/store/provider';

// Wraps both admin route groups, `(auth)` and `(dashboard)`. The Mantine
// provider and the Redux store live here rather than in the root layout so
// they are never part of the marketing entry point.

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <RootStyleRegistry>{children}</RootStyleRegistry>
    </Providers>
  );
}
