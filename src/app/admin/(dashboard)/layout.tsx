'use client';

import { Shell } from './_components/shell';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Shell>{children}</Shell>;
}
