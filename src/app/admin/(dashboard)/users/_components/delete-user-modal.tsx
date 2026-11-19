'use client';

import { Button, Group, Modal, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useDeleteUserMutation, type User } from '@/store/api/users.api';
import { userFullName } from './users-table';

export function DeleteUserModal({
  user,
  onClose,
}: {
  user: User | null;
  onClose: () => void;
}) {
  const [deleteUser, { isLoading }] = useDeleteUserMutation();

  const handleConfirm = async () => {
    if (!user) return;
    try {
      await deleteUser({ id: user.id }).unwrap();
      notifications.show({
        color: 'teal',
        title: 'User removed',
        message: `${userFullName(user)} has been deleted.`,
      });
      onClose();
    } catch (err) {
      console.error('Failed to delete user', err);
      notifications.show({
        color: 'red',
        title: 'Delete failed',
        message: 'Could not remove the user. Please try again.',
      });
    }
  };

  return (
    <Modal
      opened={user !== null}
      onClose={onClose}
      title="Delete user"
      centered
      size="sm"
    >
      {user && (
        <>
          <Text size="sm" mb="md">
            Are you sure you want to delete{' '}
            <strong>{userFullName(user)}</strong>? This action cannot be
            undone.
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
