import { emailAvailable, env, googleEnabled, telegramEnabled } from '../../config/env.js';
import { route } from '../../lib/api.js';
import { limiter } from '../../lib/http.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { emailInput, loginInput, loginOtpInput, otpInput, registration, resetInput } from './auth.schema.js';
import { completeLogin, login, register, requestCode, resetPassword, verifyEmail } from './auth.service.js';
import { beginGoogle, finishGoogle } from './google.service.js';
import { cookie, logout, refresh, sendSession } from './session.service.js';

const authLimit = [limiter(40, 15 * 60_000)];
route({ method: 'get', path: '/auth/features', summary: 'Available sign-in and communication features' },
  () => ({ google: googleEnabled, email: emailAvailable, loginOtp: env.ENABLE_LOGIN_OTP,
    telegram: telegramEnabled }));

route({ method: 'post', path: '/auth/register', body: registration, middleware: authLimit,
  status: 202, summary: 'Accept registration and request email verification' }, register);
route({ method: 'post', path: '/auth/login', body: loginInput, middleware: authLimit,
  summary: 'Sign in or require a sign-in code' }, async (input, _req, res) => {
  const result = await login(input);
  return 'otpRequired' in result ? result : sendSession(res, result);
});
route({ method: 'post', path: '/auth/login/verify', body: loginOtpInput, middleware: authLimit,
  summary: 'Verify an optional sign-in code alongside the password' },
async (input, _req, res) => sendSession(res, await completeLogin(input)));
route({ method: 'post', path: '/auth/refresh', summary: 'Rotate the refresh cookie and return an access token' },
  async (_input, req, res) => sendSession(res, await refresh(req.cookies[cookie])));
route({ method: 'post', path: '/auth/logout', summary: 'Revoke the cookie session and clear the cookie' },
  (_input, req, res) => logout(req.cookies[cookie], res));
route({ method: 'get', path: '/auth/me', summary: 'Get current identity and grants', protected: true,
  middleware: [requireAuth] }, (_input, req) => currentUser(req));
route({ method: 'post', path: '/auth/verify-email', body: otpInput, middleware: authLimit,
  summary: 'Consume the email verification code' }, verifyEmail);
route({ method: 'post', path: '/auth/resend-verification', body: emailInput, middleware: authLimit,
  status: 202, summary: 'Request another verification code after the cooldown' },
({ email }) => requestCode(email, 'VERIFY_EMAIL'));
route({ method: 'post', path: '/auth/forgot-password', body: emailInput, middleware: authLimit,
  status: 202, summary: 'Request a password reset code with a generic response' },
({ email }) => requestCode(email, 'RESET_PASSWORD'));
route({ method: 'post', path: '/auth/reset-password', body: resetInput, middleware: authLimit,
  summary: 'Consume a reset code, change password and revoke sessions' }, resetPassword);
route({ method: 'get', path: '/auth/google', middleware: authLimit, redirect: true,
  summary: 'Begin Google OpenID Connect' }, (_input, _req, res) => beginGoogle(res));
route({ method: 'get', path: '/auth/google/callback', middleware: authLimit, redirect: true,
  summary: 'Validate Google callback state and create a session' }, (_input, req, res) => finishGoogle(req, res));

