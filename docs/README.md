# Equestrian Venue Manager - Documentation

## Overview

Documentation for the Equestrian Venue Manager yard management system.

---

## Documents

| Document | Description |
|----------|-------------|
| [getting-started.md](./getting-started.md) | Local development setup and quick start guide |
| [deployment-digitalocean.md](./deployment-digitalocean.md) | Step-by-step guide to deploy on DigitalOcean |
| [API_REFERENCE.md](./API_REFERENCE.md) | Complete REST API endpoint documentation |
| [USER_ACCEPTANCE_TESTS.md](./USER_ACCEPTANCE_TESTS.md) | Comprehensive test script for validating all UI functionality by role |
| [CODEBASE_OPTIMIZATION.md](./CODEBASE_OPTIMIZATION.md) | Code quality analysis and optimization notes |

---

## User Roles

The system supports the following roles:

| Role | Description | Key Capabilities |
|------|-------------|------------------|
| Anonymous | Public visitors | View venue info, book arenas (with payment), view clinics |
| Public | Registered bookers | View clinics, manage clinic registrations |
| Livery | Horse owners | Horse management, services, turnout requests, free arena access |
| Coach | External coaches | Propose and manage training clinics |
| Staff | Yard employees | Tasks, feed duties, turnout board, timesheets |
| Admin | System admin | Full access to all features and configuration |

Note: Livery users with `is_yard_staff` flag also have access to staff features.

---

## Key Features

- **Arena Booking** - Calendar-based booking with Stripe payment integration
- **Training Clinics** - Coach proposal workflow, participant registration, slot management
- **Horse Management** - Health records, feed management, personality traits
- **Health & Rehabilitation** - Medication logging, wound care, rehab programs, vital signs
- **Service Requests** - Exercise, grooming, third-party service coordination
- **Turnout Management** - Daily turnout board, companion tracking, field assignments
- **Staff Management** - Shifts, timesheets, holiday requests, absence tracking, tasks
- **Compliance Calendar** - Track venue compliance items and renewals
- **Billing** - Automated monthly livery billing with pro-rata calculation, invoice generation
- **Holiday Livery** - Public request form, admin approval workflow, weekly pricing
- **Stable Management** - Stable assignment and tracking
- **Professional Directory** - Farrier, vet, dentist, and other service provider contacts
- **Community Features** - Noticeboard, items for sale, group hacks, yard visits
- **Backup System** - Database backup and restore functionality

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.1 | December 2025 | Added Holiday Livery and Monthly Billing features |
| 2.0 | December 2025 | Simplified to UAT-focused documentation |
| 1.0 | December 2025 | Initial documentation release |
