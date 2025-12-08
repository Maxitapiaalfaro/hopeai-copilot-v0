# Auth0 OAuth Setup Guide for Aurora

## Overview

Aurora uses **Auth0** for OAuth authentication in both development and production environments. Auth0 handles Google, GitHub, and other social login providers through a single integration.

## Required Environment Variables

Based on your Vercel configuration, these variables are needed:

```env
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000           # Dev: localhost, Prod: your domain
NEXTAUTH_SECRET=your-secure-secret-key       # Generate with: openssl rand -base64 32

# Auth0 Configuration (from Vercel)
AUTH0_CLIENT_ID=JQW6yBiI3PTNwolF1AELB8JSbf1rLrCU
AUTH0_SECRET=your-auth0-secret
AUTH0_ISSUER_BASE_URL=https://auroraai.us.auth0.com/
AUTH0_BASE_URL=https://hopeai-copilot-v0.vercel.app/
AUTH0_DOMAIN=auroraai.us.auth0.com

# MongoDB (already configured)
MONGODB_URI=mongodb+srv://...
MONGODB_DB_NAME=aurora
```

## Auth0 Dashboard Setup

### 1. Configure Application

1. Go to [Auth0 Dashboard](https://manage.auth0.com/)
2. Navigate to **Applications** → **Applications**
3. Select your application or create new **Regular Web Application**
4. In **Settings** tab, configure:

   **Allowed Callback URLs**:
   ```
   http://localhost:3000/api/auth/callback/auth0,
   https://hopeai-copilot-v0.vercel.app/api/auth/callback/auth0
   ```

   **Allowed Logout URLs**:
   ```
   http://localhost:3000,
   https://hopeai-copilot-v0.vercel.app
   ```

   **Allowed Web Origins**:
   ```
   http://localhost:3000,
   https://hopeai-copilot-v0.vercel.app
   ```

### 2. Enable Social Connections

1. Navigate to **Authentication** → **Social**
2. Enable **Google** connection
3. Configure with your Google OAuth credentials (or use Auth0's dev keys for testing)

## MongoDB Sync

Auth0 users are automatically synced to MongoDB:

1. **NextAuth Adapter**: Creates entries in `users`, `accounts`, `sessions` collections
2. **Custom Sync**: The `signIn` callback creates/updates entries in the custom `users` collection with:
   - `userId`: Unique user identifier
   - `email`: User's email (lowercase)
   - `name`: Display name from profile
   - `role`: Default `psychologist`
   - `oauthProvider`: `auth0`
   - `oauthId`: Auth0 account ID
   - `avatar`: Profile picture URL
   - `preferences`: Default clinical preferences

## Local Development Setup

1. Copy Auth0 variables to `.env.local`:
   ```env
   AUTH0_CLIENT_ID=JQW6yBiI3PTNwolF1AELB8JSbf1rLrCU
   AUTH0_SECRET=your-secret-from-auth0
   AUTH0_ISSUER_BASE_URL=https://auroraai.us.auth0.com/
   AUTH0_BASE_URL=http://localhost:3000
   ```

2. Add `http://localhost:3000/api/auth/callback/auth0` to Auth0 Allowed Callback URLs

3. Run `npm run dev`

4. Click "Continuar con Google" button in login modal

5. Verify user created in MongoDB `users` collection

## Vercel Production (Already Configured)

Your Vercel environment has these variables set:
- `AUTH0_CLIENT_ID`
- `AUTH0_SECRET`
- `AUTH0_ISSUER_BASE_URL`
- `AUTH0_BASE_URL`
- `AUTH0_DOMAIN`
- `APP_BASE_URL`

## Troubleshooting

### "OAuth provider not available"

- Verify `AUTH0_CLIENT_ID`, `AUTH0_SECRET`, and `AUTH0_ISSUER_BASE_URL` are all set
- Restart dev server after adding environment variables

### "Callback URL mismatch"

- Add exact callback URL to Auth0 dashboard:
  - Dev: `http://localhost:3000/api/auth/callback/auth0`
  - Prod: `https://hopeai-copilot-v0.vercel.app/api/auth/callback/auth0`

### "User not synced to MongoDB"

- Check MongoDB connection
- Review server logs for sync errors
- Verify `databaseService.initialize()` succeeds

### "Session not persisting"

- Ensure `NEXTAUTH_SECRET` is set
- Check `SessionProvider` wraps the app

## Security Notes

- Never commit secrets to version control
- Auth0 handles OAuth token security
- Users get `psychologist` role by default
- Rotate `NEXTAUTH_SECRET` if compromised
