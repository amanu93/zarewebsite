'use client';

import { Container, Grid, Paper, Title, Box } from '@mantine/core';
import Image from 'next/image';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Container fluid p={0} style={{ minHeight: '100vh' }}>
      <Grid gutter={0} style={{ minHeight: '100vh' }}>
        {/* Left Side - Dark Section */}
        <Grid.Col span={6}>
          <Paper
            style={{
              background: 'linear-gradient(135deg, #1e3a5f 0%, #2c5f7c 100%)',
              minHeight: '100vh',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'flex-start',
              padding: '4rem',
              position: 'relative',
            }}
          >
            <Title
              order={1}
              size="3.5rem"
              fw={700}
              c="white"
              style={{
                marginBottom: '3rem',
                lineHeight: 1.1,
                maxWidth: '400px',
                textWrap: 'nowrap',
              }}
            >
              Zare Admin Portal
            </Title>

            <Box>
              <Image
                src="/admin/auth/admin-illustration.svg"
                alt="Admin Portal Illustration"
                width={400}
                height={300}
                style={{
                  maxWidth: '100%',
                  height: 'auto',
                  filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.3))',
                }}
              />
            </Box>
          </Paper>
        </Grid.Col>

        {/* Right Side - Login Form */}
        <Grid.Col span={6}>{children}</Grid.Col>
      </Grid>
    </Container>
  );
}
