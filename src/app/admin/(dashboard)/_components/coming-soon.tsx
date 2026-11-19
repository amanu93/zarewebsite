'use client';

import { Anchor, Text } from '@mantine/core';
import { IconArrowRight, IconTool } from '@tabler/icons-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

type Bullet = { title: string; description: string };

export function ComingSoon({
  title,
  tagline,
  bullets,
  icon,
  primary,
}: {
  title: string;
  tagline: string;
  bullets: Bullet[];
  icon?: ReactNode;
  primary?: { label: string; href: string };
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:py-20">
      <div className="relative overflow-hidden rounded-2xl border border-[#e7eaee] bg-white p-8 sm:p-12 shadow-sm">
        {/* Soft brand ambient glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-[#00a9ab]/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-[#0a293b]/10 blur-3xl"
        />

        <div className="relative flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0a293b] text-white">
              {icon ?? <IconTool size={22} />}
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-[#00a9ab]">
                Coming soon
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-[#0a293b]">
                {title}
              </h1>
            </div>
          </div>

          <Text size="md" c="#4a5568" className="max-w-prose">
            {tagline}
          </Text>

          {bullets.length > 0 && (
            <ul className="mt-2 grid gap-3 sm:grid-cols-2">
              {bullets.map((b) => (
                <li
                  key={b.title}
                  className="rounded-lg border border-[#eef0f3] bg-[#f9fafb] p-4"
                >
                  <div className="text-sm font-semibold text-[#0a293b]">
                    {b.title}
                  </div>
                  <div className="mt-1 text-xs text-[#64748b] leading-relaxed">
                    {b.description}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-4">
            {primary && (
              <Anchor
                component={Link}
                href={primary.href}
                className="inline-flex items-center gap-2 rounded-md bg-[#0a293b] px-4 py-2 text-sm font-medium text-white no-underline hover:bg-[#123b56] transition"
              >
                {primary.label}
                <IconArrowRight size={16} />
              </Anchor>
            )}
            <Anchor
              component={Link}
              href="/admin/job"
              size="sm"
              c="#00a9ab"
            >
              Back to dashboard
            </Anchor>
          </div>
        </div>
      </div>
    </div>
  );
}
