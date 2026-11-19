"use client";
import {
  Button,
  Flex,
  Stack,
  Title,
  Text,
} from "@mantine/core";
import React, { useState, useEffect } from "react";
import OtpInput from "react-otp-input";
import { useForm } from "react-hook-form";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useResetpasswordEmailMutation,
  useResetpasswordVerifyMutation,
} from "@/store/api/auth/auth.api";
import { notifications } from "@mantine/notifications";
import { useAppSelector } from "@/store/hooks";
import { useDispatch } from "react-redux";
import {
  goToEmailStep,
  goToResetPasswordStep,
} from "@/store/api/auth/resetPasswordSlice";
import { IconCornerUpLeft } from "@tabler/icons-react";

const schema = z.object({
  otp: z
    .string()
    .min(6, "OTP must be 6 digits")
    .max(6, "OTP must be no more than 6 digits"),
});

type FormSchema = z.infer<typeof schema>;

export function OTPChecker() {
  const {
    handleSubmit,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<FormSchema>({
    resolver: zodResolver(schema),
    defaultValues: { otp: "" },
  });

  const [verifyResetpasswordOTP, { isLoading: isOTPSubmited }] =
    useResetpasswordVerifyMutation();
  const [resetpasswordEmail] =
    useResetpasswordEmailMutation();

  const dispatch = useDispatch();
  const email = useAppSelector((state) => state.resetPassword.email);

  const [otp, setOtp] = useState("");
  const [counter, setCounter] = useState(600);
  const [resendCount, setResendCount] = useState(0);
  const maxResends = 3;

  // Names the expired state: it locks the OTP inputs and the Verify button.
  const canResend = counter <= 0;

  useEffect(() => {
    if (counter <= 0) return;
    const timer = setTimeout(() => {
      const next = counter - 1;
      setCounter(next);
      // Expiring grants a fresh batch of resends.
      if (next <= 0) setResendCount(0);
    }, 1000);
    return () => clearTimeout(timer);
  }, [counter]);

  const handleResend = async () => {
    if (resendCount >= maxResends  ) {
      notifications.show({
        title: "Limit Reached",
        message: "You have reached the maximum number of OTP resends.",
        color: "red",
      });
      return;
    }

    try {
      if (!email) return;
      await resetpasswordEmail({ email }).unwrap();
      setCounter(600);
      setResendCount((prev) => prev + 1);

      notifications.show({
        title: "OTP Sent",
        message: "A new OTP has been sent to your email.",
        color: "green",
      });
    } catch {
      notifications.show({
        title: "Error",
        message: "Failed to resend OTP. Please try again.",
        color: "red",
      });
    }
  };

  const onSubmit = async () => {
    const isValid = await trigger("otp");
    if (!isValid) return;

    try {
      if (!email) {
        notifications.show({
          title: "Missing Email",
          message: "Email is required to verify OTP.",
          color: "red",
        });
        dispatch(goToEmailStep());
        return;
      }

      const res = await verifyResetpasswordOTP({ email, otp }).unwrap();
      if (res.isValid) {
        dispatch(goToResetPasswordStep(otp));
      } else {
        notifications.show({
          title: "Error",
          message: "OTP Not Valid",
          color: "red",
        });
      }
    } catch {
      notifications.show({
        title: "Error",
        message: "OTP Not Valid",
        color: "red",
      });
    }
  };

  const onBack = () => {
    dispatch(goToEmailStep());
  };

  return (
    <>  
      <Flex
      gap={8}
      align="center"
      className="w-fit cursor-pointer px-3 py-2 hover:bg-gray-100 rounded-xl transition"
      onClick={onBack}
    >
      <IconCornerUpLeft size={20} className="text-gray-600" />
      <Title className="font-semibold text-lg text-gray-700" order={4}>
        Back
      </Title>
    </Flex>
     <Flex className="w-full h-[calc(100vh-80px)] items-center justify-center">
    <form onSubmit={handleSubmit(onSubmit)}>
    
   

    

        <Flex className=" justify-center mx-auto w-[65%]">
          <Stack className="items-center h-auto">
            <Text
                 size="48px"
                 fw={400}
                 c="#1e3a5f"
                 style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
               >
                 Verification
               </Text>
                  <Text size="lg" c="#9ca3af"  >
           
             Enter your 4 digits code that you received on your email.
            </Text>

            <OtpInput
              value={otp}
              onChange={(value) => {
                setOtp(value);
                setValue("otp", value);
              }}
              numInputs={6}
              shouldAutoFocus
              inputStyle={{
                width: "5.625rem",
                height: "4.375rem",
                margin: "0 .6rem",
                fontSize: "1.5rem",
                textAlign: "center",
                border: "1px solid #2E2E2E40",
              }}
              renderInput={(props, index) => (
                <input
                  {...props}
                  key={index}
                  value={props.value && props.value !== "" ? props.value : "-"}
                  disabled={canResend}
                  style={{
                    ...props.style,
                    color:
                      props.value && props.value !== "" ? "inherit" : "#aaa",
                    backgroundColor: canResend ? "#f9f9f9" : "white",
                  }}
                />
              )}
            />

            {errors.otp && (
              <Text className="text-red-500 text-sm">{errors.otp.message}</Text>
            )}

            <span className="font-bold text-red-400 text-center ">
              {String(Math.floor(counter / 60)).padStart(2, "0")}:
              {String(counter % 60).padStart(2, "0")}
            </span>

            <Button
              type="submit"
                  size="xl"
          fullWidth
          style={{
            backgroundColor: '#1e3a5f',
            color: 'white',
            height: 60,
            fontSize: '18px',
            fontWeight: 500,
            letterSpacing: '1px',
            border: 'none',
            borderRadius: 8,
            '&:hover': {
              backgroundColor: '#2d4a6b',
            },
          }}
              loading={isOTPSubmited}
              disabled={canResend}
            >
              Verify
            </Button>

            <p className="text-[#1E1E1EBF] text-center text-md mt-1 ">
              If you didn&apos;t receive the code!{" "}
              <span
                onClick={handleResend}
                className={`${
                  (resendCount >= maxResends  )
                    ? "text-gray-400 cursor-not-allowed"
                    : "text-red-500 hover:cursor-pointer"
                } font-bold`}
              >
                Resend
              </span>
            </p>
          </Stack>
        </Flex>
  
    </form>
        </Flex>
    </>
  );
}
