# TypeScript Utility Types Usage Examples

This document demonstrates how we've used TypeScript utility types to avoid code duplication.

## Base Interface

```typescript
export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  created_at?: Date;
}
```

## Derived Types Using Utility Types

### 1. User Registration (Omit + Intersection)
Instead of redefining the entire structure:
```typescript
// ❌ BAD - Duplicating fields
interface UserRegistration {
  username: string;
  email: string;
  password: string;
}

// ✅ GOOD - Using utility types
export type UserRegistration = Omit<User, 'id' | 'password_hash' | 'created_at'> & {
  password: string;
};
```
Result: `{ username: string; email: string; password: string; }`

### 2. User Login (Pick + Intersection)
```typescript
// ❌ BAD - Manual definition
interface UserLogin {
  username: string;
  password: string;
}

// ✅ GOOD - Derived from User
export type UserLogin = Pick<User, 'username'> & {
  password: string;
};
```
Result: `{ username: string; password: string; }`

### 3. Public User Info (Omit)
```typescript
// ❌ BAD - Redeclaring all safe fields
interface UserPublic {
  id: number;
  username: string;
  email: string;
  created_at?: Date;
}

// ✅ GOOD - Remove sensitive field
export type UserPublic = Omit<User, 'password_hash'>;
```
Result: `{ id: number; username: string; email: string; created_at?: Date; }`

### 4. User Creation Result (Pick)
```typescript
// ❌ BAD - Manual selection
interface UserCreationResult {
  username: string;
  email: string;
}

// ✅ GOOD - Pick specific fields
export type UserCreationResult = Pick<User, 'username' | 'email'>;
```
Result: `{ username: string; email: string; }`

## Generic API Response Types

### Using Generics for Flexibility
```typescript
export interface ApiResponse<T = unknown> {
  message?: string;
  success?: boolean;
  data?: T;
  error?: string;
}

export interface ApiSuccessResponse<T = unknown> extends ApiResponse<T> {
  message: string;
  success: true;
  data: T;
}

export interface ApiErrorResponse extends ApiResponse {
  message: string;
  success: false;
  error?: string;
}
```

Usage in controllers:
```typescript
// Typed response for registration
Response<ApiSuccessResponse<RegisterSuccessData> | ApiErrorResponse>

// Typed response for login
Response<ApiSuccessResponse<LoginSuccessData> | ApiErrorResponse>
```

## Extended Request Types

### Request Type Extensions
```typescript
// Base authenticated request
export interface AuthenticatedRequest extends Request {
  user?: string;
}

// Specific request with body typing
export interface CreateDirRequest extends AuthenticatedRequest {
  body: {
    folderPath: string;
  };
}

// Registration request with typed body
export interface RegisterRequest extends Request {
  body: UserRegistration; // Uses the utility type!
}

// Login request with typed body
export interface LoginRequest extends Request {
  body: UserLogin; // Uses the utility type!
}
```

## Benefits

1. **Single Source of Truth**: Change `User` interface once, all derived types update automatically
2. **Type Safety**: TypeScript enforces consistency across related types
3. **DRY Principle**: No repeating field definitions
4. **Maintainability**: Easy to add/remove fields from base types
5. **Intellisense**: Full autocomplete support in VSCode
6. **Refactoring**: Rename a field once, all usages update

## Real-World Example

When you add a new field to `User`:
```typescript
export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  created_at?: Date;
  phone_number?: string; // NEW FIELD
}
```

All derived types automatically update:
- `UserPublic` now includes `phone_number`
- `UserRegistration` gets `phone_number` automatically (via Omit)
- `UserCreationResult` doesn't include it (via Pick)
- No manual changes needed to maintain consistency!

## Database Type Safety

```typescript
// Typed database queries
const user = await db.oneOrNone<User>(
  'SELECT * FROM users WHERE username = $1',
  [username]
);
// user is typed as User | null

const users = await db.manyOrNone<User>('SELECT * FROM users');
// users is typed as User[] | null
```

This ensures:
- Query results have correct types
- No implicit `any` types
- Compile-time safety for database operations
