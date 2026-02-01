# SaaS Spend Manager

## Overview
A SaaS spend management tool designed to detect spend risk early, route decisions to empowered team leads, and enforce outcomes before money is lost.

**Primary KPI**: % of renewal/trial decisions completed before billing date

## Project Structure
```
├── client/                 # React frontend (Vite)
│   ├── src/
│   │   ├── App.tsx        # Main application component
│   │   ├── main.tsx       # React entry point
│   │   └── index.css      # Global styles
│   └── index.html         # HTML template
├── server/                 # Express backend
│   ├── index.ts           # Server entry point
│   └── db/
│       └── index.ts       # PostgreSQL database connection & schema
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
- **ORM**: Drizzle ORM (ready for use)

## Development
- Frontend runs on port 5000 (with Vite dev server)
- Backend API runs on port 3001
- API requests to `/api/*` are proxied to the backend

## Database Schema
### subscriptions
- id, name, vendor, cost_monthly, renewal_date
- owner_email, team_lead_email
- status, usage_score, risk_level
- created_at, updated_at

### decisions
- id, subscription_id, decision_type
- decided_by, decision_date, notes, status

## Recent Changes
- 2026-02-01: Initial project setup with React + Express + PostgreSQL

## User Preferences
- None recorded yet
