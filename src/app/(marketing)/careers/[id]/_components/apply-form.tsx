"use client";

import React, { useState } from "react";
import { Button, Flex, TextInput, Textarea, Group, Text } from "@mantine/core";
import { IconUpload, IconX } from "@tabler/icons-react";
import { Dropzone, DropzoneProps, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import Image from "next/image";
import { notifications } from "@mantine/notifications";
import { useParams } from "next/navigation";
import { submitJobApply } from "@/actions/job-apply";
import { uploadFileViaS3 } from "@/lib/s3";

export function FileDropZone({
  onDropFile,
  error,
  file,
  ...props
}: Partial<DropzoneProps> & {
  onDropFile?: (file: File) => void;
  error?: string;
  file?: File | null;
}) {
  const [rejectError, setRejectError] = useState<string | null>(null);

  return (
    <Dropzone
      onDrop={(files) => {
        if (files && files.length > 0 && onDropFile) onDropFile(files[0]);
      }}
      onReject={() => {
        setRejectError("File type or size not accepted. Try again ..");
      }}
      maxSize={50 * 1024 * 1024}
      accept={["application/pdf", ...IMAGE_MIME_TYPE]}
      {...props}
      className="border border-cyan-500 rounded-md cursor-pointer transition-all duration-300 hover:border-cyan-500"
      style={{ borderStyle: "dashed" }}
    >
      <Group
        justify="center"
        gap="sm"
        mih={200}
        style={{ pointerEvents: "none" }}
        className="flex flex-col"
      >
        <Dropzone.Accept>
          <IconUpload
            size={52}
            color="var(--mantine-color-blue-6)"
            stroke={1.5}
          />
        </Dropzone.Accept>
        <Dropzone.Reject>
          <IconX size={52} color="var(--mantine-color-red-6)" stroke={1.5} />
        </Dropzone.Reject>
        <Dropzone.Idle>
          <Image
            src={"/careers/img-icons.svg"}
            alt="files"
            height={60}
            width={60}
          />
        </Dropzone.Idle>
        <div className="flex flex-col gap-1 items-center text-center">
          <Text size="md" className="font-medium" inline>
            Drop your files here or{" "}
            <span className="text-cyan-500">Browse</span>
          </Text>
          <Text size="sm" c="dimmed" inline mt={7}>
            Optional · PDF/image · Maximum size: 50MB
          </Text>
          {file && (
            <Text size="sm" c="cyan.7" className="mt-2">
              {file.name}
            </Text>
          )}
          {rejectError && (
            <Text size="sm" c="cyan.7" className="mt-2 text-red-500">
              {rejectError}
            </Text>
          )}
          {error && <span className="text-red-400 text-sm">{error}</span>}
        </div>
      </Group>
    </Dropzone>
  );
}

export default function ApplyForm() {
  const params = useParams<{ id: string }>();
  const jobId = params?.id ?? "";

  // Local form state
  const [formData, setFormData] = useState<{
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    message: string;
    userFile: File | null;
  }>({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    message: "",
    userFile: null
  });

  const [formErrors, setFormErrors] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
    phoneNumber?: string;
    message?: string;
    userFile?: string;
  }>({});

  const [loading, setLoading] = useState(false);

  // Handle field changes for text inputs/textareas
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
    setFormErrors((prev) => ({
      ...prev,
      [name]: ""
    }));
  };

  // Handle file drop
  const handleDropFile = (file: File) => {
    setFormData((prev) => ({
      ...prev,
      userFile: file
    }));
    setFormErrors((prev) => ({
      ...prev,
      userFile: ""
    }));
  };

  // Minimal email validation
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: typeof formErrors = {};
    if (!formData.firstName.trim()) errors.firstName = "Name is Required";
    if (!formData.lastName.trim()) errors.lastName = "Name is Required";
    if (!formData.phoneNumber.trim()) errors.phoneNumber = "Phone is Required";
    if (!formData.message.trim()) errors.message = "Message is Required";
    if (!formData.email.trim()) errors.email = "Email is Required";
    else if (!validateEmail(formData.email))
      errors.email = "Invalid email address";

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setLoading(true);
    setFormErrors({});

    const submitData = new FormData();
    submitData.append("jobId", jobId);
    submitData.append("firstName", formData.firstName);
    submitData.append("lastName", formData.lastName);
    submitData.append("email", formData.email);
    submitData.append("phoneNumber", formData.phoneNumber);
    submitData.append("message", formData.message);

    // 1. Submit the applied-job first (backend's DTO does not accept a
    //    resume field; it comes back with the new applied-job id).
    const result = await submitJobApply(submitData);

    if (!result.success) {
      if (result.errors) setFormErrors(result.errors);
      notifications.show({
        color: "red",
        title: "Error",
        message: result.message ?? "Something went wrong. Please try again."
      });
      setLoading(false);
      return;
    }

    // 2. If the applicant attached a resume, upload it now with itemId set
    //    to the newly-created applied-job's id — so the admin can list it via
    //    GET /api/s3/documents/resume/resume/{appliedJobId}.
    if (formData.userFile && result.createdId) {
      try {
        await uploadFileViaS3(formData.userFile, {
          type: "resume",
          itemId: result.createdId,
        });
      } catch (err) {
        console.warn("Resume upload failed after application submit", err);
        notifications.show({
          color: "yellow",
          title: "Resume upload failed",
          message:
            "Your application was submitted but the resume didn't upload. Please email it separately.",
        });
      }
    }

    notifications.show({
      title: "Success",
      message:
        result.message ??
        "Thank you for applying! We have received your application and will get back to you shortly.",
      color: "teal"
    });
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      message: "",
      userFile: null
    });
    setLoading(false);
  };

  return (
    <div
      className="flex flex-col items-center gap-12 p-5 sm:p-8 md:px-16 bg-[#F5F7FB] mb-16"
      id="apply-now"
    >
      <div className="flex flex-col text-center items-center gap-0.5">
        <h3 className="z-10 text-[26px] min-[501px]:text-[32px] font-medium uppercase">
          APPLY NOW
        </h3>
        <p className="text-[#6C6C6C] text-sm">
          Send your application information and we will get back to you as soon
          as possible
        </p>
      </div>
      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-10">
        <Flex className="w-full flex-col gap-7 ">
          <Flex className="flex gap-7 flex-col md:flex-row">
            <div className="w-full flex flex-col gap-2">
              <TextInput
                onChange={handleChange}
                name="firstName"
                label="First Name"
                value={formData.firstName}
                placeholder="Enter first name"
                styles={{
                  label: { fontWeight: "normal", marginBottom: "5px" }
                }}
                error={!!formErrors.firstName}
              />
              {formErrors?.firstName && (
                <span className="text-red-400 text-sm">
                  {formErrors.firstName}
                </span>
              )}
            </div>
            <div className="w-full flex flex-col gap-2">
              <TextInput
                onChange={handleChange}
                value={formData.lastName}
                name="lastName"
                label="Last Name"
                placeholder="Enter last name"
                styles={{
                  label: { fontWeight: "normal", marginBottom: "5px" }
                }}
                error={!!formErrors.lastName}
              />
              {formErrors?.lastName && (
                <span className="text-red-400 text-sm">
                  {formErrors.lastName}
                </span>
              )}
            </div>
          </Flex>
          <Flex className="flex flex-col md:flex-row gap-7">
            <div className="w-full flex flex-col gap-2">
              <TextInput
                onChange={handleChange}
                value={formData.email}
                name="email"
                label="Email"
                placeholder="Enter email"
                styles={{
                  label: { fontWeight: "normal", marginBottom: "5px" }
                }}
                error={!!formErrors.email}
              />
              {formErrors?.email && (
                <span className="text-red-400 text-sm">{formErrors.email}</span>
              )}
            </div>
            <div className="w-full flex flex-col gap-2">
              <TextInput
                onChange={handleChange}
                value={formData.phoneNumber}
                name="phoneNumber"
                label="Phone Number"
                placeholder="Enter Phone Number"
                styles={{
                  label: { fontWeight: "normal", marginBottom: "5px" }
                }}
                error={!!formErrors.phoneNumber}
              />
              {formErrors?.phoneNumber && (
                <span className="text-red-400 text-sm">
                  {formErrors.phoneNumber}
                </span>
              )}
            </div>
          </Flex>
          <div className="w-full flex flex-col gap-2">
            <Textarea
              onChange={handleChange}
              value={formData.message}
              name="message"
              label="Cover Letter"
              placeholder="Write down you cover letter here"
              minRows={4}
              autosize
              styles={{
                label: { fontWeight: "normal", marginBottom: "5px" },
                input: { resize: "vertical" }
              }}
              error={!!formErrors.message}
            />
            {formErrors?.message && (
              <span className="text-red-400 text-sm">{formErrors.message}</span>
            )}
          </div>
          <FileDropZone
            onDropFile={handleDropFile}
            error={formErrors.userFile}
            file={formData.userFile}
          />
          <Button
            size="md"
            className="min-[501px]:self-center transition-all duration-300 hover:bg-cyan-500"
            type="submit"
            loading={loading}
            disabled={loading}
          >
            Apply Now
          </Button>
        </Flex>
      </form>
    </div>
  );
}
