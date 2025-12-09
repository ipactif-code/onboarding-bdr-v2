# API Contracts: Onboarding BDR Team v2 LMS

**Date**: 2025-12-06
**Branch**: `001-bdr-lms`
**Base URL**: `/api`

## Authentication

All endpoints except `/api/auth/*` require authentication via session cookie.
Role-based access indicated by `[ADMIN]` or `[USER]` tags.

## API Endpoints Overview

| Domain | Endpoints | Description |
|--------|-----------|-------------|
| Auth | 6 | Authentication, MFA, session management |
| Users | 5 | User management and profiles |
| Teams | 7 | Team CRUD and membership |
| Courses | 10 | Course CRUD and publishing |
| Sections | 5 | Section management within courses |
| Lessons | 8 | Lesson CRUD and type-specific operations |
| Progress | 4 | Progress tracking and completion |
| Quizzes | 3 | Quiz attempts and results |
| Messages | 6 | Conversations and messaging |
| Comments | 5 | Course/lesson comments |
| Analytics | 5 | Metrics and activity logs |
| Files | 3 | File upload and management |

## Detailed Contracts

See individual contract files:
- [auth.yaml](./auth.yaml) - Authentication endpoints
- [users.yaml](./users.yaml) - User management
- [teams.yaml](./teams.yaml) - Team management
- [courses.yaml](./courses.yaml) - Course management
- [lessons.yaml](./lessons.yaml) - Lesson management
- [progress.yaml](./progress.yaml) - Progress tracking
- [messages.yaml](./messages.yaml) - Messaging system
- [comments.yaml](./comments.yaml) - Comment system
- [analytics.yaml](./analytics.yaml) - Analytics and logs
- [files.yaml](./files.yaml) - File management

## Common Response Formats

### Success Response
```json
{
  "data": { ... },
  "meta": {
    "timestamp": "2025-12-06T10:00:00Z"
  }
}
```

### Paginated Response
```json
{
  "data": [ ... ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 100,
    "totalPages": 5
  }
}
```

### Error Response
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable message",
    "details": [ ... ]
  }
}
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| UNAUTHORIZED | 401 | Not authenticated |
| FORBIDDEN | 403 | Not authorized for action |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Invalid input data |
| CONFLICT | 409 | Resource conflict (e.g., duplicate) |
| RATE_LIMITED | 429 | Too many requests |
| SERVER_ERROR | 500 | Internal server error |
