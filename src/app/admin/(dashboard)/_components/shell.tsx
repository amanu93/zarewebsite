'use client';
import { AppShell, Burger, ScrollArea, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { usePathname } from 'next/navigation';
import { ReactNode, useMemo } from 'react';

import Sidebar from './side-bar';

// Map admin path prefixes to a friendly page title for the header. We match
// the longest prefix first so nested routes fall back correctly.
const PAGE_TITLES: Array<{ prefix: string; title: string }> = [
  { prefix: '/admin/job/new', title: 'Create Job Post' },
  { prefix: '/admin/job/', title: 'Edit Job Post' },
  { prefix: '/admin/job', title: 'Job Management' },
  { prefix: '/admin/applicants', title: 'Applicants' },
  { prefix: '/admin/users', title: 'Users' },
  { prefix: '/admin/candidates', title: 'Candidates' },
  { prefix: '/admin/contract-generator', title: 'Contract Generator' },
  { prefix: '/admin/pending-approvals', title: 'Pending Approvals' },
  { prefix: '/admin/expired-jobs', title: 'Expired & Closed Jobs' },
  { prefix: '/admin/settings', title: 'Settings' },
  { prefix: '/admin/help', title: 'Help & Support' },
];

function usePageTitle(pathname: string): string {
  return useMemo(() => {
    const match = PAGE_TITLES.find((entry) => pathname.startsWith(entry.prefix));
    return match?.title ?? 'Admin';
  }, [pathname]);
}

export function Shell({ children }: { children: ReactNode }) {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure(false);
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);
  const pathname = usePathname();
  const pageTitle = usePageTitle(pathname);

  return (
    <AppShell
      header={{ height: 60 }}
      layout="alt"
      navbar={{
        width: desktopOpened ? 270 : 0,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
      }}
      padding="md"
    >
      <AppShell.Header className="border-b border-[#e7eaee] bg-white/95 backdrop-blur">
        <div className="flex h-full items-center gap-3 px-4 sm:px-6">
          <Burger
            opened={mobileOpened}
            onClick={toggleMobile}
            size="sm"
            hiddenFrom="sm"
            color="#0a293b"
          />
          {/* Desktop toggle only shown when sidebar is collapsed — when open,
              the sidebar itself provides an in-panel collapse chevron so the
              control sits visually attached to the panel it controls. */}
          {!desktopOpened && (
            <Burger
              opened={desktopOpened}
              onClick={toggleDesktop}
              size="sm"
              visibleFrom="sm"
              color="#0a293b"
            />
          )}
          <div className="flex flex-col leading-tight">
            <Text size="xs" c="#64748b" className="uppercase tracking-widest">
              Admin
            </Text>
            <Text size="md" fw={600} c="#0a293b">
              {pageTitle}
            </Text>
          </div>
        </div>
      </AppShell.Header>

      <AppShell.Navbar className="border-r-0">
        <ScrollArea className="bg-[#0a293b] h-full" scrollbarSize={6}>
          <Sidebar onCollapse={toggleDesktop} />
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main className="w-full bg-[#f5f7fb]">
        {children}
      </AppShell.Main>
    </AppShell>
  );
}
