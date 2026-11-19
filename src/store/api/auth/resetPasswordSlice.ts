import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface ForgotPasswordState {
  step: 'sendEmailOTP' | 'verifyOtp' | 'resetPassword' | 'success';
  email?: string;
  otp?: string;
}

const initialState: ForgotPasswordState = {
    step: 'sendEmailOTP', 
    email: undefined,
    otp: undefined,
};

const resetPasswordSlice = createSlice({
    name: 'resetPassword', 
    initialState,
    reducers: {
        goToEmailStep(state) {
            state.step = 'sendEmailOTP';
            state.email = undefined;
        },
        goToVerifyOtpStep(state, action: PayloadAction<string>) {
            state.step = 'verifyOtp';
            state.email = action.payload;
        },
        goToResetPasswordStep(state, action: PayloadAction<string>) {
            state.step = 'resetPassword';
            state.otp = action.payload;
        },
        goToSuccessStep() {
            return initialState;
        },
    },
});

export const {
  goToEmailStep,
  goToVerifyOtpStep,
  goToResetPasswordStep,
  goToSuccessStep,
  
} = resetPasswordSlice.actions;

export const  resetPasswordReducer=resetPasswordSlice.reducer;
