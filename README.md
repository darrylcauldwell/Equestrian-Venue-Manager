# Equestrian Venue Manager

A comprehensive yard management system for equestrian venues, handling arena bookings, horse management, staff scheduling, livery services, health & rehabilitation tracking, and community features.

## Overview

Equestrian Venue Manager (EVM) provides a complete digital solution for running an equestrian yard. From public arena bookings with payment processing to daily horse care, rehabilitation programs, and staff management, EVM brings all aspects of venue operations into one integrated system.

Built by equestrians for equestrians, EVM understands the unique workflows of professional yards - from managing complex turnout groups and companion relationships to tracking rehabilitation programs with insurance documentation.

The venue name and branding are fully configurable by administrators.

## Key Features

### Arena Booking System
- Calendar-based booking with real-time availability
- Public bookings with Stripe payment integration
- Free bookings for livery clients (auto-applied)
- Recurring booking support (weekly, fortnightly)
- Conflict detection and double-booking prevention
- Mobile-friendly booking interface

### Horse Management
- Complete horse profiles with photos, personality traits, and special requirements
- Stable assignment and tracking
- Companion preferences for turnout planning (preferred, compatible, incompatible)
- Detailed notes for handling preferences and quirks
- Emergency contact information per horse
- Stay-in request workflow for owners

### Comprehensive Health Tracking
- **Farrier records** with next-due dates and compliance alerts
- **Dentist records** with treatment history
- **Vaccination records** with upcoming due reminders
- **Worming program** tracking with rotation schedules
- **Weight tracking** with trend graphs and target ranges
- **Body condition scoring** (BCS 1-9 scale) with history
- **Saddle inventory** per horse with type, brand, model, and serial number tracking
- **Saddle fit records** linked to specific saddles with fitter recommendations
- **Physiotherapy records** with practitioner details, treatment types, areas treated, and recommendations
- Automated health calendar showing all upcoming due dates

### Rehabilitation & Care Plans
- **Custom care plan templates** for rehabilitation and special needs horses
- **Rehab program management** with customizable phases
- Daily task auto-generation from care plan schedules
- Progress tracking and plan adjustments over time
- **Wound care documentation** with photo uploads and healing progression
- **Medication logging** with dosage, frequency, and administration tracking
- **Health observations** for vital signs and daily assessments
- Staff task integration with care plan requirements
- **Insurance statement generation** (JSON and PDF) for rehab costs
- Mark services and livery packages as insurance-claimable

### Turnout Management
- Daily turnout board with drag-and-drop field assignments
- Companion relationship validation (prevents incompatible pairings)
- Group creation with automatic compatibility checking
- Turn-out and bring-in status tracking with timestamps
- Field capacity management
- Weather-aware turnout recommendations

### Livery Services
- Configurable service catalog (exercise, grooming, schooling, clipping, third-party)
- Service request workflow with quote, approval, and scheduling
- **Pro-rata billing** for mid-month starts
- Account ledger with full transaction history
- **Automated monthly billing** with package charges
- **PDF invoice generation** with itemized breakdowns
- Outstanding balance tracking and payment recording
- Insurance-claimable service flagging for rehab horses

### Holiday Livery
- Public request form for temporary stays (days to weeks)
- Admin triage workflow with approve/reject/quote process
- Automatic user account and horse record creation on approval
- Stable assignment during approval process
- Weekly-rate pricing (charged per day, pro-rated)
- Full access to livery features (feed, medication, rehab)
- Integrated with monthly billing system

### Staff Operations
- **Shift scheduling** with role-based assignments
- **Digital timesheets** with clock-in/out and break tracking
- **Payroll integration** ready with exportable timesheet data
- **Holiday request workflow** with approval chain
- **Annual leave tracking** with entitlement, taken, pending, upcoming, and remaining balances
- **Leave overview dashboard** with calendar view, pending approvals, and staff balances
- **Unplanned absence recording** (sickness, emergency, no-show)
- Per-staff absence history with return tracking
- Daily task assignment and completion tracking
- **Payroll information management** with bank details, tax status, NI number, and hourly rates

### Staff Appreciation
- **Send Thanks** feature for livery owners to thank staff members
- **Optional tipping** with direct Stripe payments to staff
- **Thanks notification popup** alerts staff of new appreciation messages
- **Thanks history** for staff to view all received messages and tips
- Tips automatically recorded as payroll adjustments

### Staff Profiles
- **Comprehensive personnel records** with personal details and employment information
- Date of birth and start date tracking for milestone alerts
- **Qualification tracking** (BHS stages, first aid, licenses, certifications)
- DBS check date and certificate number recording
- Personal contact details and emergency contact information
- Home address storage for HR records
- **Staff bio/description** field for yard introductions
- Admin notes for confidential personnel information
- **Birthday and work anniversary alerts** for admin dashboard
- Self-service profile editing for staff members

