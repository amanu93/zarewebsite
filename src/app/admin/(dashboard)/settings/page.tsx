'use client';

import { IconSettings } from '@tabler/icons-react';
import { ComingSoon } from '../_components/coming-soon';

export default function SettingsPage() {
  return (
    <ComingSoon
      title="Settings"
      tagline="One place to update your profile, password, notification preferences, and the organisation defaults that shape the admin experience."
      icon={<IconSettings size={22} />}
      bullets={[
        {
          title: 'Profile & password',
          description: 'Change your name, email, avatar, and password.',
        },
        {
          title: 'Notifications',
          description: 'Pick which events email you and how often.',
        },
        {
          title: 'Team',
          description: 'Invite teammates and manage their roles.',
        },
        {
          title: 'Branding',
          description: 'Tweak logos, colours, and public defaults.',
        },
      ]}
    />
  );
}
