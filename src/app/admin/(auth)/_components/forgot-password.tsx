'use client';

import { useState } from 'react';
import {
  TextInput,
  Button,
  Title,
  Text,
  Container,
  Stack,
} from '@mantine/core';
import { useRouter } from 'next/navigation';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');

  const router = useRouter();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    router.push('/admin/verify');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#fafafa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <Container size="sm" style={{ width: '100%', maxWidth: '448px' }}>
        <Stack gap={32}>
          <Stack gap={24}>
            <Title
              order={1}
              style={{
                fontSize: '36px',
                fontWeight: 400,
                color: '#0a293b',
                lineHeight: 1.2,
                margin: 0,
              }}
            >
              Forgot password
            </Title>

            <Text
              style={{
                color: '#828282',
                fontSize: '16px',
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              Enter your email for the verification proccess,we will send 4
              digits code to your email.
            </Text>
          </Stack>

          <Stack gap={24} style={{ paddingTop: '16px' }}>
            <TextInput
              label="E mail"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              size="lg"
              styles={{
                label: {
                  color: '#0a293b',
                  fontSize: '16px',
                  fontWeight: 400,
                  marginBottom: '12px',
                },
                input: {
                  height: '56px',
                  fontSize: '16px',
                  borderColor: '#9badca',
                  borderRadius: '8px',
                  '&:focus': {
                    borderColor: '#0a293b',
                  },
                },
              }}
            />

            <Button
              size="lg"
              fullWidth
              onClick={handleSubmit}
              style={{
                height: '56px',
                backgroundColor: '#0a293b',
                fontSize: '16px',
                fontWeight: 500,
                borderRadius: '8px',
                border: 'none',
              }}
              styles={{
                root: {
                  '&:hover': {
                    backgroundColor: '#001a72',
                  },
                },
              }}
            >
              CONTINUE
            </Button>
          </Stack>
        </Stack>
      </Container>
    </div>
  );
}
