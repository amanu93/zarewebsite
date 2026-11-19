"use server";

type JobApplyFieldErrors = {
  userFile?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  email?: string;
  message?: string;
  jobId?: string;
};

function validateRequire(field: string | undefined | null) {
  return typeof field === "string" && field.trim().length !== 0;
}

function validateEmail(email: string) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function submitJobApply(formData: FormData): Promise<{
  success: boolean;
  errors?: JobApplyFieldErrors;
  message?: string;
  createdId?: string;
}> {
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const email = formData.get("email") as string;
  const phoneNumber = formData.get("phoneNumber") as string;
  const message = formData.get("message") as string;
  const jobId = formData.get("jobId") as string;

  const errors: JobApplyFieldErrors = {};

  if (!validateRequire(jobId)) errors.jobId = "Job identifier is missing";
  if (!validateRequire(firstName)) errors.firstName = "Name is Required";
  if (!validateRequire(lastName)) errors.lastName = "Name is Required";
  if (!validateRequire(phoneNumber)) errors.phoneNumber = "Phone is Required";
  if (!validateRequire(message)) errors.message = "Cover Letter is Required";
  if (!validateRequire(email)) errors.email = "Email is Required";
  else if (!validateEmail(email)) errors.email = "Invalid email address";

  if (Object.keys(errors).length > 0) {
    return { success: false, errors, message: "Validation failed" };
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    console.error("NEXT_PUBLIC_API_URL is not configured");
    return {
      success: false,
      message: "Server is misconfigured. Please try again later.",
    };
  }

  // Backend's CreateAppliedJobsDto does NOT accept a `resume` field — the
  // resume is attached as a separate S3 document keyed on this applied-job's
  // id. So we submit the applied-job first, then the client uploads the
  // resume with itemId = the returned appliedJob id.
  const payload = {
    jobId,
    fullName: `${firstName.trim()} ${lastName.trim()}`,
    email: email.trim(),
    phone: phoneNumber.trim(),
    coverLetter: message,
    status: "Pending",
  };

  try {
    const res = await fetch(`${apiUrl}/api/applied-jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("submitJobApply failed", res.status, text);
      return {
        success: false,
        message: "We couldn't submit your application. Please try again.",
      };
    }

    const data = await res.json().catch(() => null);
    let createdId: string | undefined;
    if (data && typeof data === "object") {
      const rec = data as Record<string, unknown>;
      for (const k of ["id", "appliedJobId", "applicationId"]) {
        const v = rec[k];
        if (typeof v === "string" && v.length > 0) {
          createdId = v;
          break;
        }
      }
    }

    return {
      success: true,
      createdId,
      message:
        "Thank you for applying! We have received your application and will get back to you shortly.",
    };
  } catch (err) {
    console.error("submitJobApply error", err);
    return {
      success: false,
      message: "Something went wrong. Please try again.",
    };
  }
}
