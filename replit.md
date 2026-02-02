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
│       ├── graph.ts       # Microsoft Graph API for syncing enterprise apps
│       ├── upload.ts      # CSV upload for Amex transactions
│       ├── tools.ts       # Detected SaaS tools CRUD and deduplication
│       └── departments.ts # Department management and auto-assignment
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

## Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string (auto-set by Replit)
- `MICROSOFT_CLIENT_ID` - Azure AD app client ID
- `MICROSOFT_CLIENT_SECRET` - Azure AD app client secret
- `MICROSOFT_TENANT_ID` - Azure AD tenant ID (optional, defaults to 'common')

## Recent Changes
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
