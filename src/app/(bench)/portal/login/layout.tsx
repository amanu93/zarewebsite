import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Staff sign-in for Zare Bench.',
};

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children;
}
