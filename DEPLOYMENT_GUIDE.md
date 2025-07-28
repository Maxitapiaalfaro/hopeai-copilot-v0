# 🚀 Deployment Guide - HopeAI Copilot

This guide will help you deploy your HopeAI Copilot application to staging and production environments.

## 📋 Prerequisites

Before deploying, ensure you have:

- ✅ All tests passing (run `node test-complete-implementation.js`)
- ✅ Environment variables configured
- ✅ Sentry project set up
- ✅ Database/storage configured (if applicable)

## 🎯 Deployment Options

### Option 1: Vercel (Recommended)

#### Quick Deploy to Staging

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy to Staging**
   ```bash
   # First deployment (will create project)
   vercel
   
   # For subsequent deployments
   vercel --target staging
   ```

4. **Set Environment Variables**
   ```bash
   # Set Sentry DSN
   vercel env add SENTRY_DSN
   
   # Set other environment variables
   vercel env add NEXT_PUBLIC_SENTRY_DSN
   vercel env add SENTRY_ORG
   vercel env add SENTRY_PROJECT
   vercel env add SENTRY_AUTH_TOKEN
   ```

5. **Deploy to Production**
   ```bash
   vercel --prod
   ```

#### Environment Variables for Vercel

Create these environment variables in your Vercel dashboard:

```env
# Sentry Configuration
SENTRY_DSN=your_sentry_dsn_here
NEXT_PUBLIC_SENTRY_DSN=your_public_sentry_dsn_here
SENTRY_ORG=hopeai-rh
SENTRY_PROJECT=javascript-nextjs
SENTRY_AUTH_TOKEN=your_sentry_auth_token

# Google AI (if using)
GOOGLE_GENAI_API_KEY=your_google_ai_key

# Other configurations
NODE_ENV=production
ORCHESTRATION_MIGRATION_PERCENTAGE=75
```

### Option 2: Docker Deployment

#### Create Dockerfile

```dockerfile
# Dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

#### Docker Compose for Staging

```yaml
# docker-compose.staging.yml
version: '3.8'

services:
  hopeai-copilot:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=staging
      - SENTRY_DSN=${SENTRY_DSN}
      - NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}
      - SENTRY_ORG=${SENTRY_ORG}
      - SENTRY_PROJECT=${SENTRY_PROJECT}
      - GOOGLE_GENAI_API_KEY=${GOOGLE_GENAI_API_KEY}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

#### Deploy with Docker

```bash
# Build and run
docker-compose -f docker-compose.staging.yml up -d

# Check logs
docker-compose -f docker-compose.staging.yml logs -f

# Stop
docker-compose -f docker-compose.staging.yml down
```

### Option 3: Manual Server Deployment

#### On Ubuntu/Debian Server

1. **Install Node.js and PM2**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   sudo npm install -g pm2
   ```

2. **Clone and Setup**
   ```bash
   git clone your-repo-url hopeai-copilot
   cd hopeai-copilot
   npm install
   npm run build
   ```

3. **Create PM2 Ecosystem File**
   ```javascript
   // ecosystem.config.js
   module.exports = {
     apps: [{
       name: 'hopeai-copilot-staging',
       script: 'npm',
       args: 'start',
       cwd: '/path/to/hopeai-copilot',
       env: {
         NODE_ENV: 'staging',
         PORT: 3000,
         SENTRY_DSN: 'your_sentry_dsn',
         NEXT_PUBLIC_SENTRY_DSN: 'your_public_sentry_dsn'
       }
     }]
   }
   ```

4. **Start with PM2**
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

## 🔧 Environment Configuration

### Create .env.staging

```env
# .env.staging
NODE_ENV=staging
NEXT_PUBLIC_APP_ENV=staging

