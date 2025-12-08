import { MongoDBAdapter } from '@auth/mongodb-adapter';
import { MongoClient } from 'mongodb';
import CredentialsProvider from 'next-auth/providers/credentials';
import Auth0Provider from 'next-auth/providers/auth0';
import bcrypt from 'bcryptjs';
import { databaseService } from '@/lib/database';
import { deviceTrustService } from '@/lib/security/device-trust';

const uri = process.env.MONGODB_URI || process.env.MONGOAURORA_MONGODB_URI || process.env.MONGODB_MONGOAURORA_DIRECT_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB_NAME || 'aurora';

// Prepare a reusable MongoClient instance, but DO NOT connect at import time.
// Connecting during module load can break builds when DNS/env are not ready.
declare global {
  // eslint-disable-next-line no-var
  var _mongoClient: MongoClient | undefined;
}

const authMaxPoolSize = Number(process.env.MONGODB_MAX_POOL_SIZE || 10);
const authMinPoolSize = Number(process.env.MONGODB_MIN_POOL_SIZE || 2);
const authMaxIdleTimeMS = Number(process.env.MONGODB_MAX_IDLE_TIME_MS || 0);
const authRetryWrites = String(process.env.MONGODB_RETRY_WRITES || 'true').toLowerCase() === 'true';
const authTls = String(process.env.MONGODB_TLS || '').toLowerCase() === 'true' ? true : undefined;
const authCompressors = process.env.MONGODB_COMPRESSORS || undefined;
const client = global._mongoClient ?? new MongoClient(uri, {
  maxPoolSize: authMaxPoolSize,
  minPoolSize: authMinPoolSize,
  maxIdleTimeMS: authMaxIdleTimeMS,
  retryWrites: authRetryWrites,
  tls: authTls,
  compressors: authCompressors,
  appName: 'aurora-clinic-auth',
});
global._mongoClient = client;

// Check if Auth0 is configured
const isAuth0Configured = !!(
  process.env.AUTH0_CLIENT_ID && 
  process.env.AUTH0_SECRET && 
  process.env.AUTH0_ISSUER_BASE_URL
);

export const authOptions = {
  // Pass the client directly; the driver will lazily connect on first use
  adapter: MongoDBAdapter(client, { databaseName: dbName }),
  providers: [
    // Auth0 Provider - handles Google, GitHub, etc. through Auth0 dashboard
    ...(isAuth0Configured ? [
      Auth0Provider({
        clientId: process.env.AUTH0_CLIENT_ID!,
        clientSecret: process.env.AUTH0_SECRET!,
        issuer: process.env.AUTH0_ISSUER_BASE_URL!,
      })
    ] : []),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        deviceId: { label: 'Device ID', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          await databaseService.initialize();
          
          const user = await databaseService.users.findOne({ 
            email: credentials.email.toLowerCase(),
            isActive: true 
          });

          if (!user) {
            return null;
          }

          const isPasswordValid = await bcrypt.compare(credentials.password, user.encryptionKey || '');
          
          if (!isPasswordValid) {
            return null;
          }

          // Update last login
          await databaseService.users.updateOne(
            { userId: (user as any).userId },
            { $set: { lastLoginAt: new Date() } }
          );

          // Register device on successful login (soft registration)
          const deviceId = (credentials as any).deviceId || 'unknown';
          await deviceTrustService.ensureDeviceRegistered((user as any).userId, deviceId);

          return {
            id: (user as any).userId,
            email: user.email,
            name: user.name,
            role: user.role,
            deviceId,
          };
        } catch (error) {
          console.error('Authorization error:', error);
          return null;
        }
      }
    })
  ],
  session: {
    strategy: 'jwt' as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ user, account, profile }: { user: any; account: any; profile?: any }) {
      // Sync Auth0/OAuth users with our custom users collection in MongoDB
      if (account?.provider === 'auth0' && user?.email) {
        try {
          await databaseService.initialize();
          
          // Check if user already exists in our custom users collection
          const existingUser = await databaseService.users.findOne({ 
            email: user.email.toLowerCase() 
          });

          if (!existingUser) {
            // Create new user in our custom users collection
            const newUser = {
              userId: user.id || `auth0_${Date.now()}`,
              email: user.email.toLowerCase(),
              name: user.name || profile?.name || user.email.split('@')[0],
              role: 'psychologist' as const,
              isActive: true,
              devices: [],
              createdAt: new Date(),
              updatedAt: new Date(),
              lastLoginAt: new Date(),
              oauthProvider: 'auth0' as const,
              oauthId: account.providerAccountId,
              avatar: user.image || (profile as any)?.picture,
              preferences: {
                theme: 'auto' as const,
                language: 'es',
                timezone: 'America/Santiago',
                notifications: {
                  email: true,
                  push: false,
                  clinicalAlerts: true
                },
                clinical: {
                  defaultSessionDuration: 50,
                  autoSaveInterval: 30,
                  backupFrequency: 'daily' as const
                }
              }
            };
            await databaseService.users.insertOne(newUser as any);
            console.log(`✅ Created Auth0 user in MongoDB: ${user.email}`);
          } else {
            // Update last login for existing user
            await databaseService.users.updateOne(
              { email: user.email.toLowerCase() },
              { 
                $set: { 
                  lastLoginAt: new Date(),
                  updatedAt: new Date(),
                  // Update avatar if changed
                  ...(user.image && { avatar: user.image })
                } 
              }
            );
            console.log(`✅ Updated Auth0 user last login: ${user.email}`);
          }
        } catch (error) {
          console.error('Error syncing Auth0 user with MongoDB:', error);
          // Don't block sign in on sync error - user can still use the app
        }
      }
      return true;
    },
    async jwt({ token, user, account }: { token: any; user: any; account?: any }) {
      if (user) {
        token.id = user.id;
        token.role = user.role || 'psychologist';
        token.provider = account?.provider || 'credentials';
        if (user.deviceId) token.deviceId = user.deviceId;
      }
      
      // Fetch role from custom users collection if not set
      if (token.email && !token.role) {
        try {
          await databaseService.initialize();
          const dbUser = await databaseService.users.findOne({ 
            email: (token.email as string).toLowerCase() 
          });
          if (dbUser) {
            token.role = dbUser.role;
            token.id = dbUser.userId;
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
        }
      }
      
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) || 'psychologist';
        session.user.provider = token.provider as string;
        if (token.deviceId) session.user.deviceId = token.deviceId as string;
      }
      return session;
    },
  },
  // Use NextAuth's built-in pages for Auth0 OAuth flow
  // Custom pages can be added later if needed
  pages: {
    error: '/api/auth/error',
  },
  secret: process.env.NEXTAUTH_SECRET || 'your-secret-key',
};