### Health & Safety Risk Assessments
- **Risk assessment document management** by category (general workplace, horse handling, yard environment, fire & emergency, biosecurity, first aid, PPE & manual handling)
- Version-controlled content with automatic re-acknowledgement on updates
- **Staff acknowledgement tracking** with digital signatures
- Audit trail of all staff completions
- **Induction requirement flagging** for new starters
- **Annual refresh scheduling** with configurable review periods
- **Review triggers** for incidents, changes, or new hazard identification
- Role-based assignment (require specific roles to acknowledge)
- Compliance overview dashboard showing acknowledgement status
- **BHS inspection readiness** tracking

### Yard Tasks & Duties
- **Smart task generation** from medication schedules and wound care
- Daily feed duties assignment by horse
- Task priority levels and due times
- Staff workload visibility
- Completion tracking with timestamps

### Contract Management
- **Contract templates** with rich text editor for livery agreements, employment contracts, and custom documents
- **Version control** with full change history and diff visualization
- **DocuSign integration** for legally-binding electronic signatures
- Embedded signing experience (users sign within the app)
- **Automatic PDF generation** from HTML templates using WeasyPrint
- Signature request workflow with admin controls
- **Bulk re-signing** when contract terms change with change highlighting
- Signed PDF archival with download access
- Contract status tracking (pending, sent, signed, declined, voided)
- User-facing "My Contracts" page for viewing and signing pending documents

### Training & Clinics
- Coach clinic proposals with approval workflow
- Participant registration with slot limits
- Waiting list functionality with auto-promotion
- Prerequisite requirements (membership, experience level)
- Integrated billing to client accounts
- Social media sharing for event promotion

### Lessons
- **Individual and group lesson booking** with time slot selection
- Coach assignment and calendar management
- **Lesson request workflow** with admin triage
- Recurring lesson support for regular bookings
- Lesson history and progress tracking
- Integration with arena booking system

### Community Features
- Digital noticeboard for announcements
- Items for sale/wanted marketplace
- Group hack organization with participant management
- **Yard visit scheduling** (farrier, vet, dentist, physio)
- Visit coordination across multiple horses

### Professional Directory
- Third-party professional database (farriers, vets, physios, instructors)
- Contact details and specializations
- Preferred professionals per horse
- Visit history tracking

### Land Management
- **Government grant tracking** for Countryside Stewardship, SFI, environmental schemes
- Application deadlines, compliance requirements, and payment schedules
- **Land feature inventory** (hedgerows, trees, fences, gates, ponds, water troughs)
- TPO (Tree Preservation Order) tracking for protected trees
- **Maintenance scheduling** with overdue alerts and logging
- **Water trough management** with manual fill tracking and reminders
- **Electric fence monitoring** with voltage checks and working status
- **Flood warning integration** via Environment Agency API
- Field-level flood risk assessment with evacuation notes
- **Field utilization analytics** with rotation suggestions
- Link grants to specific fields and features for compliance

### Smart Integrations
- **Weather forecasting** via Open-Meteo API with 7-day outlook
- **BHS-based smart rugging recommendations** based on temperature, wind, and rain
- **Environment Agency river level monitoring** for flood awareness
- **Environment Agency flood monitoring** with configurable warning thresholds
- **DocuSign eSignature** for legally-binding contract signatures
- Social sharing for events and clinics
- PDF generation for invoices, statements, and contracts

### Security & Emergency Features
- **Gate codes** management with rotation scheduling
- **Key safe** location and code tracking
- **What3Words** integration for emergency location sharing
- Emergency contact quick-access per horse
- Staff emergency contact information

### Administrative Tools
- User management with role-based access control
- Venue configuration and custom branding (name, logo, colors)
- Stable management with capacity tracking
- **Feature flag system** for enabling/disabling capabilities with dependency management
- **Compliance calendar** showing all renewals (insurance, memberships, certifications)
- **Database backup and restore** functionality
- Demo data mode for training and testing
- Event triage dashboard for service requests and lessons
- System-wide notification management
- SMS/WhatsApp notification support (configurable)
- **Arena usage analytics** with booking patterns and utilization reports

## User Roles

| Role | Description | Key Capabilities |
|------|-------------|------------------|
| **Anonymous** | Public visitors | View venue info, book arenas with payment, request holiday livery |
| **Public** | Registered users | View and register for clinics, join waiting lists |
| **Livery** | Horse owners | Full horse management, free arena access, service requests, account/billing, health records, contract signing, **send thanks and tips to staff** |
| **Coach** | External trainers | Propose clinics, manage participant lists, view assigned horses |
| **Staff** | Yard employees | Tasks, feed duties, turnout board, timesheets, **leave management**, health observations, employment contract signing, **view received thanks and tips** |
| **Admin** | System administrators | Full access including billing, staff management, **leave approvals**, contract management, compliance, backups |

Livery clients with yard staff duties have combined access to both livery and staff features.

## Use Cases

