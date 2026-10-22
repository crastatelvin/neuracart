import type { Request, RequestHandler } from 'express';
import { sendSuccess } from '../../utils/response';
import type {
  DeliveryLoginInput,
  ProfileInput,
  RefreshInput,
  SendOtpInput,
  VerifyOtpInput,
} from './auth.schemas';
import { authService } from './auth.service';

function requireUser(req: Request) {
  if (!req.user) {
    throw new Error('authenticate middleware did not attach a user');
  }
  return req.user;
}

export const sendOtp: RequestHandler = async (req, res, next) => {
  try {
    const { email } = req.body as SendOtpInput;
    const result = await authService.sendOtp(email);
    sendSuccess(
      res,
      result.devOtp ? { devOtp: result.devOtp } : null,
      'OTP sent to your email',
    );
  } catch (error) {
    next(error);
  }
};

export const verifyOtp: RequestHandler = async (req, res, next) => {
  try {
    const { email, code } = req.body as VerifyOtpInput;
    const result = await authService.verifyOtp(email, code);
    sendSuccess(res, result, 'Login successful');
  } catch (error) {
    next(error);
  }
};

export const sendAdminOtp: RequestHandler = async (req, res, next) => {
  try {
    const { email } = req.body as SendOtpInput;
    const result = await authService.sendAdminOtp(email);
    sendSuccess(
      res,
      result.devOtp ? { devOtp: result.devOtp } : null,
      'If this is an admin email, a code has been sent',
    );
  } catch (error) {
    next(error);
  }
};

export const verifyAdminOtp: RequestHandler = async (req, res, next) => {
  try {
    const { email, code } = req.body as VerifyOtpInput;
    const result = await authService.verifyOtp(email, code, 'ADMIN');
    sendSuccess(res, result, 'Login successful');
  } catch (error) {
    next(error);
  }
};

export const refresh: RequestHandler = async (req, res, next) => {
  try {
    const { refreshToken } = req.body as RefreshInput;
    const result = await authService.refresh(refreshToken);
    sendSuccess(res, result, 'Token refreshed');
  } catch (error) {
    next(error);
  }
};

export const logout: RequestHandler = async (req, res, next) => {
  try {
    const { refreshToken } = req.body as RefreshInput;
    await authService.logout(refreshToken);
    sendSuccess(res, null, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
};

export const logoutAll: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUser(req);
    await authService.logoutAll(user.id);
    sendSuccess(res, null, 'Logged out from all devices');
  } catch (error) {
    next(error);
  }
};

export const me: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUser(req);
    const result = await authService.me(user.id);
    sendSuccess(res, result, 'Profile fetched');
  } catch (error) {
    next(error);
  }
};

export const updateProfile: RequestHandler = async (req, res, next) => {
  try {
    const user = requireUser(req);
    const data = req.body as ProfileInput;
    const result = await authService.updateProfile(user.id, data);
    sendSuccess(res, result, 'Profile updated');
  } catch (error) {
    next(error);
  }
};

export const deliveryLogin: RequestHandler = async (req, res, next) => {
  try {
    const { email, password } = req.body as DeliveryLoginInput;
    const result = await authService.deliveryLogin(email, password);
    sendSuccess(res, result, 'Login successful');
  } catch (error) {
    next(error);
  }
};
