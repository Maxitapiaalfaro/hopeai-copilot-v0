# Enhanced User Identity System

This document records the implementation of the Enhanced User Identity System and how to use it across the app.

## Summary

- Replaced the shared `default_user` pattern with a per-user/device identity.
- Introduced a lightweight identity provider (`lib/user-identity.ts`).
- Anonymous users now get a stable device-based `userId` (e.g., `anon_dev_<hash>`), persisted in `localStorage`.
- UI preferences storage and hooks now resolve the effective userId automatically.

## What Changed

- New file: `lib/user-identity.ts`
  - `getCurrentUserId()`: returns authenticated user id if present.
  - `setCurrentUserId(userId)`: persists the authenticated id (call on login).
  - `getDeviceId()`: stable device id (fingerprint + hashing).
  - `getOrCreateAnonymousUserId()`: returns anonymous `userId` derived from device id.
  - `getEffectiveUserId(explicitUserId?)`: picks explicit → authenticated → anonymous.
  - `clearCurrentUserId()`: removes the stored authenticated id.

- Updated `lib/ui-preferences-storage.ts`
  - Defaults now use `getEffectiveUserId()` instead of hard-coded `default_user`.
  - Methods accept optional `userId` and resolve internally.

- Updated `hooks/use-ui-preferences.ts`
  - The hook resolves `userId` via `getEffectiveUserId()` and persists preferences per user/device.

## Usage

- Anonymous usage (no login):
  - Callers can omit `userId`; preferences will be isolated per device automatically.
  - Example: `const { preferences } = useUIPreferences()`

- Authenticated usage (after login):
  - Call `setCurrentUserId(actualUserId)` once after successful authentication.
  - From then on, `getEffectiveUserId()` returns the authenticated id.
  - Example:
    ```ts
    import { setCurrentUserId } from '@/lib/user-identity';
    setCurrentUserId('user_123');
    ```

## Data Storage

- `localStorage` keys:
  - `aurora_user_id`: authenticated user id (optional).
  - `aurora_device_id`: stable device id (always present after first run).

## Backwards Compatibility

- If a component still passes a `userId`, it will be respected.
- If a `userId` is not provided, the system falls back to authenticated or anonymous per-device id.

## Integration with Authentication System ✅

The Enhanced User Identity System is now fully integrated with the new Authentication Service:

### Authentication Flow Integration

1. **Login Process**:
   ```ts
   import authService from '@/lib/auth/auth-service';
   import { setCurrentUserId } from '@/lib/user-identity';
   
   // After successful login
   const result = await authService.login(email, password);
   setCurrentUserId(result.user.id); // Automatically called by AuthService
   ```

2. **Logout Process**:
   ```ts
   import authService from '@/lib/auth/auth-service';
   
   // Logout automatically clears user identity
   await authService.logout(); // Clears both auth and identity
   ```

### AuthService Features

The authentication system provides:
- ✅ **Full authentication flow** (login, signup, OAuth)
- ✅ **JWT token management** (access + refresh tokens)
- ✅ **Device management** (register, list, revoke devices)
- ✅ **Security audit logging** (all auth events tracked)
- ✅ **Integration with user identity** (seamless identity management)
- ✅ **Mock backend ready** (easy to connect to real API)

### Usage Examples

```ts
// Check authentication status
import authService from '@/lib/auth/auth-service';

if (authService.isAuthenticated()) {
  const user = authService.getCurrentUser();
  console.log(`Logged in as: ${user.displayName}`);
}

// Get user devices
const devices = await authService.getUserDevices();

// Register current device
await authService.registerDevice({
  deviceId: 'device_123',
  deviceName: 'MacBook Pro',
  deviceType: 'desktop',
  os: 'macOS',
  browser: 'Chrome',
  lastActive: new Date(),
  isCurrentDevice: true
});
```

## Integration with Hybrid Storage System ✅

The Enhanced User Identity System is now integrated with the new hybrid storage architecture:

### Storage Integration
- **User Isolation**: All storage operations are now user-specific
- **Device Tracking**: Storage operations include device context
- **Sync Metadata**: User identity is embedded in sync operations
- **Access Control**: Storage operations respect user authentication state

### Implementation Details
- **Unified Storage Interface**: Uses `getEffectiveUserId()` for all operations
- **Enhanced IndexedDB Adapter**: Stores data per user with device isolation
- **API Client Adapter**: Includes user authentication in all API calls
- **Sync Metadata**: Tracks user and device context for all changes

### Benefits
- **Multi-device Support**: Each device gets isolated storage
- **User Privacy**: Data is properly isolated between users
- **Audit Trail**: All storage operations include user context
- **Seamless Migration**: Existing data automatically adopts new identity system

## Integration with Conflict Resolution Engine ✅

The Enhanced User Identity System is now integrated with the Conflict Resolution Engine:

### Conflict Resolution Integration
- **User Context**: All conflict resolutions include user identity for audit trails
- **Device Context**: Conflicts are tracked per device for better resolution
- **Clinical Priority**: User identity helps determine clinical data priority
- **Audit Logging**: All conflict resolutions are logged with full user context

### Implementation Details
- **ConflictResolver**: Uses user identity to determine resolution strategies
- **ClinicalPriorityStrategy**: Leverages user clinical specialty information
- **UserIntentStrategy**: Respects user preferences and marked importance
- **Audit System**: Comprehensive logging includes user and device information

### Benefits
- **HIPAA Compliance**: Full audit trail with user and device context
- **Intelligent Resolution**: User context enables better conflict resolution
- **Clinical Safety**: Clinical data gets appropriate priority based on user role
- **User Trust**: Transparent conflict resolution with full accountability

## Next Steps (Optional)

- Integrate with `enhanced-sentry-metrics-tracker` to unify identity events.
- Expose a small context provider to synchronize identity across the app.
- Add two-factor authentication support.
- Implement password reset functionality.