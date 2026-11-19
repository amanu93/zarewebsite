"use client";

import {
  Button,
  Flex,
  PasswordInput,
  Stack,
  Title,
  Text,
} from "@mantine/core";
import { useForm } from "react-hook-form";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { notifications } from "@mantine/notifications";
import { useDispatch } from "react-redux";
import { goToEmailStep, goToSuccessStep } from "@/store/api/auth/resetPasswordSlice";
import { useAppSelector } from "@/store/hooks";
import { IconCornerUpLeft } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useResetpasswordUpdateMutation } from "@/store/api/auth/auth.api";


const passwordRequirements =
  "Password must contain at least 1 special character, 1 uppercase letter, 1 lowercase letter, and a number.";

const schema = z
  .object({
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .regex(/(?=.*[a-z])/, passwordRequirements)
      .regex(/(?=.*[A-Z])/, passwordRequirements)
      .regex(/(?=.*\d)/, passwordRequirements)
      .regex(/(?=.*[!@#$%^&*(),.?":{}|<>])/,
        passwordRequirements),

    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormSchema = z.infer<typeof schema>;

export function RestPassword() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormSchema>({ resolver: zodResolver(schema) });
  const router = useRouter();
  const dispatch = useDispatch();
  const [resetpassword, { isLoading: isEmailSubmited }] =
    useResetpasswordUpdateMutation();

  const email = useAppSelector((state) => state.resetPassword.email);
  const otp = useAppSelector((state) => state.resetPassword.otp);

  const onSubmit = async (data: FormSchema) => {
    try {
      if (!email || !otp) {
        dispatch(goToEmailStep());
        return;
      }

      await resetpassword({
        email,
        confirmPassword: data.password,
        otp
      }).unwrap();


      notifications.show({
        title: "Success",
        message: "Password reset successfully.",
        color: "green",
      });
      router.push("/admin/login");
      dispatch(goToSuccessStep());
    } catch {
      notifications.show({
        title: "Error",
        message: "Unsuccessful reset password, please try again.",
        color: "red",
      });
    }
  };

  const onBack = () => {
    dispatch(goToEmailStep());
  }

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
   
          <Flex className="items-center justify-center mx-auto w-[65%]">
            <Stack className="items-center h-auto w-full px-4">
              <div>
                <Title order={1} fw={400} c="#0a293b" fz={36} mb="xs">
                  New Password
                </Title>
                <Text c="#828282" fz="md">
                  Set the new password for your account so you can login and access
                  all features.
                </Text>
              </div>


              <Stack className="w-full">
                <PasswordInput
                  label="New Password"
                  {...register("password")}
                  error={errors.password?.message}

                          styles={{
                  root: { marginTop: 8, marginBottom: 24 },
                  label: {
                    color: '#0a293b',
                    fontSize: '16px',
                    fontWeight: 400,
                    marginBottom: 8,
                  },
                  input: {
                    backgroundColor: '#fafafa',
                    borderColor: '#eaeaea',
                    color: '#828282',
                    height: 48,
                    fontSize: '16px',
                    '&::placeholder': {
                      color: '#828282',
                    },
                  },
                  innerInput: {
                    height: 46,
                    fontSize: '16px',
                  },
                  visibilityToggle: {
                    color: '#828282',
                  },
                }}
                />

                <PasswordInput
                  label="Confirm Password"
                  {...register("confirmPassword")}
                  error={errors.confirmPassword?.message}
                          styles={{
                  root: { marginTop: 8, marginBottom: 24 },
                  label: {
                    color: '#0a293b',
                    fontSize: '16px',
                    fontWeight: 400,
                    marginBottom: 8,
                  },
                  input: {
                    backgroundColor: '#fafafa',
                    borderColor: '#eaeaea',
                    color: '#828282',
                    height: 48,
                    fontSize: '16px',
                    '&::placeholder': {
                      color: '#828282',
                    },
                  },
                  innerInput: {
                    height: 46,
                    fontSize: '16px',
                  },
                  visibilityToggle: {
                    color: '#828282',
                  },
                }}
                />
              </Stack>

              <Button
                  type="submit"
                fullWidth
                styles={{
                  root: {
                    backgroundColor: '#0a293b',
                    height: 48,
                    fontSize: '16px',
                    fontWeight: 500,
                    letterSpacing: '0.5px',
                    '&:hover': {
                      backgroundColor: 'rgba(10, 41, 59, 0.9)',
                    },
                  },
                }}
                loading={isEmailSubmited}
              >
                Confirm
              </Button>
            </Stack>
          </Flex>
      
      </form>
      </Flex>
    </>
  );
}
