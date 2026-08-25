<!-- Introduces PALE Records and documents its local development workflow. -->

# PALE Records

PALE Records is a class record management system for organizing classes, student enrollments, weekly schedules, and attendance records through an authenticated academic workspace.

## Features

- Secure administrator sign-in with cookie-based sessions
- Class creation, editing, scheduling, and archiving
- Student records with multi-class enrollment
- Persisted attendance sessions, statuses, and remarks

## Tech stack

- **Client:** React, TypeScript, Vite, Tailwind CSS
- **Server:** Express, TypeScript, Zod
- **Database:** PostgreSQL, Prisma ORM

## Project structure

```text
PALE/
├── client/   # React web application
└── server/   # Express API, Prisma schema, and migrations
```

## Local setup

### Prerequisites

- Node.js and npm
- A PostgreSQL database

### 1. Configure and run the server

```powershell
cd server
npm install
```

Create `server/.env.local` using `server/.env.example` as a starting point, then provide the required values:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE
AUTH_SECRET=replace-with-at-least-32-characters
CLIENT_ORIGIN=http://localhost:5173

ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace-with-a-secure-password
ADMIN_FIRST_NAME=Admin
ADMIN_LAST_NAME=User
```

Apply the existing migrations, create the administrator account, and start the API:

```powershell
npx prisma migrate deploy
npm run db:seed
npm run dev
```

The server runs at `http://localhost:5000` by default.

### 2. Run the client

In a second terminal:

```powershell
cd client
npm install
npm run dev
```

Open `http://localhost:5173`. During local development, Vite proxies `/api` requests to the Express server.

## Available checks

```powershell
# Client
cd client
npm run lint
npm run build

# Server
cd ..\server
npm test
npm run build
```
