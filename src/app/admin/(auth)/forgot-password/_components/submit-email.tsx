"use client";
import {
  Button,
  Flex,
  Text,
  Stack,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "react-hook-form";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";;
import { notifications } from "@mantine/notifications";
import { useDispatch } from 'react-redux';
import { goToVerifyOtpStep } from "@/store/api/auth/resetPasswordSlice";
import { IconCornerUpLeft } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useResetpasswordEmailMutation } from "@/store/api/auth/auth.api";


const schema = z
  .object({
    email: z.string().email("Please enter a valid email")
  })
  .required();

type FormSchema = z.infer<typeof schema>;

export function SubmitEmail() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormSchema>({ resolver: zodResolver(schema) });
  const dispatch = useDispatch();
  const [resetpasswordEmail, { isLoading: isEmailSubmited }] = useResetpasswordEmailMutation();

  const router = useRouter();

  const onSubmit = async (data: FormSchema) => {
    try {
      await resetpasswordEmail(data).unwrap();
      dispatch(goToVerifyOtpStep(data.email));
    } catch {
      notifications.show({
        title: "Error",
        message: "Invalid email address. Please try again.",
        color: "red",
      });
    }
  };

  const onBack = () => {
    router.push("/admin/login");
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
            <Stack className="items-center h-auto">
              <Title
                order={1}
                style={{
                  fontSize: '36px',
                  fontWeight: 400,
                  color: '#0a293b',
                  lineHeight: 1.2,
                  margin: 0,
                }}
              >
                Forgot password
              </Title>

              <Text
                style={{
                  color: '#828282',
                  fontSize: '16px',
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                Enter your email for the verification proccess,we will send 4
                digits code to your email.
              </Text>
              <Stack className="w-full">



                <TextInput
                  label="E mail"
                  {...register("email")}
                  error={errors?.email?.message}
                  size="lg"
                  styles={{
                    label: {
                      color: '#0a293b',
                      fontSize: '16px',
                      fontWeight: 400,
                      marginBottom: '12px',
                    },
                    input: {
                      height: '56px',
                      fontSize: '16px',
                      borderColor: '#9badca',
                      borderRadius: '8px',
                      '&:focus': {
                        borderColor: '#0a293b',
                      },
                    },
                  }}
                />

              </Stack>




              <Button
                loading={isEmailSubmited}
                size="lg"
                fullWidth
                type="submit"
                style={{
                  height: '56px',
                  backgroundColor: '#0a293b',
                  fontSize: '16px',
                  fontWeight: 500,
                  borderRadius: '8px',
                  border: 'none',
                }}
                styles={{
                  root: {
                    '&:hover': {
                      backgroundColor: '#001a72',
                    },
                  },
                }}
              >
                CONTINUE
              </Button>

            </Stack>


          </Flex>

        </form>
      </Flex>
    </>
  );
}