### Professional Livery Yards
EVM streamlines day-to-day operations for yards offering full or part livery:
- Automated monthly billing with package charges and service add-ons
- **Digital contract signing** with DocuSign for livery agreements
- Version-controlled contracts with automatic re-signing when terms change
- Clear communication via noticeboard and visit scheduling
- Transparent account statements for clients
- Pro-rata calculations for mid-month arrivals

### Rehabilitation & Recovery Centers
Yards specializing in horse rehabilitation benefit from:
- Comprehensive rehab program tracking with daily task schedules
- Wound care documentation with photo progression
- Medication administration logging with staff accountability
- **Insurance statement generation** for client reimbursement claims
- Body condition scoring and weight tracking for recovery monitoring

### Competition Yards & Training Centers
Support for high-performance facilities:
- Arena booking with recurring lesson slots
- Coach clinic management with participant registration
- Professional visit coordination (physios, vets, farriers)
- Health compliance tracking for competition requirements

### Holiday Livery Operations
For yards offering temporary care:
- Public-facing request forms with admin approval workflow
- Automatic client onboarding on approval
- Full integration with billing and care management
- Short-stay and extended holiday support

### Staff Management
Reduce administrative burden:
- Digital timesheets replacing paper records
- **Employment contract management** with DocuSign electronic signatures
- Holiday request workflow with balance tracking
- Unplanned absence documentation
- Task assignment ensuring nothing is missed
- Feed duty scheduling with completion tracking

## BHS Accreditation Support

Equestrian Venue Manager is designed to support yards seeking or maintaining **British Horse Society (BHS) Approval**. The following table maps BHS administrative requirements to system features:

### Key Documents

| BHS Requirement | EVM Feature | Status |
|-----------------|-------------|--------|
| **Written contracts/livery agreements** | Contract Management with templates, DocuSign electronic signatures, version control | ✅ Fully Supported |
| **Grassland management plans** | Land Management with field rotation tracking, grazing schedules, utilization analytics | ✅ Fully Supported |
| **Staff qualifications** | Staff Profiles with BHS stages, first aid, licenses, certifications, DBS checks | ✅ Fully Supported |
| **Training logs & CPD records** | Staff Profiles qualifications array (can record CPD); consider future enhancement for detailed training log | ⚠️ Basic Support |
| **Staff rotas** | Staff Management with shift scheduling and role assignments | ✅ Fully Supported |
| **Induction checklists** | Risk Assessments with "Required for Induction" flag - ensures new starters acknowledge all safety documents | ✅ Fully Supported |

### Routine Processes

| BHS Requirement | EVM Feature | Status |
|-----------------|-------------|--------|
| **Daily feed charts** | Feed Management with per-horse feed schedules, daily duties board, completion tracking | ✅ Fully Supported |
| **Vaccination records** | Health Tracking with vaccination history, due date reminders, compliance alerts | ✅ Fully Supported |
| **Worming records** | Worm Count management with rotation schedules and due dates | ✅ Fully Supported |
| **Farrier visit records** | Health Tracking with farrier history, next-due dates, compliance calendar | ✅ Fully Supported |
| **Feed/bedding inventory** | Not currently implemented - yards should maintain separate inventory records | ❌ Gap |
| **BHS inspection preparation** | Risk Assessments (annual review scheduling), Compliance Calendar, audit trails | ✅ Fully Supported |
| **Facility management** (stables, arenas, fencing) | Stables, Arenas, Land Management with fence/gate tracking, maintenance schedules | ✅ Fully Supported |
| **Public liability insurance** | Compliance Calendar for tracking renewals; insurance documents stored externally | ⚠️ Basic Support |
| **Emergency plans** | Security features with evacuation notes, vet contacts, What3Words location, emergency contacts | ✅ Fully Supported |

### Additional BHS-Aligned Features

- **Weather-based rugging recommendations** using BHS guidelines
- **Horse companion tracking** for welfare-aware turnout management
- **Body condition scoring** (BCS 1-9 scale) for welfare monitoring
- **Wound care documentation** with photo progression
- **Rehabilitation program tracking** with daily task generation
- **Flood risk monitoring** via Environment Agency integration

### Potential Enhancements

For yards requiring full BHS compliance, the following features could be considered for future development:

1. **Feed & Bedding Inventory Management** - Stock levels, reorder alerts, supplier tracking
2. **Detailed CPD/Training Log** - Course attendance, certificates, expiry tracking per staff member
3. **Insurance Document Storage** - Upload and track policy documents with expiry reminders

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
| [Database Schema](./docs/DATABASE_SCHEMA.md) | Database schema and entity relationships |
| [User Acceptance Tests](./docs/USER_ACCEPTANCE_TESTS.md) | Comprehensive feature test scripts |

## Screenshots

*Coming soon*

## License

Copyright (c) 2025 Darryl Cauldwell. All Rights Reserved. See [LICENSE](LICENSE) for details.
