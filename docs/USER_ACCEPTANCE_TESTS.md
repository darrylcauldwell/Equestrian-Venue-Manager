# User Acceptance Test Script

This document provides test scenarios for each user role to verify all UI functionality works correctly.

---

## Table of Contents

1. [Anonymous (Public Website)](#1-anonymous-public-website)
2. [Public Role (Arena/Clinic Bookers)](#2-public-role-arenaclinic-bookers)
3. [Livery Role](#3-livery-role)
4. [Coach Role](#4-coach-role)
5. [Staff Role (Yard Staff)](#5-staff-role-yard-staff)
6. [Admin Role](#6-admin-role)

---

## 1. Anonymous (Public Website)

**User Profile**: Unauthenticated visitor browsing the public website

### 1.1 Home Page
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| ANON-01 | Navigate to home page | Displays venue name, tagline, and weather widget | |
| ANON-02 | View welcome section | Shows intro text about livery facility | |
| ANON-03 | Click "Contact Us" CTA | Navigates to Contact page | |

### 1.2 Navigation
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| ANON-04 | Verify header navigation links | Shows: Home, Clinics, Livery Services, Book Arena, Contact, Login | |
| ANON-05 | Verify footer content | Displays venue name, address, contact details, quick links | |
| ANON-06 | Click Login link | Navigates to login page | |

### 1.3 Contact Page
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| ANON-07 | View contact page | Displays venue contact details | |
| ANON-08 | View address | Shows street, town, county, postcode | |
| ANON-09 | View what3words | Shows what3words link (if configured) | |
| ANON-10 | View phone number | Shows clickable phone link | |
| ANON-11 | View email address | Shows clickable email link | |

### 1.4 Livery Services Page
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| ANON-12 | View livery page | Shows page title and intro text | |
| ANON-13 | View livery packages | Displays all active packages with prices | |
| ANON-14 | View package details | Each package shows: name, price, description, features | |
| ANON-15 | Identify featured package | Featured package is visually highlighted | |
| ANON-16 | View CTA section | Shows "Contact Us" call-to-action | |

### 1.5 Arena Booking Page (Public)
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| ANON-17 | View booking page | Shows title, pricing info (£25/hour), arena selector | |
| ANON-18 | Select an arena | Dropdown shows all active arenas | |
| ANON-19 | View arena details | Shows arena description, size, surface, lighting, jumps | |
| ANON-20 | View calendar | Calendar displays existing bookings (blocked times) | |
| ANON-21 | Select time slot | Opens booking form with time details | |
| ANON-22 | View price calculation | Form shows calculated price based on duration | |
| ANON-23 | Fill booking form | Form requires: title, name, email; optional: description, phone | |
| ANON-24 | Submit booking (new email) | Creates booking, auto-creates PUBLIC account, redirects to payment | |
| ANON-25 | Submit booking (existing email) | Creates booking linked to existing account, redirects to payment | |
| ANON-26 | Complete payment | Shows success message with account credentials (if new account) | |
| ANON-27 | View account credentials | Success page shows username and temporary password | |
| ANON-28 | Click "Log In Now" | Navigates to login page | |
| ANON-29 | View login prompt | Shows link to login for registered users | |

### 1.6 Events & Clinics Page (Public)
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| ANON-30 | View events & clinics page | Shows upcoming and past tabs | |
| ANON-31 | View upcoming events/clinics | Lists approved events/clinics (no status badge shown) | |
| ANON-32 | View event/clinic details | Shows: coach name, discipline, dates, times, prices (no status or spaces info) | |
| ANON-33 | Filter by discipline | Dropdown filters by discipline type | |
| ANON-34 | View past events/clinics | Shows completed events/clinics for reference | |
| ANON-35 | Submit event/clinic request | Opens form to propose a new event/clinic | |
| ANON-36 | Fill request form | Form requires: coach name, email, phone, discipline, date | |
| ANON-37 | Submit proposal | Shows success message | |
| ANON-38 | Register for event/clinic | Prompts to login/register to sign up | |

### 1.7 Authentication
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| ANON-39 | View login page | Shows username and password fields | |
| ANON-40 | Login with valid credentials | Redirects to dashboard | |
| ANON-41 | Login with invalid credentials | Shows error message | |
| ANON-42 | Login with temp password | Prompts to change password on first login | |
| ANON-43 | View register link | Login page has link to register | |
| ANON-44 | Register new account | Creates account and redirects to login | |

### 1.8 Holiday Livery Request Page (Public)
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| ANON-45 | View holiday livery page | Shows request form and pricing information | |
| ANON-46 | View weekly rate | Displays weekly rate for holiday livery | |
| ANON-47 | Fill request form | Form requires: guest name, email, phone, horse details, dates | |
| ANON-48 | Enter horse details | Form accepts: horse name, breed, age, colour, gender | |
| ANON-49 | Add special requirements | Can add special requirements and message | |
| ANON-50 | Submit request | Shows confirmation with submission status | |
| ANON-51 | View confirmation | Displays confirmation message with submitted dates | |

---

## 2. Public Role (Arena/Clinic Bookers)

**User Profile**: User who created an account via public arena booking or clinic registration (role: public)

### 2.1 Navigation
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| PUB-01 | Verify navigation menu | Shows: Book Arena, My Bookings, Events & Clinics, My Registrations | |
| PUB-02 | View user menu | Shows username, Settings, Logout options | |

### 2.2 Book Arena
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| PUB-03 | Access Book Arena | Navigates to arena booking calendar | |
| PUB-04 | Create new booking | Opens booking form (linked to account automatically) | |
| PUB-05 | Submit booking | Creates booking and redirects to payment | |

### 2.3 My Bookings
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| PUB-06 | View My Bookings page | Shows upcoming and past bookings sections | |
| PUB-07 | View upcoming bookings | Lists future bookings with arena, date, time | |
| PUB-08 | View past bookings | Lists completed bookings | |
| PUB-09 | Cancel booking | Can cancel own future booking | |
| PUB-10 | View payment status | Shows payment status for each booking | |

### 2.4 Events & Clinics
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| PUB-11 | View events & clinics page | Shows upcoming events and clinics | |
| PUB-12 | Register for an event/clinic | Opens registration form | |
| PUB-13 | Fill registration form | Form accepts: horse details, phone, preferred time, notes | |
| PUB-14 | Select lesson type (mixed format) | For clinics offering both, shows Private/Group selector with prices | |
| PUB-15 | Enter grouping preferences | When Group selected, notes placeholder prompts for grouping preferences | |
| PUB-16 | Submit registration | Shows success confirmation | |

### 2.5 My Registrations
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| PUB-17 | View my registrations | Lists all event/clinic registrations | |
| PUB-18 | View registration details | Shows: event/clinic name, date, slot (if assigned), lesson type | |
| PUB-19 | View pending status | Shows "Pending" for unconfirmed registrations | |
| PUB-20 | View confirmed status | Shows slot time/group when assigned | |

### 2.6 Account
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| PUB-21 | Access change password | Can change password via Settings link | |
| PUB-22 | Logout | Logs out and returns to public site | |

---

## 3. Livery Role

**User Profile**: Livery client with horses stabled at the venue (role: livery)

### 3.1 Navigation
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| LIV-01 | Verify navigation menu | Shows: Book Arena, Clinics, My Horses dropdown, Account, Info dropdown | |
| LIV-02 | My Horses dropdown | Shows: Horses, Turnout Requests, Services | |
| LIV-03 | Info dropdown | Shows: Noticeboard, Directory, Security | |
| LIV-04 | Yard dropdown (if staff) | Shows: Tasks, Feed Duties, Turnout Board, Timesheet | |

### 3.2 Book Arena
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| LIV-05 | View booking calendar | Shows week view with existing bookings | |
| LIV-06 | Select arena | Can filter by arena | |
| LIV-07 | Create booking | Opens booking form | |
| LIV-08 | Fill booking form | Form requires: title, horse, start/end times | |
| LIV-09 | Submit booking | Creates booking (free for livery clients) | |
| LIV-10 | Set "open to share" | Can mark booking as open to share | |
| LIV-11 | View my bookings | Can navigate to my bookings list | |
| LIV-12 | Cancel own booking | Can cancel own future bookings | |

### 3.3 Clinics
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| LIV-13 | View upcoming clinics | Lists approved upcoming clinics | |
| LIV-14 | Register for clinic | Opens registration form with horse selection | |
| LIV-15 | Select horse | Dropdown shows user's horses | |
| LIV-16 | Fill registration | Form requires: horse or name, phone | |
| LIV-17 | Submit registration | Creates registration successfully | |
| LIV-18 | View my registrations | Shows all clinic registrations with status | |

### 3.4 My Horses
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| LIV-19 | View horses list | Shows all horses owned by user | |
| LIV-20 | Add new horse | Opens horse creation form | |
| LIV-21 | Fill horse details | Form accepts: name, colour, birth year, passport name | |
| LIV-22 | Set personality traits | Can set farrier, dentist, clipping, handling traits | |
| LIV-23 | Save horse | Creates horse successfully | |
| LIV-24 | Edit horse | Can modify horse details | |
| LIV-25 | View health records link | Can navigate to horse health records | |
| LIV-26 | View feed management link | Can navigate to horse feed management | |

### 3.5 Horse Health Records
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| LIV-27 | View health records | Shows tabs for: Farrier, Dentist, Vaccinations, Worming | |
| LIV-28 | Add farrier record | Creates farrier visit record | |
| LIV-29 | Add dentist record | Creates dentist visit record | |
| LIV-30 | Add vaccination record | Creates vaccination record with type | |
| LIV-31 | Add worming record | Creates worming treatment record | |
| LIV-32 | View next due dates | Shows upcoming due dates for each type | |
| LIV-33 | Edit/delete records | Can modify own records | |

### 3.6 Horse Feed Management
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| LIV-34 | View feed requirements | Shows morning/evening feed, supplements | |
| LIV-35 | Edit feed requirements | Can update feed instructions | |
| LIV-36 | View feed additions | Lists temporary feed additions | |
| LIV-37 | Request feed addition | Creates request for temporary supplement | |
| LIV-38 | View supply alerts | Shows any feed supply alerts | |

### 3.7 Turnout Requests
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| LIV-39 | View turnout requests | Lists requests for each horse | |
| LIV-40 | Create stay-in request | Opens request form | |
| LIV-41 | Select horse and date | Form shows horse dropdown and date picker | |
| LIV-42 | Submit request | Creates pending turnout request | |
| LIV-43 | View request status | Shows pending/approved/declined status | |
| LIV-44 | Cancel own request | Can cancel pending requests | |

### 3.8 Services
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| LIV-45 | View service catalog | Lists available services by category | |
| LIV-46 | Request service | Opens service request form | |
| LIV-47 | Select horse | Form shows horse dropdown | |
| LIV-48 | Set preferred date/time | Can select date and time preference | |
| LIV-49 | Submit request | Creates service request | |
| LIV-50 | View my requests | Shows pending, scheduled, completed requests | |
| LIV-51 | Cancel pending request | Can cancel unscheduled requests | |

### 3.9 My Account
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| LIV-52 | View account balance | Shows current balance (credit/debit) | |
| LIV-53 | View transaction history | Lists recent transactions | |
| LIV-54 | View transaction details | Each shows: date, type, amount, description | |
| LIV-55 | View pending charges | Shows unbilled service charges | |

### 3.10 Information
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| LIV-56 | View noticeboard | Shows pinned and regular notices | |
| LIV-57 | Filter notices | Can filter by category | |
| LIV-58 | View notice detail | Shows full notice content | |
| LIV-59 | View professional directory | Lists professionals by category | |
| LIV-60 | Filter professionals | Can filter by category | |
| LIV-61 | View professional details | Shows contact info, services, qualifications | |
| LIV-62 | View security info | Shows gate code, key safe, security details | |

---

## 4. Coach Role

**User Profile**: External coach who proposes and runs events/clinics (role: coach)

### 4.1 Navigation
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| COACH-01 | Verify navigation menu | Shows: My Clinics, Arena Schedule, Noticeboard, Directory | |

### 4.2 My Events & Clinics
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| COACH-02 | View my events/clinics | Shows all proposals in all states with status badges and spaces/bookings count | |
| COACH-03 | View status badges | Cards show status badge (Pending, Approved, Rejected, etc.) | |
| COACH-04 | View rejection reason | Rejected cards show rejection reason/comments from admin | |
| COACH-05 | View event/clinic details | Detail modal shows Status & Review section with full feedback | |
| COACH-06 | Submit new event/clinic | Opens proposal form (pre-filled with coach details) | |
| COACH-07 | Fill proposal details | Form shows: discipline, dates, format, pricing | |
| COACH-08 | Submit proposal | Creates pending request | |
| COACH-09 | View approved event/clinic | Shows participant list and slot assignments | |
| COACH-10 | Edit pending proposal | Can modify pending proposals | |

### 4.3 Arena Schedule
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| COACH-11 | View arena calendar | Shows booking schedule | |
| COACH-12 | Check availability | Can see when arenas are free | |

### 4.4 Information
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| COACH-13 | View noticeboard | Shows venue notices | |
| COACH-14 | View professional directory | Can browse professional contacts | |

---

## 5. Staff Role (Yard Staff)

**User Profile**: Yard staff without livery access (is_yard_staff: true, role: not livery)

### 5.1 Navigation
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| STAFF-01 | Verify navigation menu | Shows: Tasks, Feed Duties, Turnout Board, Timesheet, Noticeboard, Directory | |

### 5.2 Tasks
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| STAFF-02 | View tasks list | Shows tasks by category: open, my tasks, today, pool, backlog | |
| STAFF-03 | View task summary | Shows counts: total open, urgent, overdue, assigned to me | |
| STAFF-04 | Create task | Opens task creation form | |
| STAFF-05 | Fill task form | Form accepts: title, description, category, priority, location | |
| STAFF-06 | Submit task | Creates task successfully | |
| STAFF-07 | Start task | Can mark task as "in progress" | |
| STAFF-08 | Complete task | Can mark task as completed with notes | |
| STAFF-09 | Add comment | Can add comments to any task | |
| STAFF-10 | Filter tasks | Can filter by category, priority, status | |

### 5.3 Feed Duties
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| STAFF-11 | View feed schedule | Shows all horses with feed requirements | |
| STAFF-12 | View by stable order | Horses sorted by stable sequence | |
| STAFF-13 | View feed details | Shows morning/evening feed, supplements | |
| STAFF-14 | View active additions | Shows temporary feed additions | |
| STAFF-15 | View supply alerts | Shows feed supply warnings | |
| STAFF-16 | Create supply alert | Can flag low supply | |
| STAFF-17 | Resolve supply alert | Can mark alert as resolved | |

### 5.4 Turnout Board
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| STAFF-18 | View turnout board | Shows daily turnout summary | |
| STAFF-19 | View turning out | Lists horses to turn out today | |
| STAFF-20 | View staying in | Lists horses staying in with reasons | |
| STAFF-21 | View pending requests | Lists unreviewed requests | |
| STAFF-22 | View no request | Lists horses with no request | |
| STAFF-23 | Review request | Can approve/decline turnout requests | |
| STAFF-24 | Add response message | Can add message when reviewing | |
| STAFF-25 | Navigate dates | Can view different dates | |

### 5.5 My Timesheet
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| STAFF-26 | View timesheets | Shows own timesheet entries | |
| STAFF-27 | Create timesheet | Opens timesheet entry form | |
| STAFF-28 | Fill timesheet | Form accepts: date, clock in/out, lunch times, work type | |
| STAFF-29 | Submit timesheet | Creates timesheet entry | |
| STAFF-30 | Edit draft timesheet | Can modify draft entries | |
| STAFF-31 | Submit for approval | Can submit timesheet for review | |
| STAFF-32 | View total hours | Shows calculated hours worked | |

### 5.6 Information
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| STAFF-33 | View noticeboard | Shows venue notices | |
| STAFF-34 | View professional directory | Can browse professional contacts | |

---

## 6. Admin Role

**User Profile**: Administrator with full system access (role: admin)

### 6.1 Navigation
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| ADMIN-01 | Verify main navigation | Shows: Clinics, Book Arena, Livery dropdown, Yard dropdown, Info dropdown, Admin link | |
| ADMIN-02 | Access admin panel | "Admin" link opens admin dashboard | |

### 6.2 Admin Dashboard
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| ADMIN-03 | View dashboard | Shows summary statistics | |
| ADMIN-04 | View recent activity | Shows recent system activity | |

### 6.3 Site Settings
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| ADMIN-05 | View settings | Shows all site settings | |
| ADMIN-06 | Edit venue name | Can update venue name | |
| ADMIN-07 | Edit contact details | Can update email, phone | |
| ADMIN-08 | Edit address | Can update street, town, county, postcode | |
| ADMIN-09 | Edit what3words | Can update what3words location | |
| ADMIN-10 | Upload logo | Can upload venue logo | |
| ADMIN-11 | Configure theme | Can set colors, font, mode | |
| ADMIN-12 | Configure livery rules | Can set booking limits, billing day | |
| ADMIN-13 | Configure rugging guide | Can edit rugging temperature matrix | |
| ADMIN-14 | Configure SMS settings | Can enable/configure SMS notifications | |
| ADMIN-15 | Save settings | Changes save successfully | |

### 6.4 User Management
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| ADMIN-16 | View users list | Lists all user accounts | |
| ADMIN-17 | Filter users | Can filter by role, status | |
| ADMIN-18 | Search users | Can search by name/email | |
| ADMIN-19 | Create user | Opens user creation form | |
| ADMIN-20 | Set user role | Can assign: public, livery, staff, coach, admin | |
| ADMIN-21 | Set yard staff flag | Can mark user as yard staff | |
| ADMIN-22 | Set active status | Can activate/deactivate users | |
| ADMIN-23 | Reset password | Can force password change | |
| ADMIN-24 | Edit user | Can modify user details | |

### 6.5 Arena Management
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| ADMIN-25 | View arenas list | Lists all arenas | |
| ADMIN-26 | Create arena | Opens arena creation form | |
| ADMIN-27 | Fill arena details | Form accepts: name, description, size, surface, price | |
| ADMIN-28 | Set arena features | Can set: has_lights, jumps_type, free_for_livery | |
| ADMIN-29 | Upload arena image | Can add arena photo | |
| ADMIN-30 | Edit arena | Can modify arena details | |
| ADMIN-31 | Deactivate arena | Can make arena inactive | |

### 6.6 Stable Management
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| ADMIN-32 | View stable blocks | Lists all stable blocks | |
| ADMIN-33 | Create block | Can create new stable block | |
| ADMIN-34 | Edit block | Can modify block name/order | |
| ADMIN-35 | View stables | Lists stables within blocks | |
| ADMIN-36 | Create stable | Can create new stable in block | |
| ADMIN-37 | Edit stable | Can modify stable details | |
| ADMIN-38 | Reorder stables | Can change stable sequence | |
| ADMIN-39 | View horse assignments | Shows which horses are in each stable | |

### 6.7 Booking Management
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| ADMIN-40 | View all bookings | Lists all bookings with filters | |
| ADMIN-41 | Filter by arena | Can filter bookings by arena | |
| ADMIN-42 | Filter by date | Can filter by date range | |
| ADMIN-43 | Filter by type | Can filter by booking type | |
| ADMIN-44 | Create booking | Can create booking for any user | |
| ADMIN-45 | Edit booking | Can modify any booking | |
| ADMIN-46 | Cancel booking | Can cancel any booking | |
| ADMIN-47 | View payment status | Shows payment status for public bookings | |

### 6.8 Arena Usage Report
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| ADMIN-48 | View usage report | Shows usage statistics | |
| ADMIN-49 | View by period | Shows: previous month, quarter, year | |
| ADMIN-50 | View by arena | Shows breakdown per arena | |
| ADMIN-51 | View by booking type | Shows usage by type | |

### 6.9 Livery Packages
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| ADMIN-52 | View packages list | Lists all livery packages | |
| ADMIN-53 | Create package | Opens package creation form | |
| ADMIN-54 | Fill package details | Form accepts: name, price display, monthly price | |
| ADMIN-55 | Add features | Can add feature list items | |
| ADMIN-56 | Set featured | Can mark package as featured | |
| ADMIN-57 | Set display order | Can set sort order | |
| ADMIN-58 | Edit package | Can modify package details | |
| ADMIN-59 | Deactivate package | Can make package inactive | |

### 6.10 Service Catalog
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| ADMIN-60 | View services list | Lists all services by category | |
| ADMIN-61 | Create service | Opens service creation form | |
| ADMIN-62 | Fill service details | Form accepts: ID, name, category, price, duration | |
| ADMIN-63 | Set approval required | Can require admin approval | |
| ADMIN-64 | Set advance notice | Can set minimum notice hours | |
| ADMIN-65 | Edit service | Can modify service details | |
| ADMIN-66 | Deactivate service | Can make service inactive | |

### 6.11 Service Requests Management
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| ADMIN-67 | View service requests | Shows requests by status | |
| ADMIN-68 | View pending approval | Lists requests needing approval | |
| ADMIN-69 | Approve request | Can approve pending requests | |
| ADMIN-70 | Schedule request | Can assign staff and set date/time | |
| ADMIN-71 | Start request | Can mark as in progress | |
| ADMIN-72 | Complete request | Can mark as completed with charges | |
| ADMIN-73 | Cancel request | Can cancel any request | |

### 6.12 Billing Management
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| ADMIN-74 | View all accounts | Lists all user accounts with balances | |
| ADMIN-75 | View account detail | Shows user's transaction history | |
| ADMIN-76 | Create transaction | Can add ledger entry | |
| ADMIN-77 | Create charge | Can add livery/service charge | |
| ADMIN-78 | Record payment | Can record payment received | |
| ADMIN-79 | Add credit/adjustment | Can add credit or adjustment | |

### 6.13 Staff Management
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| ADMIN-80 | View staff dashboard | Shows: pending timesheets, holiday requests, absences | |
| ADMIN-81 | View shifts | Shows staff shift schedule | |
| ADMIN-82 | Create shift | Can assign shifts to staff | |
| ADMIN-83 | Edit/delete shift | Can modify shift assignments | |
| ADMIN-84 | View timesheets | Lists all staff timesheets | |
| ADMIN-85 | Approve timesheet | Can approve submitted timesheets | |
| ADMIN-86 | Reject timesheet | Can reject with reason | |
| ADMIN-87 | View holiday requests | Lists pending/approved/rejected requests | |
| ADMIN-88 | Approve holiday | Can approve with notes | |
| ADMIN-89 | Reject holiday | Can reject with reason | |
| ADMIN-90 | Record absence | Can record unplanned absence | |
| ADMIN-91 | View leave summary | Shows all staff leave balances | |

### 6.14 Events & Clinics Management
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| ADMIN-92 | View all events/clinics | Shows pending, approved, past with status badges and spaces/bookings count | |
| ADMIN-93 | View event/clinic details | Shows Status & Review section with status, reviewer, notes | |
| ADMIN-94 | Review pending event/clinic | Opens approval modal | |
| ADMIN-95 | Approve event/clinic | Can approve with notes | |
| ADMIN-96 | Reject event/clinic | Can reject with reason | |
| ADMIN-97 | Request changes | Can request changes from coach | |
| ADMIN-98 | Manage slots | Can create time slots for approved event/clinic | |
| ADMIN-99 | Assign participants | Can assign participants to slots | |
| ADMIN-100 | Confirm participants | Can confirm participant registrations | |
| ADMIN-101 | Send notifications | Can trigger SMS notifications | |

### 6.15 Task Triage
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| ADMIN-102 | View task triage | Shows tasks needing assignment | |
| ADMIN-103 | Assign task | Can assign task to staff member | |
| ADMIN-104 | Set priority | Can change task priority | |
| ADMIN-105 | Set scheduled date | Can set target completion date | |
| ADMIN-106 | Bulk assign | Can assign multiple tasks at once | |

### 6.16 Feed Schedule
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| ADMIN-107 | View all feed schedules | Shows all horses with feed requirements | |
| ADMIN-108 | Edit feed requirements | Can modify any horse's feed | |
| ADMIN-109 | Approve feed additions | Can approve/reject addition requests | |
| ADMIN-110 | View/resolve alerts | Can manage supply alerts | |

### 6.17 Compliance Calendar
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| ADMIN-111 | View compliance dashboard | Shows: overdue, due soon, up to date counts | |
| ADMIN-112 | View compliance items | Lists all compliance items | |
| ADMIN-113 | Create compliance item | Opens item creation form | |
| ADMIN-114 | Fill item details | Form accepts: name, category, frequency, due date | |
| ADMIN-115 | Assign responsibility | Can assign to staff member | |
| ADMIN-116 | Mark complete | Can record completion with certificate | |
| ADMIN-117 | View history | Shows completion history for item | |
| ADMIN-118 | Edit item | Can modify item details | |
| ADMIN-119 | Deactivate item | Can make item inactive | |

### 6.18 Backup Management

#### Database Backup (pg_dump) - Disaster Recovery
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| ADMIN-120 | View Database Backup section | Shows "Database Backup" heading with description | |
| ADMIN-121 | Create database backup | Click "Create Database Backup" generates .sql file | |
| ADMIN-122 | View database backup list | Lists all .sql backup files with date, size | |
| ADMIN-123 | Download database backup | Can download .sql file to laptop | |
| ADMIN-124 | Delete database backup | Can remove old .sql backups | |

#### Data Export/Import (JSON) - Portability & Seeding
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| ADMIN-125 | View Data Export section | Shows "Data Export / Import" heading with description | |
| ADMIN-126 | Create data export | Click "Export Data Now" generates .json file | |
| ADMIN-127 | View export history | Lists all JSON exports with entity counts | |
| ADMIN-128 | Download data export | Can download .json file | |
| ADMIN-129 | Validate import file | Can validate JSON file before importing | |
| ADMIN-130 | Import data | Can import data from JSON file | |
| ADMIN-131 | Delete data export | Can remove old exports | |
| ADMIN-132 | Configure schedule | Can set automatic export schedule | |

### 6.19 Holiday Livery Management
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| ADMIN-127 | View holiday livery requests | Lists all requests with status badges | |
| ADMIN-128 | View request statistics | Shows pending, approved, rejected counts | |
| ADMIN-129 | Filter by status | Can filter requests by status | |
| ADMIN-130 | View request details | Shows guest info, horse details, requested dates | |
| ADMIN-131 | View special requirements | Displays any special requirements | |
| ADMIN-132 | Approve request | Opens approval modal | |
| ADMIN-133 | Set confirmed dates | Can set arrival and departure dates | |
| ADMIN-134 | Assign stable | Dropdown shows available stables | |
| ADMIN-135 | Add admin notes | Can add internal notes | |
| ADMIN-136 | Submit approval | Creates user account, horse record, assigns stable | |
| ADMIN-137 | View created credentials | Shows temporary password for new user | |
| ADMIN-138 | Reject request | Opens rejection modal | |
| ADMIN-139 | Enter rejection reason | Must provide reason for rejection | |
| ADMIN-140 | Cancel request | Can cancel approved or pending request | |
| ADMIN-141 | View holiday livery billing | Shows weekly rate charged per day | |

### 6.20 Monthly Billing
| Test ID | Test Case | Expected Result | Pass/Fail |
|---------|-----------|-----------------|-----------|
| ADMIN-142 | View billing tab | Shows Monthly Billing tab in Billing page | |
| ADMIN-143 | Select billing month | Dropdown shows available months | |
| ADMIN-144 | Preview billing | Shows preview of charges before running | |
| ADMIN-145 | View horse charges | Lists each horse with days and amount | |
| ADMIN-146 | View pro-rata calculation | Shows pro-rated amounts for partial months | |
| ADMIN-147 | Run billing | Creates ledger entries for all horses | |
| ADMIN-148 | View billing confirmation | Shows success message with totals | |
| ADMIN-149 | View weekly billing | Holiday livery shows weekly rate (per day) | |

---

## Test Execution Notes

### Pre-requisites
1. System seeded with test data (users, horses, arenas, etc.)
2. Test accounts created for each role type
3. Stripe test keys configured via Admin > Settings > Payment Settings (for payment testing)
4. SMS test mode enabled via Admin > Settings (for notification testing)

### Test Accounts
| Role | Username | Notes |
|------|----------|-------|
| Admin | admin | Full access |
| Livery | livery_test | Has horses assigned |
| Staff | staff_test | Yard staff, no livery |
| Coach | coach_test | Coach role only |
| Public | public_test | Arena/clinic booker (created via guest booking) |

### Execution Log

| Date | Tester | Role Tested | Pass Rate | Notes |
|------|--------|-------------|-----------|-------|
| | | | | |

---

