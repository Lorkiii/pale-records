# PALE Server Agent Instructions

## Purpose

This file defines the mandatory engineering and security rules for any AI coding agent working inside the PALE Records backend.

The backend is treated as a security boundary. Every change to routes, controllers, services, middleware, Prisma queries, authentication, uploads, or API responses must be reviewed for:

1. Input validation
2. Authentication
3. Authorization
4. Database safety
5. Business-rule integrity
6. File-upload safety
7. Error handling
8. Output/response validation
9. Sensitive-data exposure
10. Abuse and rate-limit risks

Do not consider a backend task complete until all applicable checks in this file have been satisfied.

---

## Project Context

PALE Records currently uses:

- Node.js
- Express
- TypeScript
- Prisma ORM
- Neon PostgreSQL
- Cloudinary for uploaded files
- React + Vite client
- Admin-only authentication
- Zod should be used for runtime validation

Core PALE features include:

- Classes
- Students
- Multiple class schedules
- Attendance sessions
- PALE attendance statuses:
  - `PRESENT`
  - `ABSENT`
  - `LATE`
  - `EXCUSED`
- Automatic attendance-session creation from class schedules
- Manual historical attendance-session creation
- Recitation records
- Agenda/events
- Excuse attachments

Allowed excuse attachment formats:

- PDF
- JPG
- JPEG
- PNG

Maximum file size:

- 5 MB

---

# 1. Mandatory Security Principles

Every backend change MUST follow these rules.

## Never Trust Client Input

Treat all of the following as untrusted:

- `req.body`
- `req.params`
- `req.query`
- request headers
- cookies
- uploaded filenames
- uploaded MIME types
- Cloudinary metadata
- IDs received from the client
- dates received from the client
- enum/status values received from the client

Never use raw request values directly in Prisma queries or business logic before validation.

---

# 2. Validate Every Request

Use Zod schemas for every endpoint.

Validate all applicable:

- body
- route params
- query params
- pagination values
- filters
- sort fields
- dates
- UUIDs
- enums
- uploaded file metadata

Example expectations:

- IDs must be valid UUIDs when UUIDs are used.
- Email addresses must be normalized and validated.
- Strings must have explicit minimum/maximum lengths.
- Numbers must have explicit ranges.
- Dates must be checked for validity.
- Enum values must come from an allowlist.
- Unknown fields should normally be rejected or stripped intentionally.

Do not rely on TypeScript types for runtime security.

TypeScript types disappear at runtime.

---

# 3. Validate Every API Response

All server output must be intentional and validated.

Each endpoint should have an explicit response shape.

Prefer Zod response schemas for important API boundaries.

Before sending data with `res.json(...)`:

1. Select only fields that the client needs.
2. Validate or serialize the response through the approved response schema.
3. Remove sensitive/internal fields.
4. Return a deliberate HTTP status code.

Never blindly return complete Prisma objects.

Example prohibited pattern:

```ts
const user = await prisma.user.findUnique(...);
return res.json(user);
```

If the Prisma result includes internal fields, explicitly map or `select` the safe fields.

Sensitive fields that must NEVER appear in responses include, when applicable:

- `passwordHash`
- password reset tokens
- authentication tokens
- session secrets
- API keys
- Cloudinary secrets
- database URLs
- private environment variables
- internal stack traces
- raw Prisma errors
- internal infrastructure metadata

Prefer Prisma `select` over fetching every column and deleting sensitive fields afterward.

---

# 4. Standard Response Rules

Responses must be predictable.

Use the existing project response convention if one exists.

If no convention exists yet, prefer a minimal structure such as:

```ts
{
  success: true,
  data: ...
}
```

For errors:

```ts
{
  success: false,
  error: {
    code: "VALIDATION_ERROR",
    message: "The submitted data is invalid."
  }
}
```

Do not expose implementation details in public error messages.

Do not add unnecessary hard-coded metadata to responses.

Avoid fields such as:

- server name
- framework version
- database name
- internal file paths
- deployment identifiers
- stack trace
- debug information

unless explicitly required for internal development tooling.

---

# 5. HTTP Status Codes

Use appropriate status codes.

Common examples:

- `200` — successful read/update
- `201` — resource created
- `204` — successful operation with no response body
- `400` — malformed request
- `401` — unauthenticated
- `403` — authenticated but not authorized
- `404` — resource not found
- `409` — conflict/duplicate resource
- `413` — uploaded payload too large
- `422` — semantically invalid input when appropriate
- `429` — rate limit exceeded
- `500` — unexpected server error

Do not return `200` for failed operations.

---

# 6. Authentication

PALE Records is admin-only.

