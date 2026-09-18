# JWT Management

Generate and decode JWT tokens for API authentication.

## Overview

This feature provides utilities for generating and decoding JWT tokens used to authenticate with the StorageDeck API.

## Commands

```bash
# Generate a new JWT token
npm run test:jwt

# Decode an existing JWT token
npm run test:decode
```

## Configuration

Add these to your `.env` file:

```env
# JWT Configuration
JWT_SECRET=your-jwt-secret-key
JWT_SUB=subject-identifier
JWT_TENANT_UUID=tenant-uuid
JWT_TENANT_ID=tenant-id
JWT_SN=serial-number
JWT_USER_SRN=user-srn
JWT_EXPIRES_IN=5m  # Token expiration (default: 5 minutes)
```

## Generate Token

```bash
npm run test:jwt
```

This generates a JWT token with the configured claims and prints it to the console.

## Decode Token

```bash
npm run test:decode
```

This decodes an existing JWT token to inspect its payload and verify its claims.

## Token Claims

The generated JWT includes these claims:

| Claim | Description | Source |
|-------|-------------|--------|
| `sub` | Subject identifier | `JWT_SUB` |
| `tenantUuid` | Tenant UUID | `JWT_TENANT_UUID` |
| `tenantId` | Tenant ID | `JWT_TENANT_ID` |
| `sn` | Serial number | `JWT_SN` |
| `userSrn` | User SRN | `JWT_USER_SRN` |
| `exp` | Expiration time | Calculated from `JWT_EXPIRES_IN` |
| `iat` | Issued at time | Auto-generated |

## Usage in API Calls

Use the generated token in API requests:

```typescript
const response = await axios.post(url, data, {
  headers: {
    Authorization: `Bearer ${token}`
  }
});
```

## Related Files

- `src/services/jwtService.ts` - JWT generation and decoding logic
- `src/config/env.ts` - `validateJwtEnv()` function
- `test/testGenerateJwt.ts` - Token generation script
- `test/decodeJwtTest.ts` - Token decoding script
