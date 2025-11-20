import { NextRequest, NextResponse } from 'next/server';
import { encryptionService } from './encryption';

/**
 * Security headers middleware
 */
export function securityHeaders(request: NextRequest): NextResponse {
  const response = NextResponse.next();
  
  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';");
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // Remove server information
  response.headers.delete('X-Powered-By');
  response.headers.delete('Server');
  
  return response;
}

/**
 * Rate limiting middleware
 */
export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (request: NextRequest) => string;
}) {
  const requests = new Map<string, { count: number; resetTime: number }>();
  
  return function rateLimitMiddleware(request: NextRequest) {
    const key = options.keyGenerator ? options.keyGenerator(request) : getClientIp(request);
    const now = Date.now();
    
    let record = requests.get(key);
    
    if (!record || now > record.resetTime) {
      record = {
        count: 0,
        resetTime: now + options.windowMs,
      };
      requests.set(key, record);
    }
    
    record.count++;
    
    if (record.count > options.maxRequests) {
      return NextResponse.json(
        { 
          error: 'Too many requests',
          retryAfter: Math.ceil((record.resetTime - now) / 1000),
        },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((record.resetTime - now) / 1000).toString(),
          },
        }
      );
    }
    
    return null;
  };
}

/**
 * Input validation middleware
 */
export function validateInput(schema: any) {
  return function validationMiddleware(request: NextRequest) {
    try {
      // Basic validation - in production, use a proper schema validation library
      const body = request.body;
      
      // Check for SQL injection patterns
      const sqlInjectionPattern = /(\b(union|select|insert|update|delete|drop|create|alter|exec|script|declare|truncate)\b|--|\/\*|\*\/|xp_)/i;
      
      if (JSON.stringify(body).match(sqlInjectionPattern)) {
        return NextResponse.json(
          { error: 'Invalid input detected' },
          { status: 400 }
        );
      }
      
      // Check for XSS patterns
      const xssPattern = /(<script|<iframe|<object|<embed|<form|<input|<body|<link|<meta|<style|<svg|<math)/i;
      
      if (JSON.stringify(body).match(xssPattern)) {
        return NextResponse.json(
          { error: 'Invalid input detected' },
          { status: 400 }
        );
      }
      
      return null;
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }
  };
}

/**
 * Request logging middleware
 */
export function requestLogger(request: NextRequest): void {
  const timestamp = new Date().toISOString();
  const method = request.method;
  const url = request.url;
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const ip = getClientIp(request);
  
  console.log(`[${timestamp}] ${method} ${url} - ${ip} - ${userAgent}`);
}

/**
 * API key validation middleware
 */
export function validateApiKey(request: NextRequest): NextResponse | null {
  const apiKey = request.headers.get('X-API-Key');
  
  if (!apiKey) {
    return NextResponse.json(
      { error: 'API key required' },
      { status: 401 }
    );
  }
  
  if (!encryptionService.validateApiKey(apiKey)) {
    return NextResponse.json(
      { error: 'Invalid API key format' },
      { status: 401 }
    );
  }
  
  // Additional API key validation would go here
  // e.g., check against database, validate permissions, etc.
  
  return null;
}

/**
 * CORS middleware
 */
export function corsMiddleware(request: NextRequest): NextResponse | null {
  const origin = request.headers.get('origin');
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
  
  if (origin && !allowedOrigins.includes(origin)) {
    return NextResponse.json(
      { error: 'Origin not allowed' },
      { status: 403 }
    );
  }
  
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 200 });
    
    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    }
    
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Max-Age', '86400');
    
    return response;
  }
  
  return null;
}

/**
 * Get client IP address
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }
  
  // In production, you might want to get this from the request object
  // This is a simplified version
  return 'unknown';
}

/**
 * Combine multiple middlewares
 */
export function combineMiddlewares(...middlewares: Array<(request: NextRequest) => NextResponse | null | void>) {
  return async function combinedMiddleware(request: NextRequest) {
    for (const middleware of middlewares) {
      const result = await middleware(request);
      if (result) {
        return result;
      }
    }
    return null;
  };
}