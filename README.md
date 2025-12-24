# Equestrian Venue Manager

A comprehensive yard management system for equestrian venues, handling arena bookings, horse management, staff scheduling, livery services, and community features.

## Overview

Equestrian Venue Manager (EVM) provides a complete digital solution for running an equestrian yard. From public arena bookings with payment processing to daily horse care and staff management, EVM brings all aspects of venue operations into one integrated system.

The venue name and branding are fully configurable by administrators.

## Key Features

### Arena Booking System
- Calendar-based booking with availability view
- Public bookings with Stripe payment integration
- Free bookings for livery clients
- Recurring booking support
- Conflict detection and management

### Horse Management
- Complete horse profiles with photos and personality traits
- Health records tracking (farrier, dentist, vaccinations, worming)
- Feed management with meal schedules
- Companion preferences for turnout planning
- Stay-in request workflow

### Turnout Management
- Daily turnout board with field assignments
- Companion relationship tracking (preferred/compatible/incompatible)
- Group creation with compatibility validation
- Turn-out and bring-in status tracking

### Livery Services
- Service request system (exercise, grooming, clipping)
- Third-party professional coordination
- Rug management and cleaning services
- Account ledger with balance tracking
- Automated monthly billing with pro-rata calculation
- Invoice generation and tracking

### Holiday Livery
- Public request form for temporary stays (days to weeks)
- Admin triage workflow (approve/reject requests)
- Automatic user account and horse record creation on approval
- Stable assignment during approval
- Weekly-rate pricing (charged per day)
- Full access to livery features (feed, medication, rehab)
- Integrated with monthly billing system

### Staff Operations
- Shift scheduling and management
- Digital timesheets with payroll integration
- Holiday request and approval workflow
- Sick leave tracking
- Task assignment and tracking
- Daily feed duties and yard tasks

### Training & Clinics
- Coach clinic proposals with approval workflow
- Participant registration and slot management
- Waiting list functionality
- Integrated billing

### Community Features
- Digital noticeboard for announcements
- Items for sale/wanted
- Group hack organization
- Yard visit scheduling (farrier, vet, dentist)

### Smart Integrations
- Weather forecasting via Open-Meteo API
- BHS-based smart rugging recommendations
- Environment Agency river level monitoring
- Social sharing for events and clinics

### Health & Rehabilitation
- Medication logging and tracking
- Wound care documentation with photo upload
- Rehabilitation program management
- Health observations and vital signs
- Farrier, dentist, vaccination, and worming records

### Administrative Tools
- User management with role-based access
- Venue configuration and branding
- Stable management (assignment and tracking)
- Compliance calendar for renewals
- Database backup and restore
- Demo data mode for training
- Event triage for service requests and lessons

## User Roles

| Role | Description |
|------|-------------|
| **Anonymous** | Public visitors - view venue info, book arenas with payment |
| **Public** | Registered users - view and register for clinics |
| **Livery** | Horse owners - horse management, free arena access, service requests |
| **Coach** | External trainers - propose and manage training clinics |
| **Staff** | Yard employees - tasks, feed duties, turnout, timesheets |
| **Admin** | System administrators - full access to all features |

Livery clients with yard staff duties have combined access to both livery and staff features.

## Tech Stack

- **Backend**: FastAPI (Python 3.11+) with SQLAlchemy ORM
- **Frontend**: React 18 with TypeScript
- **Database**: PostgreSQL 15
- **Authentication**: JWT tokens with refresh mechanism
- **Payments**: Stripe Checkout integration
- **Infrastructure**: Docker Compose, Traefik reverse proxy

## Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](./docs/getting-started.md) | Local development setup guide |
| [Deployment Guide](./docs/deployment-digitalocean.md) | Production deployment on DigitalOcean |
| [API Reference](./docs/API_REFERENCE.md) | Complete REST API documentation |
| [User Acceptance Tests](./docs/USER_ACCEPTANCE_TESTS.md) | Comprehensive feature test scripts |
| [Codebase Optimization](./docs/CODEBASE_OPTIMIZATION.md) | Code quality and performance notes |

## Screenshots

*Coming soon*

## License

Copyright (c) 2025 Darryl Cauldwell. All Rights Reserved. See [LICENSE](LICENSE) for details.