Protected routes MUST require authenticated admin access unless a route is intentionally public, such as a login endpoint or health check.

Never trust a client-supplied role.

Authorization must be derived from verified server-side authentication state.

Do not authorize using values such as:

```ts
req.body.role
req.query.role
req.headers["x-role"]
```

unless the value is independently verified by a secure authentication mechanism.

Passwords:

- Never store plaintext passwords.
- Use a reputable password hashing algorithm such as bcrypt.
- Never log passwords.
- Never return password hashes.
- Compare passwords only through the password-hashing library.

Authentication failures should not reveal whether an account exists when doing so creates account-enumeration risk.

---

# 7. Authorization

Authentication answers:

> Who is making the request?

Authorization answers:

> Is this user allowed to perform this operation?

Both checks are required.

For every protected endpoint verify:

- the requester is authenticated;
- the requester has the required admin permission/role;
- referenced records are allowed to be accessed or changed;
- resource relationships are valid.

Do not assume that hiding buttons in the React frontend provides authorization.

Frontend restrictions are UX only.

Backend authorization is mandatory.

---

# 8. CORS

Do not use unrestricted production CORS.

Avoid:

```ts
app.use(cors());
```

for production configuration.

Use an explicit allowlist of trusted frontend origins.

Development localhost origins may be allowed through environment-specific configuration.

Never enable credentialed CORS with a wildcard origin.

---

# 9. Security Headers

Use appropriate HTTP security headers.

Prefer `helmet` unless there is a documented incompatibility.

Review at minimum:

- content-type sniffing protection
- frame protections
- referrer policy
- content security considerations
- cross-origin policies

Do not expose framework implementation details unnecessarily.

Disable `X-Powered-By` if it is not already handled.

---

# 10. Rate Limiting and Abuse Protection

Endpoints vulnerable to abuse should have rate limits.

At minimum consider rate limiting for:

- login
- password reset
- verification endpoints
- file uploads
- bulk operations
- expensive search/filter routes

Rate limits must be stricter for authentication endpoints than ordinary reads.

Do not rely only on frontend debouncing.

---

# 11. Environment Variables

Secrets and environment-specific configuration must come from environment variables.

Never hard-code:

- database URLs
- authentication secrets
- API keys
- Cloudinary secrets
- production domains
- private credentials

Validate required environment variables at server startup.

The server should fail clearly during startup if a required environment variable is missing or malformed.

Never log secret values.

---

# 12. Prisma and Database Safety

Use Prisma's query API whenever possible.

Do not use raw SQL unless there is a justified reason.

If raw SQL is required:

- use parameterized/tagged Prisma APIs;
- never concatenate untrusted strings into SQL;
- document why raw SQL is necessary.

Avoid unsafe APIs such as `$queryRawUnsafe` and `$executeRawUnsafe` unless there is an exceptional, documented, reviewed reason.

Always validate IDs and filters before sending them to Prisma.

Use database constraints for invariants that must remain correct even under concurrent requests.

Examples:

- unique email
- unique student number when required by the business rule
- unique attendance record for a student within an attendance session
- unique generated attendance session for the same class/date/schedule occurrence when applicable

Application checks alone are not enough for concurrency-sensitive uniqueness rules.

---

# 13. Prevent Mass Assignment

Never pass an entire request body directly into Prisma.

Prohibited:

```ts
await prisma.user.update({
  where: { id },
  data: req.body
});
```

Instead, construct an explicit object from validated fields.

Example:

```ts
const input = updateStudentSchema.parse(req.body);

await prisma.student.update({
  where: { id },
  data: {
    firstName: input.firstName,
    lastName: input.lastName,
    studentNo: input.studentNo
  }
});
```

This prevents unauthorized fields from being written.

---

# 14. Transactions

Use Prisma transactions for operations that must succeed or fail as one unit.

Examples:

- creating multiple historical attendance sessions;
- generating a session and related records;
- deleting a class and dependent operations that are not fully covered by database cascading;
- multi-step updates involving related attendance/recitation records.

Do not leave partially completed records after a failure.

---

# 15. Pagination and Query Limits

List endpoints should have bounded pagination.

Never allow an untrusted client to request unlimited rows.

Validate:

- page
- limit
- sort column
- sort direction
- filters

Set a server-side maximum page size.

Sort fields must come from an allowlist.

Never insert a raw user-provided sort column into SQL.

---

# 16. Error Handling

Use centralized Express error-handling middleware.

Do not duplicate uncontrolled error handling across every route.

Expected errors should be converted to safe application errors.

Unexpected errors should:

1. be logged safely on the server;
2. receive an internal correlation/request identifier when useful;
3. return a generic public message;
4. never return the stack trace in production.

