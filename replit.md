# SaaS Spend Manager

## Overview
A SaaS spend management tool designed to detect spend risk early, route decisions to empowered team leads, and enforce outcomes before money is lost.

**Primary KPI**: % of renewal/trial decisions completed before billing date

## Project Structure
```
├── client/                 # React frontend (Vite)
│   ├── src/
│   │   ├── App.tsx        # Main application component with dashboard, tools, departments, connect tabs
│   │   ├── main.tsx       # React entry point
│   │   └── index.css      # Global styles
│   └── index.html         # HTML template
├── server/                 # Express backend
│   ├── index.ts           # Server entry point
│   ├── db/
│   │   └── index.ts       # PostgreSQL database connection & schema
│   └── routes/
│       ├── auth.ts        # Microsoft Entra OAuth for data source connections
│       ├── userAuth.ts    # User login/logout with Microsoft Entra OAuth
│       ├── demo.ts        # Demo mode with mock data seeding
│       ├── graph.ts       # Microsoft Graph API for syncing enterprise apps
│       ├── upload.ts      # CSV upload for Amex transactions
│       ├── tools.ts       # Detected SaaS tools CRUD and deduplication
│       ├── departments.ts # Department management and auto-assignment
│       ├── decisions.ts   # Decision workflow with risk scoring
│       └── notifications.ts # Email notifications with Resend + action tokens
├── shared/                 # Shared TypeScript types
│   └── types.ts           # Subscription, Decision interfaces
├── package.json           # Project dependencies
├── vite.config.ts         # Vite configuration
├── tsconfig.json          # TypeScript config (client)
└── tsconfig.server.json   # TypeScript config (server)
```

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL (Replit built-in)
- **Authentication**: Microsoft Entra (Azure AD) OAuth
- **File Processing**: Multer + csv-parse for Amex CSV uploads
- **Deduplication**: Fuse.js fuzzy matching

## Development
- Frontend runs on port 5000 (with Vite dev server)
- Backend API runs on port 3001
- API requests to `/api/*` are proxied to the backend

## Database Schema
### departments
- id, name, team_lead_email, team_lead_name

### data_sources
- id, type (microsoft_entra, amex_csv), name, status
- access_token, refresh_token, tenant_id, last_sync_at

### detected_tools
- id, name, vendor, normalized_name, category
- source_type, cost_monthly, billing_cadence
- department_id, owner_email, status
- is_duplicate, duplicate_of_id

### transactions
- id, data_source_id, transaction_date, description, amount
- vendor_raw, vendor_normalized, detected_tool_id

### users
- id, microsoft_id, email, name, tenant_id, created_at, last_login_at

### sessions
- id, user_id, token, expires_at, created_at

### subscriptions & decisions
- For future decision workflow implementation

## API Endpoints

### User Authentication
- `GET /api/user/me` - Get current user (if authenticated)
- `GET /api/user/login` - Initiate Microsoft Entra login
- `GET /api/user/callback` - OAuth callback for user login
- `POST /api/user/logout` - Logout and clear session

### Demo Mode
- `POST /api/demo/seed` - Seed database with 5 departments and 20 SaaS tools
- `POST /api/demo/login` - Login as demo user (no Microsoft credentials needed)

### Data Source Authentication
- `GET /api/auth/microsoft/status` - Check Microsoft connection status
- `GET /api/auth/microsoft/login` - Initiate Microsoft OAuth for data sync
- `GET /api/auth/microsoft/callback` - OAuth callback for data source
- `POST /api/auth/microsoft/disconnect` - Disconnect Microsoft data source

### Data Sources
- `POST /api/graph/sync-enterprise-apps` - Sync apps from Microsoft Entra
- `POST /api/upload/csv` - Upload Amex CSV statement
- `GET /api/upload/history` - Get upload history

### Tools
- `GET /api/tools` - List detected SaaS tools
- `GET /api/tools/stats` - Get dashboard statistics
- `POST /api/tools/deduplicate` - Run fuzzy deduplication
- `PATCH /api/tools/:id` - Update tool (assign department, etc.)
- `DELETE /api/tools/:id` - Delete a tool

### Departments
- `GET /api/departments` - List departments with stats
- `POST /api/departments` - Create department
- `PATCH /api/departments/:id` - Update department
- `DELETE /api/departments/:id` - Delete department
- `POST /api/departments/auto-assign` - Auto-assign tools based on category

### Decisions
- `GET /api/decisions` - List all tools with risk scores and decision status
- `GET /api/decisions/stats` - Decision workflow statistics
- `POST /api/decisions/:toolId` - Create/update a decision (approved/cancelled/under_review/pending)

### Notifications
- `POST /api/notifications/check` - Trigger notification check (sends emails for tools at 30/15/7 day thresholds)
- `GET /api/notifications/logs` - View notification history
- `GET /api/notifications/action/:token` - Token-based action endpoint (used from email links, no auth required)

## Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string (auto-set by Replit)
- `RESEND_API_KEY` - Resend email service API key (for sending notifications)
- `MICROSOFT_CLIENT_ID` - Azure AD app client ID
- `MICROSOFT_CLIENT_SECRET` - Azure AD app client secret
- `MICROSOFT_TENANT_ID` - Azure AD tenant ID (optional, defaults to 'common')

## Recent Changes
- 2026-02-21: Email notification workflow
  - Resend integration for sending HTML emails
  - Reminder tiers at 30, 15, and 7 days before renewal
  - Token-based action links in emails (approve/cancel/review without login)
  - Idempotent - skips already-notified tools and already-decided tools
  - notification_logs and email_action_tokens tables for tracking
  - Confirmation page shown when action is taken from email
- 2026-02-02: Added demo mode for testing without Microsoft credentials
  - "Try Demo Mode" button on login page
  - Seeds 5 departments and 20 sample SaaS tools
  - Creates demo user session automatically
- 2026-02-02: Added user login with Microsoft Entra ID
  - Users table and sessions table for authentication
  - Microsoft OAuth login flow with cookie-based sessions
  - Login page UI with "Sign in with Microsoft" button
  - User menu in sidebar with logout functionality
  - Protected routes require authentication
- 2026-02-02: Built SaaS Discovery & Inventory feature
  - Microsoft Entra OAuth integration for data sync
  - Amex CSV upload with transaction parsing
  - SaaS detection and categorization
  - Fuzzy deduplication with Fuse.js
  - Department management with auto-assignment
  - Dashboard with spend analytics
- 2026-02-01: Initial project setup with React + Express + PostgreSQL

## User Preferences
- Microsoft Entra for workspace integration
- Amex CSV upload (not Plaid) for MVP cost savings
- Team leads own subscriptions, not individual purchasers
