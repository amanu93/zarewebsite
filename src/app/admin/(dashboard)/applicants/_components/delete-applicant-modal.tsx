'use client';

import { Button, Group, Modal, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  useDeleteAppliedJobMutation,
  type AppliedJob,
} from '@/store/api/applied-jobs.api';

export function DeleteApplicantModal({
  applicant,
  onClose,
}: {
  applicant: AppliedJob | null;
  onClose: () => void;
}) {
  const [deleteAppliedJob, { isLoading }] = useDeleteAppliedJobMutation();

  const handleConfirm = async () => {
    if (!applicant) return;
    try {
      await deleteAppliedJob({ id: applicant.id }).unwrap();
      notifications.show({
        color: 'teal',
        title: 'Application removed',
        message: `${applicant.fullName}'s application has been deleted.`,
      });
      onClose();
    } catch (err) {
      console.error('Failed to delete applicant', err);
      notifications.show({
        color: 'red',
        title: 'Delete failed',
        message: 'Could not remove the application. Please try again.',
      });
    }
  };

  return (
    <Modal
      opened={applicant !== null}
      onClose={onClose}
      title="Delete application"
      centered
      size="sm"
    >
      {applicant && (
        <>
          <Text size="sm" mb="md">
            Are you sure you want to delete{' '}
            <strong>{applicant.fullName}</strong>&apos;s application? This
            action cannot be undone.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button color="red" onClick={handleConfirm} loading={isLoading}>
              Delete
            </Button>
          </Group>
        </>
      )}
    </Modal>
  );
}