# Sentry Configuration
SENTRY_DSN=your_staging_sentry_dsn
NEXT_PUBLIC_SENTRY_DSN=your_staging_public_sentry_dsn
SENTRY_ORG=hopeai-rh
SENTRY_PROJECT=javascript-nextjs
SENTRY_AUTH_TOKEN=your_sentry_auth_token

# Google AI
GOOGLE_GENAI_API_KEY=your_google_ai_key

# Orchestration
ORCHESTRATION_MIGRATION_PERCENTAGE=75

# Debug (for staging only)
NEXT_PUBLIC_DEBUG=true
```

### Create .env.production

```env
# .env.production
NODE_ENV=production
NEXT_PUBLIC_APP_ENV=production

# Sentry Configuration
SENTRY_DSN=your_production_sentry_dsn
NEXT_PUBLIC_SENTRY_DSN=your_production_public_sentry_dsn
SENTRY_ORG=hopeai-rh
SENTRY_PROJECT=javascript-nextjs
SENTRY_AUTH_TOKEN=your_sentry_auth_token

# Google AI
GOOGLE_GENAI_API_KEY=your_google_ai_key

# Orchestration
ORCHESTRATION_MIGRATION_PERCENTAGE=100

# Debug (disabled in production)
NEXT_PUBLIC_DEBUG=false
```

## 🧪 Pre-Deployment Testing

### Run All Tests

```bash
# Complete implementation test
node test-complete-implementation.js

# End-to-end market validation test
node scripts/test-market-validation-e2e.js

# Sentry metrics test
node scripts/test-sentry-metrics.js

# Production validation
node scripts/validate-metrics-production.js
```

### Build Test

```bash
# Test build process
npm run build

# Test start
npm run start

# Check health endpoint
curl http://localhost:3000/api/health
```

## 📊 Monitoring Setup

### Sentry Release Tracking

```bash
# Create a release in Sentry
npx @sentry/cli releases new "hopeai-copilot@$(git rev-parse HEAD)"
npx @sentry/cli releases set-commits "hopeai-copilot@$(git rev-parse HEAD)" --auto
npx @sentry/cli releases finalize "hopeai-copilot@$(git rev-parse HEAD)"
```

### Health Checks

Your application includes these health check endpoints:

- `/api/health` - Basic health check
- `/api/orchestration/health` - Orchestration system health
- `/api/orchestration/metrics` - System metrics

### Monitoring Commands

```bash
# Check orchestration health
npm run monitor:orchestration

# Check metrics
npm run metrics:orchestration

# Reset metrics (if needed)
npm run reset:metrics
```

## 🚨 Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Clear Next.js cache
   rm -rf .next
   npm run build
   ```

2. **Sentry Issues**
   ```bash
   # Test Sentry configuration
   node scripts/test-sentry-metrics.js
   ```

3. **Environment Variables**
   ```bash
   # Check if variables are loaded
   node -e "console.log(process.env.SENTRY_DSN)"
   ```

4. **Memory Issues**
   ```bash
   # Increase Node.js memory limit
   export NODE_OPTIONS="--max-old-space-size=4096"
   npm run build
   ```

### Logs

```bash
# Vercel logs
vercel logs

# Docker logs
docker-compose logs -f

# PM2 logs
pm2 logs hopeai-copilot-staging
```

## 📝 Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Sentry project created
- [ ] Build successful locally
- [ ] Health checks working

### Staging Deployment
- [ ] Deploy to staging environment
- [ ] Verify health endpoints
- [ ] Test core functionality
- [ ] Check Sentry integration
- [ ] Validate metrics tracking
- [ ] Performance testing

### Production Deployment
- [ ] Staging tests passed
- [ ] Production environment variables set
- [ ] Database migrations (if any)
- [ ] Deploy to production
- [ ] Smoke tests
- [ ] Monitor for errors
- [ ] Create Sentry release

## 🔗 Useful Links

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Sentry Next.js Guide](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)

---

**Need Help?** Check the troubleshooting section or review the application logs for specific error messages.