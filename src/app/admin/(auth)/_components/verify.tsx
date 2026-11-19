'use client';

import type React from 'react';

import { useState, useEffect } from 'react';
import {
  TextInput,
  Button,
  Text,
  Stack,
  Group,
  Container,
} from '@mantine/core';
import { useRouter } from 'next/navigation';

export default function Verification() {
  const [code, setCode] = useState(['2', '2', '2', '2']);
  const [timeLeft, setTimeLeft] = useState(10);

  const router = useRouter();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    router.push('/admin/new-password');
  };

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  const handleInputChange = (index: number, value: string) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newCode = [...code];
      newCode[index] = value;
      setCode(newCode);

      // Auto-focus next input
      if (value && index < 3) {
        const nextInput = document.getElementById(`code-${index + 1}`);
        nextInput?.focus();
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const prevInput = document.getElementById(`code-${index - 1}`);
      prevInput?.focus();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Container
      size="sm"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Stack align="center" gap="xl" style={{ width: '100%', maxWidth: 400 }}>
        <Text
          size="48px"
          fw={400}
          c="#1e3a5f"
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          Verification
        </Text>

        <Text size="lg" c="#9ca3af" ta="center" style={{ maxWidth: 350 }}>
          Enter your 4 digits code that you received on your email.
        </Text>

        <Group gap="md" justify="center">
          {code.map((digit, index) => (
            <TextInput
              key={index}
              id={`code-${index}`}
              value={digit}
              onChange={(e) => handleInputChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              size="xl"
              styles={{
                input: {
                  width: 80,
                  height: 80,
                  textAlign: 'center',
                  fontSize: '32px',
                  fontWeight: 400,
                  //   border: '2px solid #ff6b35',
                  borderRadius: 8,
                  color: '#1e3a5f',
                  backgroundColor: 'white',
                  '&:focus': {
                    borderColor: '#ff6b35',
                    boxShadow: 'none',
                  },
                },
              }}
              maxLength={1}
            />
          ))}
        </Group>

        <Text
          size="xl"
          c="#ff6b35"
          fw={400}
          style={{ marginTop: 20, marginBottom: 20 }}
        >
          {formatTime(timeLeft)}
        </Text>

        <Button
          size="xl"
          fullWidth
          style={{
            backgroundColor: '#1e3a5f',
            color: 'white',
            height: 60,
            fontSize: '18px',
            fontWeight: 500,
            letterSpacing: '1px',
            border: 'none',
            borderRadius: 8,
            '&:hover': {
              backgroundColor: '#2d4a6b',
            },
          }}
          onClick={handleSubmit}
        >
          VERIFY
        </Button>

        <Text size="md" c="#9ca3af" ta="center" style={{ marginTop: 20 }}>
          If you didn&apos;t receive a code!{' '}
          <Text
            component="span"
            c="#ff6b35"
            style={{ cursor: 'pointer', textDecoration: 'none' }}
            onClick={() => setTimeLeft(60)}
          >
            Resend
          </Text>
        </Text>
      </Stack>
    </Container>
  );
}
