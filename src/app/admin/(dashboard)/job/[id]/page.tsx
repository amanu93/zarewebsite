'use client';
import {
  Text,
  Group,
  Button,
  TextInput,
  Select,
  Grid,
  Card,
  NumberInput,
  Container,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconCalendar, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { useEffect } from 'react';
import '@mantine/tiptap/styles.css';
import { SearchablePill } from '../../_components/searchable-pill';
import {
  CreateJob,
  useUpdateJobMutation,
  useCreateJobMutation,
  useGetJobQuery,
} from '@/store/api/job.api';
import { useParams, useRouter } from 'next/navigation';
import { jobSchema, JobFormData } from './job.schema';
import { JobRichTextField } from './_components/job-rich-text-field';

export default function JobForm() {
  const { id } = useParams();
  const jobId = Array.isArray(id) ? id[0] : id;

  const isEdit = Boolean(jobId && jobId !== 'new' && jobId !== encodeURIComponent('+'));

  const { data: jobData, isLoading: isJobLoading } = useGetJobQuery(jobId!, {
    skip: !isEdit,
  });

  const router = useRouter();

  const [createJob] = useCreateJobMutation();
  const [updateJob] = useUpdateJobMutation();

  const form = useForm<JobFormData>({
    validate: zodResolver(jobSchema),
    initialValues: {
      title: '',
      yearsOfExperience: 2,
      location: '',
      type: 'Remote',
      workType: 'Full-Time',
      skills: [],
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      description: '',
      aboutJob: '',
      aboutCompany: '',
    },
  });

  // Populate form when jobData is loaded
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isEdit && jobData) {
      form.setValues({
        ...jobData,
        skills: jobData.skills?.split(',') || [],
        startDate: jobData.startDate ? new Date(jobData.startDate) : undefined,
        endDate: jobData.endDate ? new Date(jobData.endDate) : undefined,
        aboutJob: jobData.aboutJob ?? '',
        aboutCompany: jobData.aboutCompany ?? '',
      });
    }
  }, [isEdit, jobData]);

  const handleSubmit = async (values: JobFormData) => {
    try {
      const payload = {
        ...values,
        skills: values.skills.join(','),
        aboutJob: values.aboutJob?.trim() ? values.aboutJob : undefined,
        aboutCompany: values.aboutCompany?.trim()
          ? values.aboutCompany
          : undefined,
      } as CreateJob;

      if (isEdit && id) {
        await updateJob({
          id: id as string,
          data: payload,
        }).unwrap();
      } else {
        await createJob(payload).unwrap();
      }

      notifications.show({
        title: 'Success!',
        message: isEdit
          ? 'Job posting has been updated successfully'
          : 'Job posting has been created successfully',
        color: 'teal',
        icon: <IconCheck size={16} />,
      });

      router.push('/admin/job');
    } catch (err) {
      console.error('Job submission error:', err);
      notifications.show({
        title: isEdit ? 'Update Failed' : 'Creation Failed',
        message: 'Please try again later.',
        color: 'red',
      });
    }
  };

  const handleSubmitError = (errors: typeof form.errors) => {
    console.error('Form submission errors:', errors);
    notifications.show({
      title: 'Validation Error',
      message: 'Please fix the errors in the form before submitting',
      color: 'red',
      icon: <IconAlertCircle size={16} />,
    });
  };

  if (isEdit && isJobLoading) {
    return <Text>Loading job data...</Text>;
  }

  return (
    <Container size="lg" py="xl">
      <div>
        <div className="p-4 rounded-lg bg-white mb-6">
          <Text size="xl" color="dark">
            {isEdit ? 'Edit Job' : 'Create a Job'}
          </Text>
          <Text size="sm" color="gray.6">
            {isEdit
              ? 'Update the details below to edit the job listing.'
              : 'Fill out the form below to create a new job listing.'}
          </Text>
        </div>

        <Card shadow="sm" p="xl" radius="md">
          <form onSubmit={form.onSubmit(handleSubmit, handleSubmitError)}>
            <Grid>
              <Grid.Col span={6}>
                <TextInput
                  label="Job Title"
                  placeholder="Enter job title"
                  size="md"
                  withAsterisk
                  {...form.getInputProps('title')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <NumberInput
                  label="Years of Experience"
                  placeholder="Enter years of experience"
                  size="md"
                  withAsterisk
                  min={0}
                  max={50}
                  {...form.getInputProps('yearsOfExperience')}
                />
              </Grid.Col>

              <Grid.Col span={6}>
                <TextInput
                  label="Location"
                  placeholder="Enter location"
                  size="md"
                  withAsterisk
                  {...form.getInputProps('location')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Select
                  label="Job Type"
                  placeholder="Select job type"
                  data={['Remote', 'On-site', 'Hybrid']}
                  size="md"
                  withAsterisk
                  {...form.getInputProps('type')}
                />
              </Grid.Col>

              <Grid.Col span={6}>
                <Select
                  label="Work Type"
                  placeholder="Select work type"
                  data={['Full-Time', 'Part-Time', 'Contract', 'Freelance']}
                  size="md"
                  withAsterisk
                  {...form.getInputProps('workType')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <div>
                  <Text size="sm" mb="xs">
                    <span className="font-medium">Skills</span>{' '}
                    <span style={{ color: 'red' }}>* </span>
                  </Text>

                  <SearchablePill
                    value={form.getInputProps('skills').value as string[]}
                    setValue={(value: string[]) => {
                      form.setFieldValue('skills', [...value]);
                    }}
                  />
                  {form.errors.skills && (
                    <Text color="red" size="sm" mt="xs">
                      {form.errors.skills}
                    </Text>
                  )}
                </div>
              </Grid.Col>
              <Grid.Col span={6}>
                <DateInput
                  label="Start Date"
                  placeholder="Select start date"
                  size="md"
                  withAsterisk
                  rightSection={<IconCalendar size={16} />}
                  {...form.getInputProps('startDate')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <DateInput
                  label="End Date"
                  placeholder="Select end date"
                  size="md"
                  withAsterisk
                  rightSection={<IconCalendar size={16} />}
                  {...form.getInputProps('endDate')}
                />
              </Grid.Col>

              <Grid.Col span={12}>
                <JobRichTextField
                  label="About the Company"
                  initialContent={jobData?.aboutCompany ?? ''}
                  onChange={(html) => form.setFieldValue('aboutCompany', html)}
                  error={form.errors.aboutCompany as string | undefined}
                />
              </Grid.Col>

              <Grid.Col span={12}>
                <JobRichTextField
                  label="About the Job"
                  initialContent={jobData?.aboutJob ?? ''}
                  onChange={(html) => form.setFieldValue('aboutJob', html)}
                  error={form.errors.aboutJob as string | undefined}
                />
              </Grid.Col>

              <Grid.Col span={12}>
                <JobRichTextField
                  label="Job Description"
                  required
                  initialContent={jobData?.description ?? ''}
                  onChange={(html) => form.setFieldValue('description', html)}
                  error={form.errors.description as string | undefined}
                />
              </Grid.Col>
            </Grid>

            <Group mt="xl">
              <Button
                type="submit"
                size="md"
                color="dark"
                style={{ backgroundColor: '#1a365d' }}
                loading={form.submitting}
              >
                {isEdit ? 'Update Job' : 'Create Job'}
              </Button>
            </Group>
          </form>
        </Card>
      </div>
    </Container>
  );
}
