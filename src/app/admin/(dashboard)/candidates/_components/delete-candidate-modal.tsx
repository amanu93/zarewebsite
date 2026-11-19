'use client';

import { Button, Group, Modal, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  useDeleteCandidateMutation,
  type Candidate,
} from '@/store/api/candidates.api';

export function DeleteCandidateModal({
  candidate,
  onClose,
}: {
  candidate: Candidate | null;
  onClose: () => void;
}) {
  const [deleteCandidate, { isLoading }] = useDeleteCandidateMutation();

  const handleConfirm = async () => {
    if (!candidate) return;
    try {
      await deleteCandidate({ id: candidate.id }).unwrap();
      notifications.show({
        color: 'teal',
        title: 'Candidate removed',
        message: `${candidate.fullName} has been deleted.`,
      });
      onClose();
    } catch (err) {
      console.error('Failed to delete candidate', err);
      notifications.show({
        color: 'red',
        title: 'Delete failed',
        message: 'Could not remove the candidate. Please try again.',
      });
    }
  };

  return (
    <Modal
      opened={candidate !== null}
      onClose={onClose}
      title="Delete candidate"
      centered
      size="sm"
    >
      {candidate && (
        <>
          <Text size="sm" mb="md">
            Are you sure you want to delete{' '}
            <strong>{candidate.fullName}</strong>? This action cannot be undone.
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
