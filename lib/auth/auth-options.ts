import { MongoDBAdapter } from '@auth/mongodb-adapter';
import { MongoClient } from 'mongodb';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { databaseService } from '@/lib/database';
import { deviceTrustService } from '@/lib/security/device-trust';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB_NAME || 'aurora_clinic';

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

export const authOptions = {
  // Pass the client directly; the driver will lazily connect on first use
  adapter: MongoDBAdapter(client, { databaseName: dbName }),
  providers: [
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
    async jwt({ token, user }: { token: any; user: any }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        if (user.deviceId) token.deviceId = user.deviceId;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        if (token.deviceId) session.user.deviceId = token.deviceId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
    error: '/auth/error',
  },
  secret: process.env.NEXTAUTH_SECRET || 'your-secret-key',
};