'use client';

import {
  Container,
  Stack,
  Text,
  Button,
  ThemeIcon,
  Center,
} from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import '@mantine/core/styles.css';
import { useRouter } from 'next/navigation';

export default function SuccessScreen() {
  const router = useRouter();
  return (
    <Container size="sm" style={{ minHeight: '100vh' }}>
      <Center style={{ minHeight: '100vh' }}>
        <Stack align="center" gap="xl" style={{ width: '100%', maxWidth: 400 }}>
          {/* Success Icon */}
          <ThemeIcon
            size={120}
            radius="xl"
            color="teal"
            variant="outline"
            style={{
              borderWidth: 8,
              backgroundColor: 'white',
            }}
          >
            <IconCheck size={60} stroke={3} />
          </ThemeIcon>

          {/* Success Text */}
          <Stack align="center" gap="md">
            <Text
              size="48px"
              fw={400}
              c="#1e3a5f"
              ta="center"
              style={{
                fontFamily: 'system-ui, -apple-system, sans-serif',
                lineHeight: 1.1,
              }}
            >
              Successfully
            </Text>

            <Text
              size="lg"
              c="#9ca3af"
              ta="center"
              style={{
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              Your password has been reset successfully
            </Text>
          </Stack>

          {/* Continue Button */}
          <Button
            size="lg"
            fullWidth
            radius="md"
            style={{
              backgroundColor: '#1e3a5f',
              border: 'none',
              height: 56,
              fontSize: '16px',
              fontWeight: 600,
              letterSpacing: '0.5px',
              marginTop: '2rem',
            }}
            styles={{
              root: {
                '&:hover': {
                  backgroundColor: '#2d4a6b',
                },
              },
            }}
            onClick={() => router.push('/admin/job')}
          >
            CONTINUE
          </Button>
        </Stack>
      </Center>
    </Container>
  );
}
