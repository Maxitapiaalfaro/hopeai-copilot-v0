import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { databaseService } from '@/lib/database';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, role = 'psychologist' } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    await databaseService.initialize();

    // Check if user already exists
    const existingUser = await databaseService.users.findOne({ 
      email: email.toLowerCase() 
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = crypto.randomUUID();

    // Create user
    const newUser = {
      userId,
      email: email.toLowerCase(),
      name,
      role,
      isActive: true,
      devices: [],
      encryptionKey: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
      preferences: {
        theme: 'auto' as const,
        language: 'es',
        timezone: 'America/Santiago',
        notifications: {
          email: true,
          push: true,
          clinicalAlerts: true,
        },
        clinical: {
          defaultSessionDuration: 50,
          autoSaveInterval: 30000,
          backupFrequency: 'daily' as const,
        },
      },
    };

    const result = await databaseService.users.insertOne(newUser);

    return NextResponse.json({
      success: true,
      userId,
      message: 'User created successfully',
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}