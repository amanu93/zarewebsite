'use client';

import { IconHelpCircle } from '@tabler/icons-react';
import { ComingSoon } from '../_components/coming-soon';

export default function HelpPage() {
  return (
    <ComingSoon
      title="Help & Support"
      tagline="A single home for admin how-tos, walkthrough videos, and a direct line to the Zare Innovations team when you need it."
      icon={<IconHelpCircle size={22} />}
      bullets={[
        {
          title: 'Guides & walkthroughs',
          description: 'Screen-by-screen instructions for common admin tasks.',
        },
        {
          title: 'Contact support',
          description: 'Reach the Zare team without leaving the dashboard.',
        },
      ]}
      primary={{ label: 'Email support', href: 'mailto:info@zareinnovations.com' }}
    />
  );
}
