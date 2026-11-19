'use client';

import {
  Box,
  Paper,
  Text,
  TextInput,
  Button,
  Stack,
  Title,
  Anchor,
} from '@mantine/core';
import dynamic from 'next/dynamic';
import React, { useEffect, useState } from 'react';
import { IconMail, IconLock, IconArrowRight } from '@tabler/icons-react';
// import Link from 'next/link';
import { useSignInMutation } from '@/store/api/auth/auth.api';
import z from 'zod';
import { setCookie } from 'cookies-next';
import { useForm } from 'react-hook-form';
import { notifications } from '@mantine/notifications';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';

// ⛔ Avoid SSR for Image
const ClientImage = dynamic(() => import('next/image'), { ssr: false });

// Validation schema
const schema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type FormSchema = z.infer<typeof schema>;

export default function LoginPage() {
  const [signIn, { isLoading: isSignIn }] = useSignInMutation();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormSchema>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    // Gates the form behind a client-only render to dodge a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const onSubmit = async (data: FormSchema) => {
    try {
      const res = await signIn(data).unwrap();

      setCookie("access_token", res.access_token, { maxAge: 60 * 60 * 24 });
      setCookie("refresh_token", res.refresh_token, { maxAge: 60 * 60 * 24 * 7 });

      router.push("/admin/job");
    } catch (err) {
      console.error("Login error:", err);
      notifications.show({
        title: "Login Failed",
        message: "Incorrect email or password.",
        color: "red",
      });
    }
  };

  // Avoid hydration mismatch
  if (!mounted) return null;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Paper
        style={{
          minHeight: '100vh',
          backgroundColor: '#fff',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Logo */}
        <Box p="xl" style={{ alignSelf: 'flex-end' }}>
          <ClientImage
            src="/zare-logo.svg"
            width={300}
            height={300}
            alt="Zare Logo"
            className="w-full"
          />
        </Box>

        {/* Login Form */}
        <Box
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
          }}
        >
          <Stack gap="xl" style={{ width: '100%', maxWidth: 400 }}>
            <Stack gap="xs" align="center">
              <Title order={2} fw={700} c="#1e3a5f" size="2rem">
                WELCOME BACK
              </Title>
              <Text c="dimmed" size="sm" fw={500}>
                LOG IN TO CONTINUE
              </Text>
            </Stack>

            <Stack gap="md">
              <TextInput
                placeholder="example@email.com"
                leftSection={<IconMail size={18} color="#9ca3af" />}
                size="lg"
                {...register("email")}
                error={errors.email?.message}
                styles={{
                  input: {
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    padding: '1rem 1rem 1rem 3rem',
                    fontSize: '1rem',
                  },
                }}
              />

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <IconLock size={18} color="#9ca3af" />
      </div>

      <input
        type="password"
        placeholder="••••••••••"
        autoComplete="current-password"
        {...register('password')}
        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {errors.password?.message && <p className="text-red-500 text-sm mt-1">{errors?.password?.message}</p>}
    </div>


              <Button
                size="lg"
                rightSection={<IconArrowRight size={18} />}
                style={{
                  backgroundColor: '#1e3a5f',
                  borderRadius: '8px',
                  padding: '1rem 2rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  marginTop: '1rem',
                }}
                styles={{
                  root: {
                    '&:hover': {
                      backgroundColor: '#2c5f7c',
                    },
                  },
                }}
                type="submit"
                loading={isSignIn}
              >
                Proceed to my Account
              </Button>
            </Stack>

            <Box style={{ textAlign: 'center' }}>
              <Anchor
                component={Link}
                href="/admin/forgot-password"
                c="dimmed"
                size="sm"
                style={{ textDecoration: 'none' }}
              >
                Forgot Password?
              </Anchor>
            </Box>
          </Stack>
        </Box>
      </Paper>
    </form>
  );
}
