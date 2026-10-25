import { betterAuth } from 'better-auth';
import { admin } from 'better-auth/plugins';
import type { Pool } from 'pg';
import type { readAccessConfig } from './config.js';

export function authOptions(
  pool: Pool,
  config: NonNullable<ReturnType<typeof readAccessConfig>>,
) {
  return {
    database: pool,
    baseURL: config.origin,
    basePath: '/api/auth',
    secret: config.secret,
    trustedOrigins: [config.origin],
    logger: { disabled: true },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    user: {
      modelName: 'auth_user',
      additionalFields: {
        mustChangePassword: {
          type: 'boolean' as const,
          required: true,
          defaultValue: true,
          input: false,
        },
      },
    },
    session: {
      modelName: 'auth_session',
      expiresIn: 28800,
      updateAge: 3600,
      cookieCache: { enabled: false },
    },
    account: { modelName: 'auth_account' },
    verification: { modelName: 'auth_verification' },
    advanced: {
      useSecureCookies: config.context === 'preview',
      cookiePrefix: config.cookiePrefix,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
      },
    },
    plugins: [admin()],
  };
}

export function createAccessAuth(
  pool: Pool,
  config: NonNullable<ReturnType<typeof readAccessConfig>>,
) {
  return betterAuth(authOptions(pool, config));
}
