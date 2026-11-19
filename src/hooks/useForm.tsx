'use client';

import { notifications } from '@mantine/notifications';
import React, { useState } from 'react';

export default function useContactForm() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    message: '',
  });

  const [errors, setErrors] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
    message: '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prevFormData) => ({ ...prevFormData, [name]: value }));
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  const validateRequire = (field: string) => {
    return field.trim().length !== 0;
  };

  const handleSendEmail = async () => {
    if (
      !validateEmail(formData.email) ||
      !validateRequire(formData.phoneNumber) ||
      !validateRequire(formData.firstName) ||
      !validateRequire(formData.lastName) ||
      !validateRequire(formData.message)
    ) {
      setErrors({
        email: !validateRequire(formData.email)
          ? 'Email is Required'
          : !validateEmail(formData.email)
            ? 'Invalid email address'
            : '',
        firstName: !validateRequire(formData.firstName)
          ? 'Name is Required'
          : '',
        lastName: !validateRequire(formData.lastName) ? 'Name is Required' : '',
        phoneNumber: !validateRequire(formData.phoneNumber)
          ? 'Phone is Required'
          : '',
        message: !validateRequire(formData.message)
          ? 'Message is Required'
          : '',
      });
      return;
    } else {
      setErrors((prevErrors) => ({ ...prevErrors, email: '' }));
    }

    try {
      setLoading(true);
      const result = await fetch('/api/send', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.firstName + ' ' + formData.lastName,
          email: formData.email,
          phoneNumber: formData.phoneNumber,
          message: formData.message,
        }),
      });

      if (!result.ok) {
        throw new Error('Failed to send email');
      }

      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phoneNumber: '',
        message: '',
      });
      setErrors({
        email: '',
        firstName: '',
        lastName: '',
        phoneNumber: '',
        message: '',
      });

      notifications.show({
        title: 'Success',
        message:
          'Thank you for reaching out to us! We have received your inquiry and will get back to you shortly.',
      });
    } catch {
      setLoading(false);
      notifications.show({
        color: 'red',
        title: 'Error',
        message: 'Something went wrong. Please try again',
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    formErrors: errors,
    formData,
    loading,
    handleChange,
    handleSendEmail,
  };
}
