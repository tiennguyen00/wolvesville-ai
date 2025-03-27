# Authentication Flow Documentation

## Overview

This document details the authentication flows implemented in our application, including user registration, login, and session management using JWT (JSON Web Tokens).

## 1. User Registration Flow

```mermaid
sequenceDiagram
    participant Client
    participant API Server
    participant Database
    participant JWT Service

    Client->>API Server: POST /api/users/register
    Note over Client,API Server: {username, email, password}

    API Server->>API Server: Validate Input
    API Server->>API Server: Hash Password (bcrypt)

    API Server->>Database: Check if user exists
    Database-->>API Server: User existence status

    alt User already exists
        API Server-->>Client: 409 Conflict
    else User doesn't exist
        API Server->>Database: Create new user
        Database-->>API Server: User created

        API Server->>JWT Service: Generate JWT token
        JWT Service-->>API Server: JWT token

        API Server-->>Client: 201 Created
        Note over API Server,Client: {token, user_id, username}
    end
```

## 2. User Login Flow

```mermaid
sequenceDiagram
    participant Client
    participant API Server
    participant Database
    participant JWT Service

    Client->>API Server: POST /api/users/login
    Note over Client,API Server: {email/username, password}

    API Server->>Database: Find user
    Database-->>API Server: User data

    alt User not found
        API Server-->>Client: 401 Unauthorized
    else User found
        API Server->>API Server: Verify password (bcrypt)

        alt Password incorrect
            API Server-->>Client: 401 Unauthorized
        else Password correct
            API Server->>JWT Service: Generate JWT token
            JWT Service-->>API Server: JWT token

            API Server-->>Client: 200 OK
            Note over API Server,Client: {token, user_id, username}
        end
    end
```

## 3. Session Management Flow

```mermaid
sequenceDiagram
    participant Client
    participant API Server
    participant JWT Service

    Client->>API Server: Request with JWT
    Note over Client,API Server: Authorization: Bearer <token>

    API Server->>JWT Service: Verify token

    alt Token invalid/expired
        JWT Service-->>API Server: Invalid token
        API Server-->>Client: 401 Unauthorized
    else Token valid
        JWT Service-->>API Server: Decoded token data
        API Server->>API Server: Extract user info
        API Server-->>Client: 200 OK with requested data
    end
```

## 4. Socket Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant Socket Server
    participant JWT Service
    participant Game Session

    Client->>Socket Server: Connect with token
    Socket Server->>JWT Service: Verify token

    alt Token valid
        JWT Service-->>Socket Server: User data
        Socket Server->>Game Session: Add user to session
        Socket Server-->>Client: Connection established
    else Token invalid
        Socket Server-->>Client: Connection refused
    end

    Note over Client,Game Session: Subsequent game events
```

## Implementation Details

### Security Measures

1. Passwords are hashed using bcrypt before storage
2. JWT tokens expire after 7 days
3. All sensitive routes require valid JWT tokens
4. HTTPS is enforced for all API endpoints
5. Rate limiting is implemented for login attempts

### JWT Token Structure

```json
{
  "user_id": "uuid",
  "username": "string",
  "iat": "timestamp",
  "exp": "timestamp"
}
```

### Error Handling

- Invalid credentials: 401 Unauthorized
- User already exists: 409 Conflict
- Invalid token: 401 Unauthorized
- Server errors: 500 Internal Server Error

### API Endpoints

- POST /api/users/register - User registration
- POST /api/users/login - User login
- POST /api/users/logout - User logout (token invalidation)
- GET /api/users/me - Get user profile (authenticated)
- PUT /api/users/profile - Update user profile (authenticated)

## Best Practices

1. Tokens are stored securely in client-side storage
2. Sensitive data is never logged
3. Failed login attempts are monitored
4. Password requirements are enforced
5. Cross-Origin Resource Sharing (CORS) is properly configured