Do not return raw errors such as:

- Prisma error objects
- PostgreSQL errors
- Cloudinary errors
- filesystem paths
- stack traces

to the client.

Development logging may contain additional diagnostic information, but secrets and credentials must still be redacted.

---

# 17. Logging Rules

Logs must help debugging without leaking sensitive information.

Never log:

- passwords
- password hashes
- authorization headers
- bearer tokens
- session tokens
- cookies containing credentials
- database URLs
- Cloudinary secrets
- full sensitive request bodies

Use structured logs where practical.

Security-relevant events may be logged, including:

- repeated failed login attempts
- rejected uploads
- authorization failures
- unexpected server errors

Do not log more personal data than necessary.

---

# 18. File Upload Security

PALE excuse attachments require special validation.

Allowed extensions:

- `.pdf`
- `.jpg`
- `.jpeg`
- `.png`

Allowed MIME types must be restricted consistently.

Maximum size:

- 5 MB

Do not trust the original filename or extension alone.

Validate file type using server-side upload metadata and, where practical, file signature/content checks.

Sanitize or replace user-provided filenames.

Prefer generated unique public IDs.

Never allow the client to choose arbitrary filesystem paths.

Do not expose Cloudinary API secrets to the frontend.

For Cloudinary uploads:

- validate before upload;
- constrain accepted resource formats;
- store only required Cloudinary identifiers/URLs in the database;
- store the Cloudinary public ID when deletion/replacement is needed;
- remove orphaned uploads when a related database operation fails;
- remove replaced/deleted attachments when required by the application lifecycle.

Do not accept executable/script file formats.

---

# 19. PALE Attendance Integrity Rules

Attendance operations must preserve domain integrity.

For each attendance record:

- the student must exist;
- the attendance session must exist;
- the student must belong to the session's class;
- the status must be a valid `AttendanceStatus`;
- duplicate attendance records for the same student/session must be prevented.

For `EXCUSED` attendance:

- require the project's configured excuse information;
- validate remarks when they are required;
- validate attachments using the upload rules above.

Do not allow arbitrary student IDs from another class to be attached to a session.

---

# 20. Attendance Session Rules

Automatic session generation must be safe against duplicate runs.

If the scheduler or endpoint runs twice, it must not create duplicate sessions for the same class schedule occurrence.

Use database uniqueness where possible, not only:

```ts
findFirst(...)
if (!existing) create(...)
```

because two concurrent requests can both pass the check.

Manual historical session creation must:

- validate the requested date range;
- reject invalid or reversed ranges;
- enforce a reasonable maximum range;
- respect the relevant class;
- avoid duplicate sessions;
- use a transaction when creating multiple records;
- return a clear summary of created/skipped/conflicting dates.

Historical sessions should be ordered according to the PALE UI requirement, not by accidental insertion order.

---

# 21. Date and Time Validation

Do not rely on arbitrary date strings.

Normalize and validate dates before persistence.

For class dates:

- `startDate` must be valid;
- `endDate` must be valid when present;
- `endDate` must not be before `startDate`.

For attendance sessions:

- verify that generated dates correspond to valid class schedules;
- manual historical creation may intentionally create past sessions;
- do not accidentally generate sessions outside the allowed class period unless the product requirement explicitly allows it.

Be explicit about timezone assumptions.

Do not silently mix UTC and local school time.

---

# 22. Class Schedule Validation

A class may contain multiple schedule entries.

Each schedule entry should validate:

- day of week
- start time
- end time

Rules:

- end time must be after start time;
- duplicate schedule entries should be prevented;
- overlapping entries should be rejected or deliberately supported according to product requirements.

Never trust display-formatted time values without parsing them.

---

# 23. Student Validation

When creating/updating students:

- validate first name;
- validate last name;
- validate optional student number;
- verify the class exists;
- prevent unintended duplicate student numbers if the schema/business rule requires uniqueness;
- never allow changing protected relational fields through mass assignment.

Deletion behavior must be intentional because attendance history may depend on the student.

Before changing cascade behavior, review its effect on historical records.

---

# 24. Recitation Integrity

Recitation records must reference:

- an existing student;
- an existing class/session as designed;
- a student belonging to the relevant class.

Validate recitation values.

Counts/scores must not accept:

- `NaN`
- infinity
- unexpected negative numbers
- arbitrary strings

Use appropriate integer/decimal constraints based on the final scoring model.

---

# 25. Input Normalization

Normalize only when normalization is intentional.

Examples:

- trim names
- normalize emails to lowercase when appropriate
- trim subject codes
- trim section names
- normalize optional empty strings to `null` when the database model uses nullable values

