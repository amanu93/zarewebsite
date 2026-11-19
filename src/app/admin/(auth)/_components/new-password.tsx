'use client';
import type React from 'react';
import { useState } from 'react';
import {
  Box,
  Button,
  Container,
  PasswordInput,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useRouter } from 'next/navigation';

export default function NewPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const router = useRouter();
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    router.push('/admin/success');
  };
  return (
    <Box bg="#ffffff" py={80}>
      <Container size="xs">
        <Stack gap="lg">
          <div>
            <Title order={1} fw={400} c="#0a293b" fz={36} mb="xs">
              New Password
            </Title>
            <Text c="#828282" fz="md">
              Set the new password for your account so you can login and access
              all features.
            </Text>
          </div>

          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              <PasswordInput
                label="Enter new password"
                placeholder="8 symbols at least"
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                styles={{
                  root: { marginTop: 16 },
                  label: {
                    color: '#0a293b',
                    fontSize: '16px',
                    fontWeight: 400,
                    marginBottom: 8,
                  },
                  input: {
                    backgroundColor: '#fafafa',
                    borderColor: '#eaeaea',
                    color: '#828282',
                    height: 48,
                    fontSize: '16px',
                    '&::placeholder': {
                      color: '#828282',
                    },
                  },
                  innerInput: {
                    height: 46,
                    fontSize: '16px',
                  },
                  visibilityToggle: {
                    color: '#828282',
                  },
                }}
                visibilityToggleIcon={({ reveal }) => (
                  <svg
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {reveal ? (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    ) : (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </>
                    )}
                  </svg>
                )}
              />

              <PasswordInput
                label="Confirm password"
                placeholder="8 symbols at least"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.currentTarget.value)
                }
                styles={{
                  root: { marginTop: 8, marginBottom: 24 },
                  label: {
                    color: '#0a293b',
                    fontSize: '16px',
                    fontWeight: 400,
                    marginBottom: 8,
                  },
                  input: {
                    backgroundColor: '#fafafa',
                    borderColor: '#eaeaea',
                    color: '#828282',
                    height: 48,
                    fontSize: '16px',
                    '&::placeholder': {
                      color: '#828282',
                    },
                  },
                  innerInput: {
                    height: 46,
                    fontSize: '16px',
                  },
                  visibilityToggle: {
                    color: '#828282',
                  },
                }}
                visibilityToggleIcon={({ reveal }) => (
                  <svg
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {reveal ? (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    ) : (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </>
                    )}
                  </svg>
                )}
              />

              <Button
                type="submit"
                fullWidth
                styles={{
                  root: {
                    backgroundColor: '#0a293b',
                    height: 48,
                    fontSize: '16px',
                    fontWeight: 500,
                    letterSpacing: '0.5px',
                    '&:hover': {
                      backgroundColor: 'rgba(10, 41, 59, 0.9)',
                    },
                  },
                }}
                onClick={handleSubmit}
              >
                UPDATE PASSWORD
              </Button>
            </Stack>
          </form>
        </Stack>
      </Container>
    </Box>
  );
}
