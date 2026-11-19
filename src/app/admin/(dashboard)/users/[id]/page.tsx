'use client';

import {
  Text,
  Group,
  Button,
  TextInput,
  PasswordInput,
  Grid,
  Card,
  Container,
  Alert,
  CopyButton,
  Code,
} from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconArrowLeft, IconCheck, IconCopy } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  UpdateUser,
  useCreateAccountMutation,
  useGetUserQuery,
  useSetFirstPasswordMutation,
  useUpdateUserMutation,
} from '@/store/api/users.api';
import { createUserSchema, editUserSchema, UserFormData } from './user.schema';

/** The DTO requires it; the service ignores it. See users.api.ts. */
const ORGANIZATION_ID = 'zare';

export default function UserForm() {
  const { id } = useParams();
  const userId = Array.isArray(id) ? id[0] : id;
  const isEdit = Boolean(userId && userId !== 'new');

  const router = useRouter();

  const { data: userData, isLoading: isLoadingUser } = useGetUserQuery(
    userId!,
    { skip: !isEdit },
  );

  const [createAccount, { isLoading: isCreating }] = useCreateAccountMutation();
  const [setFirstPassword, { isLoading: isSettingPassword }] =
    useSetFirstPasswordMutation();
  const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();

  /**
   * What to hand the new person. `password` is the one chosen here when the
   * exchange succeeded; if it failed, `firstTimePassword` is shown instead
   * so the account is still recoverable — that value is returned once and
   * is never readable again.
   */
  const [created, setCreated] = useState<{
    email: string;
    password: string;
    usable: boolean;
  } | null>(null);

  const form = useForm<UserFormData>({
    validate: zodResolver(isEdit ? editUserSchema : createUserSchema),
    initialValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
    },
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isEdit && userData) {
      form.setValues({
        firstName: userData.firstName ?? '',
        lastName: userData.lastName ?? '',
        email: userData.email,
        phone: '',
        password: '',
      });
    }
  }, [isEdit, userData]);

  const handleSubmit = async (values: UserFormData) => {
    try {
      if (isEdit && userId) {
        const payload: Partial<UpdateUser> = {
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
        };
        await updateUser({ id: userId, data: payload }).unwrap();

        notifications.show({
          title: 'Success!',
          message: 'User has been updated successfully',
          color: 'teal',
          icon: <IconCheck size={16} />,
        });

        router.push('/admin/users');
        return;
      }

      // Two steps, because the API owns the first password: create the
      // account, then exchange the generated password for the chosen one.
      // Without the exchange the account exists but cannot sign in
      // (`password_not_updated`).
      const account = await createAccount({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phoneNumber: values.phone,
        type: 'web',
        organizationId: ORGANIZATION_ID,
      }).unwrap();

      try {
        await setFirstPassword({
          email: account.email,
          firstTimePassword: account.firstTimePassword,
          password: values.password,
        }).unwrap();
        setCreated({
          email: account.email,
          password: values.password,
          usable: true,
        });
      } catch (exchangeErr) {
        // The account exists; only the password exchange failed. Show the
        // generated one rather than stranding an unusable account.
        console.error('Password exchange failed:', exchangeErr);
        setCreated({
          email: account.email,
          password: account.firstTimePassword,
          usable: false,
        });
      }
    } catch (err) {
      console.error('User submission error:', err);
      notifications.show({
        title: isEdit ? 'Update Failed' : 'Creation Failed',
        message: 'Please check the form and try again.',
        color: 'red',
      });
    }
  };

  const handleSubmitError = (errors: typeof form.errors) => {
    console.error('Form validation errors:', errors);
    notifications.show({
      title: 'Validation Error',
      message: 'Please fix the errors in the form before submitting',
      color: 'red',
      icon: <IconAlertCircle size={16} />,
    });
  };

  if (isEdit && isLoadingUser) {
    return (
      <Container size="lg" py="xl">
        <Text>Loading user data...</Text>
      </Container>
    );
  }

  // Created: the one and only chance to read the first-time password.
  if (created) {
    return (
      <Container size="lg" py="xl">
        <Card shadow="sm" p="xl" radius="md">
          <Text size="xl" color="dark" mb="xs">
            Account created
          </Text>
          <Text size="sm" color="gray.6" mb="lg">
            Send these details to the new user. Nothing is emailed, and this
            password is not shown again.
          </Text>

          {!created.usable && (
            <Alert color="yellow" icon={<IconAlertCircle size={16} />} mb="lg">
              The account was created, but setting the password you chose did
              not go through. The generated first-time password below is what
              the account has now.
            </Alert>
          )}

          <Group mb="xs">
            <Text size="sm" w={140} c="gray.7">
              Email
            </Text>
            <Code>{created.email}</Code>
          </Group>
          <Group mb="lg">
            <Text size="sm" w={140} c="gray.7">
              {created.usable ? 'Password' : 'First-time password'}
            </Text>
            <Code>{created.password}</Code>
            <CopyButton value={created.password}>
              {({ copied, copy }) => (
                <Button
                  size="xs"
                  variant="light"
                  color={copied ? 'teal' : 'gray'}
                  leftSection={<IconCopy size={14} />}
                  onClick={copy}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              )}
            </CopyButton>
          </Group>

          <Group>
            <Button
              size="md"
              color="dark"
              style={{ backgroundColor: '#1a365d' }}
              onClick={() => router.push('/admin/users')}
            >
              Done
            </Button>
            <Button
              size="md"
              variant="subtle"
              onClick={() => {
                setCreated(null);
                form.reset();
              }}
            >
              Create another
            </Button>
          </Group>
        </Card>
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl">
      <Group mb="md">
        <Button
          component={Link}
          href="/admin/users"
          variant="subtle"
          leftSection={<IconArrowLeft size={14} />}
        >
          Back to users
        </Button>
      </Group>

      <div className="p-4 rounded-lg bg-white mb-6">
        <Text size="xl" color="dark">
          {isEdit ? 'Edit User' : 'Create a User'}
        </Text>
        <Text size="sm" color="gray.6">
          {isEdit
            ? 'Update the details below to modify this user.'
            : 'Fill out the form to add a new admin/team user. A first-time password is generated for them.'}
        </Text>
      </div>

      <Card shadow="sm" p="xl" radius="md">
        <form onSubmit={form.onSubmit(handleSubmit, handleSubmitError)}>
          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="First Name"
                placeholder="Jane"
                size="md"
                withAsterisk
                {...form.getInputProps('firstName')}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Last Name"
                placeholder="Doe"
                size="md"
                withAsterisk
                {...form.getInputProps('lastName')}
              />
            </Grid.Col>

            <Grid.Col span={6}>
              <TextInput
                label="Email"
                placeholder="jane@zareinnovations.com"
                type="email"
                size="md"
                withAsterisk
                {...form.getInputProps('email')}
              />
            </Grid.Col>
            {!isEdit && (
              <>
                <Grid.Col span={6}>
                  <TextInput
                    label="Phone"
                    placeholder="+251 912 345 678"
                    size="md"
                    withAsterisk
                    {...form.getInputProps('phone')}
                  />
                </Grid.Col>
                <Grid.Col span={12}>
                  <PasswordInput
                    label="Password"
                    description="Set the password for this account and pass it on. They can change it later."
                    placeholder="At least 8 characters"
                    size="md"
                    withAsterisk
                    {...form.getInputProps('password')}
                  />
                </Grid.Col>
              </>
            )}
          </Grid>

          <Group mt="xl">
            <Button
              type="submit"
              size="md"
              color="dark"
              style={{ backgroundColor: '#1a365d' }}
              loading={isCreating || isSettingPassword || isUpdating}
            >
              {isEdit ? 'Update User' : 'Create User'}
            </Button>
          </Group>
        </form>
      </Card>
    </Container>
  );
}
