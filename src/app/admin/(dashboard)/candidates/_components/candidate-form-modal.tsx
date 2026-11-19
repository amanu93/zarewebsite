'use client';

import {
  Button,
  Grid,
  Group,
  Modal,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconCalendar } from '@tabler/icons-react';
import { useEffect } from 'react';
import { z } from 'zod';
import {
  useCreateCandidateMutation,
  useUpdateCandidateMutation,
  type Candidate,
  type CreateCandidate,
} from '@/store/api/candidates.api';

const optionalString = z
  .string()
  .transform((v) => v.trim())
  .transform((v) => (v.length === 0 ? undefined : v))
  .optional();

const candidateSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(120),
  email: z.string().trim().email('Enter a valid email'),
  phoneNumber: optionalString,
  salary: optionalString,
  startDate: z
    .union([z.date(), z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (!v) return undefined;
      if (v instanceof Date) return v.toISOString();
      return v;
    })
    .optional(),
  resume: optionalString,
  voiceNote: optionalString,
  remark: optionalString,
  github: optionalString,
});

type CandidateFormValues = {
  fullName: string;
  email: string;
  phoneNumber: string;
  salary: string;
  startDate: Date | null;
  resume: string;
  voiceNote: string;
  remark: string;
  github: string;
};

const empty: CandidateFormValues = {
  fullName: '',
  email: '',
  phoneNumber: '',
  salary: '',
  startDate: null,
  resume: '',
  voiceNote: '',
  remark: '',
  github: '',
};

export function CandidateFormModal({
  candidate,
  mode,
  onClose,
}: {
  candidate: Candidate | null;
  mode: 'create' | 'edit' | null;
  onClose: () => void;
}) {
  const [createCandidate, { isLoading: isCreating }] =
    useCreateCandidateMutation();
  const [updateCandidate, { isLoading: isUpdating }] =
    useUpdateCandidateMutation();

  const form = useForm<CandidateFormValues>({
    initialValues: empty,
    validate: zodResolver(candidateSchema),
  });

  const opened = mode !== null;

  useEffect(() => {
    if (!opened) return;
    if (mode === 'edit' && candidate) {
      form.setValues({
        fullName: candidate.fullName ?? '',
        email: candidate.email ?? '',
        phoneNumber: candidate.phoneNumber ?? '',
        salary: candidate.salary ?? '',
        startDate: candidate.startDate ? new Date(candidate.startDate) : null,
        resume: candidate.resume ?? '',
        voiceNote: candidate.voiceNote ?? '',
        remark: candidate.remark ?? '',
        github: candidate.github ?? '',
      });
    } else {
      form.setValues(empty);
    }
    form.resetDirty();
    form.resetTouched();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, candidate?.id, mode]);

  const handleSubmit = async (raw: CandidateFormValues) => {
    if (mode === null) return;
    // Zod strips empties to undefined; keep the payload minimal.
    const parsed = candidateSchema.safeParse(raw);
    if (!parsed.success) return;
    const payload = parsed.data as CreateCandidate;

    try {
      if (mode === 'edit' && candidate) {
        await updateCandidate({ id: candidate.id, data: payload }).unwrap();
        notifications.show({
          color: 'teal',
          title: 'Candidate updated',
          message: `${payload.fullName} has been saved.`,
        });
      } else {
        await createCandidate(payload).unwrap();
        notifications.show({
          color: 'teal',
          title: 'Candidate added',
          message: `${payload.fullName} is now in the roster.`,
        });
      }
      onClose();
    } catch (err) {
      console.error('Candidate save failed', err);
      notifications.show({
        color: 'red',
        title: mode === 'edit' ? 'Update failed' : 'Create failed',
        message: 'Please try again in a moment.',
      });
    }
  };

  const submitting = isCreating || isUpdating;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <div>
          <Text fw={600} c="#0a293b">
            {mode === 'edit' ? 'Edit candidate' : 'Add candidate'}
          </Text>
          <Text size="xs" c="#64748b" mt={2}>
            {mode === 'edit'
              ? 'Update this candidate’s roster profile.'
              : 'Add a new candidate to the internal roster.'}
          </Text>
        </div>
      }
      size="lg"
      centered
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Grid gutter="md">
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="Full name"
              placeholder="Jane Doe"
              withAsterisk
              {...form.getInputProps('fullName')}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="Email"
              type="email"
              placeholder="jane@example.com"
              withAsterisk
              {...form.getInputProps('email')}
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="Phone"
              placeholder="+251…"
              {...form.getInputProps('phoneNumber')}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="Expected salary"
              placeholder="e.g. $3,500 / month"
              {...form.getInputProps('salary')}
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6 }}>
            <DateInput
              label="Availability start"
              placeholder="Select date"
              rightSection={<IconCalendar size={16} />}
              clearable
              {...form.getInputProps('startDate')}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="GitHub"
              placeholder="https://github.com/…"
              {...form.getInputProps('github')}
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="Resume URL"
              placeholder="Public link or S3 key"
              {...form.getInputProps('resume')}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="Voice note URL"
              placeholder="Public link"
              {...form.getInputProps('voiceNote')}
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <Textarea
              label="Remark"
              placeholder="Recruiter notes, interview highlights, availability caveats…"
              autosize
              minRows={3}
              {...form.getInputProps('remark')}
            />
          </Grid.Col>
        </Grid>

        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting} color="dark">
            {mode === 'edit' ? 'Save changes' : 'Add candidate'}
          </Button>
        </Group>
      </form>
    </Modal>
  );
}