Do not silently mutate meaningful user content.

---

# 26. Data Exposure and Prisma `include`

Review every Prisma `include`.

Nested relations can accidentally expose more data than the route intends.

Prefer explicit `select` objects.

Example:

```ts
select: {
  id: true,
  firstName: true,
  lastName: true
}
```

Do not use broad relation includes just because they are convenient.

---

# 27. Delete Operations

Delete endpoints require special review.

Before deleting:

- authenticate;
- authorize;
- validate the resource ID;
- verify the resource exists;
- understand Prisma/database cascade behavior;
- check whether historical records must be preserved;
- remove dependent Cloudinary resources when appropriate.

Never implement destructive bulk deletion from unchecked client input.

---

# 28. Bulk Operations

Bulk endpoints must validate every item.

For operations such as:

- adding many students;
- generating many attendance sessions;
- updating attendance for many students;

validate:

- maximum item count;
- duplicate IDs inside the request;
- resource relationships;
- allowed values;
- transaction behavior;
- partial failure behavior.

Do not accept unlimited bulk payloads.

---

# 29. Request Body Limits

Configure Express body limits.

Do not accept arbitrarily large JSON payloads.

Example principle:

```ts
app.use(express.json({ limit: "..." }));
```

Choose an intentionally small limit appropriate for PALE API requests.

File uploads should use their own explicit size limits.

---

# 30. API Content Types

Require appropriate content types where applicable.

JSON endpoints should expect JSON.

Upload endpoints should accept only the intended multipart form type.

Do not parse arbitrary bodies unnecessarily.

---

# 31. CSRF Considerations

If authentication uses cookies, review CSRF protections.

Use appropriate combinations of:

- `SameSite`
- `Secure`
- `HttpOnly`
- origin checking
- CSRF tokens when needed

If authentication instead uses authorization headers, review token-storage and XSS risks.

Do not assume CORS alone is complete CSRF protection.

---

# 32. Cookie Security

If cookies are used for authentication in production:

- use `HttpOnly`;
- use `Secure`;
- configure `SameSite` intentionally;
- use an appropriate expiry;
- avoid storing unnecessary data in the cookie.

Never put passwords or sensitive user data directly into cookies.

---

# 33. Dependency Security

Before introducing a new backend dependency:

1. confirm it is actually needed;
2. prefer mature and actively maintained packages;
3. avoid duplicating functionality already available;
4. keep the dependency surface small;
5. consider known vulnerability exposure.

Follow YAGNI.

Do not add security libraries merely for appearance; configure and use them correctly.

---

# 34. No Security Theater

The agent MUST NOT claim that an endpoint is "secure" merely because:

- it uses TypeScript;
- it uses Prisma;
- it uses React;
- input fields exist in the frontend;
- the UI hides unauthorized actions;
- a schema exists but is never called;
- middleware exists but is not attached;
- a validator checks only part of the request.

Security controls must actually be executed on the request path.

---

# 35. Required Route Review

Whenever creating or modifying a route, explicitly review this flow:

```text
Request
  ↓
Request-size/content-type controls
  ↓
Authentication
  ↓
Authorization
  ↓
Zod validation
  ↓
Business-rule validation
  ↓
Database/service operation
  ↓
Safe field selection / serialization
  ↓
Response schema validation
  ↓
HTTP response
  ↓
Central error handler on failure
```

The precise ordering may differ when technically justified, but all applicable controls must exist.

---

# 36. Required Controller/Service Review

Controllers should remain thin.

Prefer:

```text
Route
→ middleware
→ validation
→ controller
→ service
→ Prisma/database
```

Do not place large amounts of security-sensitive database logic directly inside route registration files.

Business rules should be testable outside Express request/response objects where practical.

---

# 37. Output Validation Strategy

For endpoints with a defined response schema, follow this pattern conceptually:

```ts
const result = await serviceOperation();

const response = responseSchema.parse({
  success: true,
  data: result
});

return res.status(200).json(response);
```

If parsing a response fails, treat it as a server-side defect, not a client validation error.

Do not silently return malformed data.

For high-volume endpoints, if full runtime response validation is deliberately disabled in production for performance, this must be an explicit project decision and the response serializer/select must still guarantee a safe shape.

---

# 38. Error Response Validation

Error responses must also follow the project's error schema.

Do not let arbitrary thrown objects become API responses.

Map known failures to stable application error codes.

Examples:

