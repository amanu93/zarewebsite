"use client";
import { useAppSelector } from "@/store/hooks";
import { OTPChecker } from "./_components/otp-checker";
import { SubmitEmail } from "./_components/submit-email";
import { RestPassword } from "./_components/reset-password";

export default function    ForgotPassword() {
  const step =  useAppSelector((state) => state.resetPassword.step);
  switch (step) {
    case 'sendEmailOTP':
      return   <SubmitEmail/>;
    case 'verifyOtp':
      return  <OTPChecker />;
    case 'resetPassword':
      return <RestPassword />;
  }
}