- `VALIDATION_ERROR`
- `UNAUTHENTICATED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `UPLOAD_TOO_LARGE`
- `UNSUPPORTED_FILE_TYPE`
- `INTERNAL_SERVER_ERROR`

Do not send database-specific codes directly to users unless they are safely translated.

---

# 39. Testing Requirements

Security-sensitive backend changes should include tests when the project test setup supports them.

At minimum consider tests for:

- unauthenticated request rejected;
- unauthorized request rejected;
- malformed UUID rejected;
- invalid enum rejected;
- missing required field rejected;
- extra protected field cannot be mass-assigned;
- duplicate attendance rejected;
- student from another class rejected;
- duplicate generated session rejected;
- invalid date range rejected;
- oversized file rejected;
- unsupported file type rejected;
- password hash absent from response;
- stack trace absent from production error response;
- response matches schema;
- database operation rolls back on transactional failure.

Test failure paths, not only successful paths.

---

# 40. Security Review Before Completing Any Backend Task

Before presenting a backend change as complete, the agent must verify:

- [ ] All request inputs are runtime validated.
- [ ] Authentication is applied where required.
- [ ] Authorization is enforced server-side.
- [ ] No client-controlled role or permission is trusted.
- [ ] Prisma receives only validated and explicitly mapped data.
- [ ] No unsafe raw SQL is introduced.
- [ ] Database uniqueness/integrity constraints are considered.
- [ ] Multi-step writes use transactions where required.
- [ ] File uploads enforce type and 5 MB size limits.
- [ ] Cloudinary credentials remain server-only.
- [ ] Sensitive fields cannot appear in API output.
- [ ] Prisma queries use safe `select`/serialization.
- [ ] Successful responses have an intentional schema.
- [ ] Error responses have a safe schema.
- [ ] Production errors expose no stack traces.
- [ ] Status codes are correct.
- [ ] Pagination/bulk input has safe limits.
- [ ] Logs contain no credentials or secrets.
- [ ] CORS is restricted appropriately in production.
- [ ] Rate limiting is considered for abuse-prone endpoints.
- [ ] Environment variables are validated.
- [ ] Relevant failure-path tests are included or identified.
- [ ] No unrelated metadata or unnecessary abstractions are added.

---

# 41. Agent Behavior When Reviewing Existing Code

When asked to review backend code, do not only fix syntax errors.

Check for:

- missing validation;
- missing authentication;
- missing authorization;
- mass assignment;
- sensitive response leakage;
- insecure CORS;
- missing body limits;
- unsafe uploads;
- unsafe raw SQL;
- race conditions;
- duplicate-record risks;
- missing transactions;
- over-broad Prisma `include`;
- incorrect cascade deletion;
- incorrect status codes;
- exposed stack traces;
- unbounded queries;
- weak password handling;
- missing rate limits;
- inconsistent response shapes.

If a security problem exists, call it out clearly and fix it when the requested task permits.

Do not silently preserve insecure patterns for consistency.

---

# 42. Agent Behavior When Generating Code

Generated backend code must:

- use TypeScript correctly;
- avoid `any` unless there is a justified boundary;
- use explicit types for validated data;
- reuse existing project utilities when appropriate;
- avoid unnecessary abstractions;
- follow the existing project structure;
- remain readable for a junior developer;
- include only dependencies that are actually needed;
- avoid hard-coded test/demo data in production code;
- avoid hard-coded unrelated metadata;
- handle errors explicitly;
- preserve PALE domain rules.

Do not generate placeholder security checks that are never wired into the application.

---

# 43. Security Takes Priority Over Convenience

If a requested implementation conflicts with these rules, prefer the secure implementation and explain the conflict.

Examples:

Do not:

- bypass auth "just for now" on a production route;
- trust a role sent by the frontend;
- return `passwordHash` for debugging;
- disable validation to make an endpoint work;
- make CORS unrestricted in production to fix an origin issue;
- accept every upload type;
- expose secrets to the React application;
- use unsafe raw SQL because it is shorter.

---

# 44. Final Backend Change Report

When an AI agent finishes a meaningful backend change, it should summarize:

1. What changed
2. What input is validated
3. What authentication/authorization applies
4. What database constraints/business rules apply
5. What the endpoint can return
6. What sensitive data is excluded
7. What error cases are handled
8. What tests were added or should be run

Keep the report concise and specific to the change.

---

# 45. Definition of Done

A PALE backend task is complete only when:

- the requested functionality works;
- invalid input is rejected;
- unauthorized access is rejected;
- database integrity is preserved;
- sensitive data is not exposed;
- output has a deliberate validated shape;
- errors are safely handled;
- security controls are actually attached to the runtime path;
- relevant edge cases are covered;
- no unrelated complexity was introduced.

Security validation is part of implementation, not a separate optional cleanup step.
