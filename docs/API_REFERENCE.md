# API Reference

Complete API reference for the Equestrian Venue Manager application.

Base URL: `http://localhost:8000`

## Table of Contents

1. [Authentication](#authentication)
2. [Users](#users)
3. [Horses](#horses)
4. [Arenas](#arenas)
5. [Bookings](#bookings)
6. [Training Clinics](#training-clinics)
7. [Services](#services)
8. [Turnout Requests](#turnout-requests)
9. [Health Records](#health-records)
10. [Staff Management](#staff-management)
11. [Billing](#billing)
12. [Settings](#settings)

---

## Authentication

All authenticated endpoints require a JWT Bearer token in the Authorization header:
```
Authorization: Bearer <token>
```

### Register

**POST** `/api/auth/register`

Create a new user account.

**Request Body:**
```json
{
  "username": "string",
  "email": "string",
  "name": "string",
  "phone": "string",
  "password": "string"
}
```

**Response:** `201 Created`
```json
{
  "id": 1,
  "username": "john_doe",
  "email": "john@example.com",
  "name": "John Doe",
  "role": "public",
  "is_active": true
}
```

### Login

**POST** `/api/auth/login`

Authenticate and receive access tokens.

**Request Body (form-data):**
```
username: string
password: string
```

**Response:** `200 OK`
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "must_change_password": false,
  "user_role": "livery"
}
```

### Refresh Token

**POST** `/api/auth/refresh`

Get a new access token using a refresh token.

**Query Parameters:**
- `refresh_token` (string, required)

**Response:** `200 OK`
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer"
}
```

### Change Password

**POST** `/api/auth/change-password`

Change the current user's password.

**Authentication:** Required

**Request Body:**
```json
{
  "current_password": "string",
  "new_password": "string"
}
```

**Response:** `200 OK`
```json
{
  "id": 1,
  "username": "john_doe",
  "email": "john@example.com",
  "name": "John Doe"
}
```

---

## Users

### Get Current User Profile

**GET** `/api/users/me`

Get the authenticated user's profile.

**Authentication:** Required

**Response:** `200 OK`
```json
{
  "id": 1,
  "username": "john_doe",
  "email": "john@example.com",
  "name": "John Doe",
  "role": "livery",
  "is_active": true
}
```

### Update Current User

**PUT** `/api/users/me`

Update the authenticated user's profile.

**Authentication:** Required

**Request Body:**
```json
{
  "name": "string",
  "email": "string",
  "phone": "string",
  "address_street": "string",
  "address_town": "string",
  "address_county": "string",
  "address_postcode": "string"
}
```

**Response:** `200 OK`

### List All Users

**GET** `/api/users/`

List all users in the system.

**Authentication:** Admin only

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "name": "John Doe",
    "role": "livery"
  }
]
```

### Create User (Admin)

**POST** `/api/users/create`

Admin creates a new user with a temporary password.

**Authentication:** Admin only

**Request Body:**
```json
{
  "username": "string",
  "email": "string",
  "name": "string",
  "phone": "string",
  "role": "livery"
}
```

**Response:** `201 Created`
```json
{
  "user": {
    "id": 2,
    "username": "new_user",
    "email": "user@example.com",
    "name": "New User"
  },
  "temporary_password": "randomPass123"
}
```

### Update User (Admin)

**PUT** `/api/users/{user_id}`

Admin updates a user's details.

**Authentication:** Admin only

**Path Parameters:**
- `user_id` (integer, required)

**Request Body:**
```json
{
  "name": "string",
  "email": "string",
  "role": "livery",
  "is_active": true,
  "is_yard_staff": false
}
```

**Response:** `200 OK`

### Reset User Password (Admin)

**POST** `/api/users/{user_id}/reset-password`

Reset a user's password and generate a temporary password.

**Authentication:** Admin only

**Path Parameters:**
- `user_id` (integer, required)

**Response:** `200 OK`
```json
{
  "temporary_password": "newRandomPass456",
  "message": "Password reset successfully"
}
```

### Toggle User Active Status

**PUT** `/api/users/{user_id}/toggle-active`

Enable or disable a user account.

**Authentication:** Admin only

**Path Parameters:**
- `user_id` (integer, required)

**Response:** `200 OK`

---

## Horses

### List Horses

**GET** `/api/horses/`

List horses. Staff see all horses, others see only their own.

**Authentication:** Required

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "name": "Thunder",
    "breed": "Thoroughbred",
    "color": "Bay",
    "date_of_birth": "2015-04-15",
    "owner_id": 1,
    "stable_id": 5,
    "livery_package_id": "full-livery",
    "stable_name": "Stable 5",
    "livery_package_name": "Full Livery"
  }
]
```

### Get Horse

**GET** `/api/horses/{horse_id}`

Get a specific horse by ID.

**Authentication:** Required (owner or staff)

**Path Parameters:**
- `horse_id` (integer, required)

**Response:** `200 OK`

### Create Horse

**POST** `/api/horses/`

Create a new horse.

**Authentication:** Required

**Request Body:**
```json
{
  "name": "string",
  "breed": "string",
  "color": "string",
  "date_of_birth": "2015-04-15",
  "height": "16.2hh",
  "stable_id": 5,
  "livery_package_id": "full-livery"
}
```

**Response:** `201 Created`

### Update Horse

**PUT** `/api/horses/{horse_id}`

Update a horse's details.

**Authentication:** Required (owner or admin)

**Path Parameters:**
- `horse_id` (integer, required)

**Request Body:**
```json
{
  "name": "string",
  "stable_id": 6,
  "livery_package_id": "part-livery"
}
```

**Response:** `200 OK`

### Delete Horse

**DELETE** `/api/horses/{horse_id}`

Delete a horse.

**Authentication:** Required (owner only)

**Path Parameters:**
- `horse_id` (integer, required)

**Response:** `204 No Content`

---

## Arenas

### List Active Arenas

**GET** `/api/arenas/`

List all active arenas (public endpoint).

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "name": "Main Arena",
    "description": "60m x 40m outdoor arena",
    "is_active": true
  }
]
```

### List All Arenas

**GET** `/api/arenas/all`

List all arenas including inactive ones.

**Authentication:** Staff only

**Response:** `200 OK`

### Get Arena

**GET** `/api/arenas/{arena_id}`

Get a specific arena by ID.

**Path Parameters:**
- `arena_id` (integer, required)

**Response:** `200 OK`

### Create Arena

**POST** `/api/arenas/`

Create a new arena.

**Authentication:** Staff only

**Request Body:**
```json
{
  "name": "string",
  "description": "string",
  "is_active": true
}
```

**Response:** `201 Created`

### Update Arena

**PUT** `/api/arenas/{arena_id}`

Update an arena's details.

**Authentication:** Staff only

**Path Parameters:**
- `arena_id` (integer, required)

**Response:** `200 OK`

### Delete Arena

**DELETE** `/api/arenas/{arena_id}`

Delete an arena. Fails if arena has bookings.

**Authentication:** Staff only

**Path Parameters:**
- `arena_id` (integer, required)

**Response:** `204 No Content`

---

## Bookings

### List Public Bookings

**GET** `/api/bookings/public`

List bookings visible to anonymous users (minimal details).

**Query Parameters:**
- `arena_id` (integer, optional)
- `start_date` (datetime, optional)
- `end_date` (datetime, optional)

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "arena_id": 1,
    "start_time": "2024-01-15T10:00:00",
    "end_time": "2024-01-15T11:00:00",
    "booking_type": "livery",
    "booking_status": "confirmed",
    "title": "Booked"
  }
]
```

### Create Guest Booking

**POST** `/api/bookings/guest`

Create a booking for anonymous users with contact details.

**Request Body:**
```json
{
  "arena_id": 1,
  "title": "Private Lesson",
  "start_time": "2024-01-15T10:00:00",
  "end_time": "2024-01-15T11:00:00",
  "guest_name": "Jane Smith",
  "guest_email": "jane@example.com",
  "guest_phone": "+44 1234 567890"
}
```

**Response:** `201 Created`
```json
{
  "id": 1,
  "arena_id": 1,
  "start_time": "2024-01-15T10:00:00",
  "end_time": "2024-01-15T11:00:00",
  "account_created": true,
  "temporary_password": "tempPass123",
  "username": "janesmith"
}
```

### List Bookings

**GET** `/api/bookings/`

List bookings for authenticated users.

**Authentication:** Required

**Query Parameters:**
- `arena_id` (integer, optional)
- `start_date` (datetime, optional)
- `end_date` (datetime, optional)
- `include_cancelled` (boolean, optional)

**Response:** `200 OK`

### Get Booking

**GET** `/api/bookings/{booking_id}`

Get a specific booking by ID.

**Authentication:** Required

**Path Parameters:**
- `booking_id` (integer, required)

**Response:** `200 OK`

### Create Booking

**POST** `/api/bookings/`

Create a new booking for authenticated users.

**Authentication:** Required

**Request Body:**
```json
{
  "arena_id": 1,
  "title": "Training Session",
  "start_time": "2024-01-15T10:00:00",
  "end_time": "2024-01-15T11:00:00",
  "booking_type": "livery",
  "horse_id": 1,
  "open_to_share": false
}
```

**Response:** `201 Created`

### Block Arena Slot

**POST** `/api/bookings/block`

Block an arena slot for maintenance or events.

**Authentication:** Staff only

**Request Body:**
```json
{
  "arena_id": 1,
  "title": "Maintenance",
  "start_time": "2024-01-15T08:00:00",
  "end_time": "2024-01-15T10:00:00",
  "booking_type": "maintenance",
  "description": "Surface maintenance"
}
```

**Response:** `201 Created`

### Update Booking

**PUT** `/api/bookings/{booking_id}`

Update a booking.

**Authentication:** Required (owner or staff)

**Path Parameters:**
- `booking_id` (integer, required)

**Request Body:**
```json
{
  "start_time": "2024-01-15T11:00:00",
  "end_time": "2024-01-15T12:00:00"
}
```

**Response:** `200 OK`

### Cancel Booking

**PUT** `/api/bookings/{booking_id}/cancel`

Cancel a booking (sets status to cancelled).

**Authentication:** Required (owner or staff)

**Path Parameters:**
- `booking_id` (integer, required)

**Response:** `200 OK`

### Delete Booking

**DELETE** `/api/bookings/{booking_id}`

Permanently delete a booking.

**Authentication:** Required (owner or staff)

**Path Parameters:**
- `booking_id` (integer, required)

**Response:** `204 No Content`

### Get Arena Usage Report

**GET** `/api/bookings/reports/usage`

Get arena usage statistics for previous month, quarter, and year.

**Authentication:** Admin only

**Response:** `200 OK`
```json
{
  "previous_month": {
    "period_label": "November 2024",
    "total_hours": 245.5,
    "arena_summaries": [
      {
        "arena_id": 1,
        "arena_name": "Main Arena",
        "total_hours": 120.0,
        "usage_by_type": [
          {
            "booking_type": "livery",
            "label": "Livery Usage",
            "total_hours": 80.0,
            "booking_count": 45
          }
        ]
      }
    ]
  }
}
```

---

## Training Clinics

### Get Clinic Enums

**GET** `/api/clinics/enums`

Get enum options for clinic forms.

**Response:** `200 OK`
```json
{
  "disciplines": [
    {"value": "dressage", "label": "Dressage"},
    {"value": "show_jumping", "label": "Show Jumping"}
  ],
  "lesson_formats": [
    {"value": "private", "label": "Private"},
    {"value": "group", "label": "Group"}
  ]
}
```

### List Public Clinics

**GET** `/api/clinics/public`

List approved upcoming and past clinics (public view).

**Query Parameters:**
- `discipline` (string, optional)

**Response:** `200 OK`
```json
{
  "upcoming": [
    {
      "id": 1,
      "coach_name": "Sarah Johnson",
      "discipline": "dressage",
      "title": "Advanced Dressage Clinic",
      "proposed_date": "2024-02-15",
      "status": "approved",
      "participant_count": 8
    }
  ],
  "past": []
}
```

### Submit Clinic Request

**POST** `/api/clinics/request`

Submit a clinic request (public - no auth required).

**Request Body:**
```json
{
  "coach_name": "Sarah Johnson",
  "coach_email": "sarah@example.com",
  "coach_phone": "+44 1234 567890",
  "discipline": "dressage",
  "title": "Advanced Dressage",
  "proposed_date": "2024-02-15",
  "max_participants": 10,
  "coach_fee_private": 60.00
}
```

**Response:** `201 Created`

### Propose Clinic (Coach)

**POST** `/api/clinics/propose`

Propose a clinic (coach role - linked to account).

**Authentication:** Required (coach role)

**Request Body:** Same as clinic request

**Response:** `201 Created`

### List My Clinic Proposals

**GET** `/api/clinics/my-proposals`

List clinic proposals submitted by the current coach.

**Authentication:** Required (coach role)

**Response:** `200 OK`

### Get My Registrations

**GET** `/api/clinics/my-registrations`

Get user's clinic registrations with slot details.

**Authentication:** Required

**Response:** `200 OK`

### List Clinic Requests

**GET** `/api/clinics/`

List clinic requests (admin sees all, others see approved only).

**Authentication:** Required

**Response:** `200 OK`
```json
{
  "pending": [],
  "approved": [],
  "past": []
}
```

### Get Clinic Detail

**GET** `/api/clinics/{clinic_id}`

Get detailed clinic information.

**Authentication:** Required

**Path Parameters:**
- `clinic_id` (integer, required)

**Response:** `200 OK`

### Approve Clinic

**PUT** `/api/clinics/{clinic_id}/approve`

Approve a clinic request and set venue fees.

**Authentication:** Admin only

**Path Parameters:**
- `clinic_id` (integer, required)

**Query Parameters:**
- `notes` (string, optional)
- `create_notice` (boolean, default: true)
- `venue_fee_private` (float, optional)
- `venue_fee_group` (float, optional)

**Response:** `200 OK`

### Reject Clinic

**PUT** `/api/clinics/{clinic_id}/reject`

Reject a clinic request.

**Authentication:** Admin only

**Path Parameters:**
- `clinic_id` (integer, required)

**Query Parameters:**
- `reason` (string, optional)

**Response:** `200 OK`

### Register for Clinic

**POST** `/api/clinics/{clinic_id}/register`

Register for a clinic (authenticated users or guests).

**Authentication:** Optional

**Path Parameters:**
- `clinic_id` (integer, required)

**Request Body:**
```json
{
  "participant_name": "John Doe",
  "participant_email": "john@example.com",
  "participant_phone": "+44 1234 567890",
  "horse_id": 1,
  "notes": "First time participant"
}
```

**Response:** `201 Created`

### Manage Clinic Slots

Clinic slots are scheduled time periods within a clinic.

#### List Clinic Slots

**GET** `/api/clinics/{clinic_id}/slots`

**Authentication:** Admin or proposing coach

**Response:** `200 OK`

#### Create Clinic Slot

**POST** `/api/clinics/{clinic_id}/slots`

**Authentication:** Admin only

**Request Body:**
```json
{
  "slot_date": "2024-02-15",
  "start_time": "10:00:00",
  "end_time": "11:00:00",
  "arena_id": 1,
  "is_group_slot": true,
  "max_participants": 4
}
```

**Response:** `201 Created`

---

## Services

### List Services

**GET** `/api/services/`

List all available services.

**Query Parameters:**
- `category` (string, optional): farrier, dentist, vet, rehab
- `active_only` (boolean, default: true)

**Response:** `200 OK`
```json
[
  {
    "id": "farrier-trim",
    "category": "farrier",
    "name": "Farrier - Trim",
    "description": "Standard hoof trim",
    "price_gbp": 35.00,
    "is_active": true
  }
]
```

### Get Service

**GET** `/api/services/{service_id}`

Get a specific service by ID.

**Path Parameters:**
- `service_id` (string, required)

**Response:** `200 OK`

### Create Service

**POST** `/api/services/`

Create a new service.

**Authentication:** Admin only

**Request Body:**
```json
{
  "id": "vet-checkup",
  "category": "vet",
  "name": "Veterinary Check-up",
  "description": "Annual health check",
  "price_gbp": 85.00,
  "requires_approval": true,
  "advance_notice_hours": 48
}
```

**Response:** `201 Created`

### Get My Service Requests

**GET** `/api/services/requests/my`

Get current user's service requests.

**Authentication:** Required

**Response:** `200 OK`
```json
{
  "pending_requests": [],
  "quoted_requests": [],
  "scheduled_requests": [],
  "completed_requests": []
}
```

### Get Staff Service Requests

**GET** `/api/services/requests/staff`

Get service requests for staff dashboard.

**Authentication:** Admin only

**Response:** `200 OK`
```json
{
  "pending_approval": [],
  "pending_scheduling": [],
  "scheduled_today": [],
  "completed": []
}
```

### Create Service Request

**POST** `/api/services/requests`

Create a new service request.

**Authentication:** Required

**Request Body:**
```json
{
  "service_id": "farrier-trim",
  "horse_id": 1,
  "requested_date": "2024-01-20",
  "preferred_time": "morning",
  "special_instructions": "Front hooves only"
}
```

**Response:** `201 Created`

### Quote Service Request

**PUT** `/api/services/requests/{request_id}/quote`

Provide a cost estimate for a pending service request.

**Authentication:** Admin only

**Path Parameters:**
- `request_id` (integer, required)

**Request Body:**
```json
{
  "quote_amount": 45.00,
  "quote_notes": "Includes removal of front shoes"
}
```

**Response:** `200 OK`

### Accept Quote

**PUT** `/api/services/requests/{request_id}/accept-quote`

Accept a quoted service request.

**Authentication:** Required (requester or admin)

**Path Parameters:**
- `request_id` (integer, required)

**Response:** `200 OK`

### Schedule Service Request

**PUT** `/api/services/requests/{request_id}/schedule`

Schedule a service request and assign to staff.

**Authentication:** Admin only

**Path Parameters:**
- `request_id` (integer, required)

**Request Body:**
```json
{
  "assigned_to_id": 2,
  "scheduled_datetime": "2024-01-20T10:00:00",
  "notes": "Meet at Stable 5"
}
```

**Response:** `200 OK`

### Complete Service Request

**PUT** `/api/services/requests/{request_id}/complete`

Complete a service request.

**Authentication:** Admin or assigned staff

**Path Parameters:**
- `request_id` (integer, required)

**Request Body:**
```json
{
  "charge_amount": 45.00,
  "charge_status": "charged",
  "notes": "Service completed successfully"
}
```

**Response:** `200 OK`

### Get Insurance Claims

**GET** `/api/services/requests/insurance/my-claims`

Get all completed rehab services that could be insurance claimable.

**Authentication:** Required

**Query Parameters:**
- `horse_id` (integer, optional)
- `start_date` (date, optional)
- `end_date` (date, optional)

**Response:** `200 OK`

### Generate Insurance Statement

**GET** `/api/services/requests/insurance/statement`

Generate an insurance statement for claimable requests.

**Authentication:** Required

**Query Parameters:**
- `horse_id` (integer, optional)
- `start_date` (date, optional)
- `end_date` (date, optional)

**Response:** `200 OK`

### Download Insurance Statement PDF

**GET** `/api/services/requests/insurance/statement/pdf`

Download insurance statement as PDF.

**Authentication:** Required

**Query Parameters:** Same as above

**Response:** PDF file download

---

## Turnout Requests

### Get My Turnout Requests

**GET** `/api/turnout/my`

Get turnout requests for the current user's horses.

**Authentication:** Required

**Query Parameters:**
- `upcoming_only` (boolean, default: true)

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "horse_id": 1,
    "horse_name": "Thunder",
    "request_date": "2024-01-15",
    "turnout_type": "out",
    "field_preference": "Front paddock",
    "status": "approved"
  }
]
```

### Create Turnout Request

**POST** `/api/turnout/`

Create a new turnout request.

**Authentication:** Required

**Request Body:**
```json
{
  "horse_id": 1,
  "request_date": "2024-01-15",
  "turnout_type": "out",
  "field_preference": "Front paddock",
  "notes": "Prefer morning turnout"
}
```

**Response:** `201 Created`

### Get Pending Turnout Requests

**GET** `/api/turnout/pending`

Get all pending turnout requests.

**Authentication:** Staff only

**Response:** `200 OK`

### Review Turnout Request

**POST** `/api/turnout/{request_id}/review`

Approve or decline a turnout request.

**Authentication:** Staff only

**Path Parameters:**
- `request_id` (integer, required)

**Request Body:**
```json
{
  "status": "approved",
  "response_message": "Approved for front field"
}
```

**Response:** `200 OK`

### Get Daily Turnout Summary

**GET** `/api/turnout/daily/{target_date}`

Get daily turnout summary for staff.

**Authentication:** Staff only

**Path Parameters:**
- `target_date` (date, required)

**Response:** `200 OK`
```json
{
  "date": "2024-01-15",
  "turning_out": [],
  "staying_in": [],
  "pending": [],
  "no_request_horses": []
}
```

---

## Health Records

### Get Health Records Summary

**GET** `/api/horses/{horse_id}/summary`

Get complete health records summary for a horse.

**Authentication:** Required (owner or staff)

**Path Parameters:**
- `horse_id` (integer, required)

**Response:** `200 OK`
```json
{
  "horse_id": 1,
  "horse_name": "Thunder",
  "farrier_records": [],
  "dentist_records": [],
  "vaccination_records": [],
  "worming_records": [],
  "next_farrier_due": "2024-02-15",
  "next_vaccination_due": "2024-06-01"
}
```

### Farrier Records

#### List Farrier Records

**GET** `/api/horses/{horse_id}/farrier`

**Authentication:** Required (owner or staff)

#### Create Farrier Record

**POST** `/api/horses/{horse_id}/farrier`

**Request Body:**
```json
{
  "visit_date": "2024-01-15",
  "work_done": "Full set of shoes",
  "farrier_name": "John Smith",
  "cost": 85.00,
  "next_due": "2024-03-15"
}
```

**Response:** `201 Created`

#### Update Farrier Record

**PUT** `/api/horses/{horse_id}/farrier/{record_id}`

#### Delete Farrier Record

**DELETE** `/api/horses/{horse_id}/farrier/{record_id}`

### Dentist Records

Similar endpoints for dentist records:
- **GET** `/api/horses/{horse_id}/dentist`
- **POST** `/api/horses/{horse_id}/dentist`
- **PUT** `/api/horses/{horse_id}/dentist/{record_id}`
- **DELETE** `/api/horses/{horse_id}/dentist/{record_id}`

### Vaccination Records

Similar endpoints for vaccination records:
- **GET** `/api/horses/{horse_id}/vaccination`
- **POST** `/api/horses/{horse_id}/vaccination`
- **PUT** `/api/horses/{horse_id}/vaccination/{record_id}`
- **DELETE** `/api/horses/{horse_id}/vaccination/{record_id}`

### Worming Records

Similar endpoints for worming records:
- **GET** `/api/horses/{horse_id}/worming`
- **POST** `/api/horses/{horse_id}/worming`
- **PUT** `/api/horses/{horse_id}/worming/{record_id}`
- **DELETE** `/api/horses/{horse_id}/worming/{record_id}`

### Emergency Contacts

#### List Emergency Contacts

**GET** `/api/horses/{horse_id}/emergency-contacts`

**Authentication:** Required (owner or staff)

**Response:** `200 OK`

#### Get Emergency Contacts Summary

**GET** `/api/horses/{horse_id}/emergency-contacts/summary`

Get primary contacts for each type.

**Response:** `200 OK`

#### Create Emergency Contact

**POST** `/api/horses/{horse_id}/emergency-contacts`

**Request Body:**
```json
{
  "contact_type": "vet",
  "name": "Dr. Jane Smith",
  "phone": "+44 1234 567890",
  "email": "vet@example.com",
  "is_primary": true
}
```

**Response:** `201 Created`

---

## Staff Management

### Get Staff Management Enums

**GET** `/api/staff/enums`

Get enum options for staff management forms.

**Response:** `200 OK`

### Get Manager Dashboard

**GET** `/api/staff/dashboard`

Get manager dashboard summary.

**Authentication:** Admin only

**Response:** `200 OK`
```json
{
  "pending_timesheets": 5,
  "pending_holiday_requests": 2,
  "staff_on_leave_today": 1,
  "staff_absent_today": 0,
  "shifts_today": 3
}
```

### Shifts

#### List Shifts

**GET** `/api/staff/shifts`

**Authentication:** Staff only

**Query Parameters:**
- `staff_id` (integer, optional)
- `start_date` (date, optional)
- `end_date` (date, optional)

**Response:** `200 OK`

#### Create Shift

**POST** `/api/staff/shifts`

**Authentication:** Admin only

**Request Body:**
```json
{
  "staff_id": 2,
  "date": "2024-01-15",
  "shift_type": "morning",
  "role": "yard_duties",
  "notes": "Feed and turnout"
}
```

**Response:** `201 Created`

### Timesheets

#### List Timesheets

**GET** `/api/staff/timesheets`

**Authentication:** Staff only

**Query Parameters:**
- `staff_id` (integer, optional)
- `status_filter` (string, optional)
- `start_date` (date, optional)
- `end_date` (date, optional)

**Response:** `200 OK`

#### Create Timesheet

**POST** `/api/staff/timesheets`

Staff creates their own timesheet.

**Authentication:** Staff only

**Request Body:**
```json
{
  "date": "2024-01-15",
  "clock_in": "08:00:00",
  "clock_out": "16:00:00",
  "lunch_start": "12:00:00",
  "lunch_end": "13:00:00",
  "work_type": "yard_duties"
}
```

**Response:** `201 Created`

#### Submit Timesheet

**PUT** `/api/staff/timesheets/{timesheet_id}/submit`

Submit a timesheet for approval.

**Authentication:** Staff only

**Response:** `200 OK`

#### Approve Timesheet

**PUT** `/api/staff/timesheets/{timesheet_id}/approve`

Approve a submitted timesheet.

**Authentication:** Admin only

**Response:** `200 OK`

#### Reject Timesheet

**PUT** `/api/staff/timesheets/{timesheet_id}/reject`

Reject a submitted timesheet.

**Authentication:** Admin only

**Query Parameters:**
- `reason` (string, optional)

**Response:** `200 OK`

### Holiday Requests

#### List Holiday Requests

**GET** `/api/staff/holidays`

**Authentication:** Staff only

**Response:** `200 OK`
```json
{
  "pending": [],
  "approved": [],
  "rejected": []
}
```

#### Create Holiday Request

**POST** `/api/staff/holidays`

**Authentication:** Staff only

**Request Body:**
```json
{
  "start_date": "2024-02-01",
  "end_date": "2024-02-05",
  "leave_type": "annual",
  "days_requested": 5,
  "reason": "Family holiday"
}
```

**Response:** `201 Created`

#### Approve Holiday Request

**PUT** `/api/staff/holidays/{request_id}/approve`

**Authentication:** Admin only

**Query Parameters:**
- `notes` (string, optional)

**Response:** `200 OK`

#### Reject Holiday Request

**PUT** `/api/staff/holidays/{request_id}/reject`

**Authentication:** Admin only

**Query Parameters:**
- `notes` (string, optional)

**Response:** `200 OK`

### Unplanned Absences

#### List Unplanned Absences

**GET** `/api/staff/absences`

**Authentication:** Staff only

**Query Parameters:**
- `staff_id` (integer, optional)
- `start_date` (date, optional)
- `end_date` (date, optional)

**Response:** `200 OK`

#### Record Unplanned Absence

**POST** `/api/staff/absences`

**Authentication:** Admin only

**Request Body:**
```json
{
  "staff_id": 2,
  "date": "2024-01-15",
  "reported_time": "08:30:00",
  "reason": "Illness",
  "expected_return": "2024-01-16"
}
```

**Response:** `201 Created`

### Staff Leave Summary

**GET** `/api/staff/leave-summary`

Get leave summary for all staff.

**Authentication:** Staff only

**Query Parameters:**
- `year` (integer, optional, default: current year)

**Response:** `200 OK`
```json
{
  "year": 2024,
  "staff_summaries": [
    {
      "staff_id": 2,
      "staff_name": "Jane Doe",
      "staff_type": "regular",
      "annual_leave_entitlement": 28,
      "annual_leave_taken": 5,
      "annual_leave_remaining": 23,
      "annual_leave_pending": 3,
      "unplanned_absences_this_year": 1
    }
  ]
}
```

---

## Billing

### Get Billing Months

**GET** `/api/billing/months`

Get list of months available for billing.

**Authentication:** Admin only

**Response:** `200 OK`
```json
[
  {
    "year": 2024,
    "month": 1,
    "display": "January 2024",
    "is_current": false,
    "is_future": false
  }
]
```

### Preview Billing

**POST** `/api/billing/preview`

Preview billing for a specific month without creating charges.

**Authentication:** Admin only

**Request Body:**
```json
{
  "year": 2024,
  "month": 1
}
```

**Response:** `200 OK`
```json
{
  "billing_month": "2024-01-01",
  "billing_month_display": "January 2024",
  "owner_summaries": [
    {
      "owner_id": 1,
      "owner_name": "John Doe",
      "owner_email": "john@example.com",
      "horses": [
        {
          "horse_id": 1,
          "horse_name": "Thunder",
          "package_name": "Full Livery",
          "monthly_price": 450.00,
          "charge_amount": 450.00,
          "period_start": "2024-01-01",
          "period_end": "2024-01-31"
        }
      ],
      "total_amount": 450.00
    }
  ],
  "total_amount": 450.00,
  "total_horses": 1,
  "total_owners": 1,
  "is_preview": true
}
```

### Run Billing

**POST** `/api/billing/run`

Run billing for a specific month and create ledger entries.

**Authentication:** Admin only

**Request Body:**
```json
{
  "year": 2024,
  "month": 1
}
```

**Response:** `200 OK`

---

## Settings

### Get Site Settings

**GET** `/api/settings/`

Get site settings (public endpoint).

**Response:** `200 OK`
```json
{
  "venue_name": "Equestrian Venue Manager",
  "contact_email": "contact@venue.com",
  "contact_phone": "+44 1234 567890",
  "address_street": "123 Stable Lane",
  "address_town": "Horsetown",
  "address_county": "Countyshire",
  "address_postcode": "AB12 3CD",
  "dev_mode": false,
  "livery_max_booking_hours": 2.0,
  "livery_max_future_hours_per_horse": 10.0
}
```

### Update Site Settings

**PUT** `/api/settings/`

Update site settings.

**Authentication:** Admin only

**Request Body:**
```json
{
  "venue_name": "New Venue Name",
  "contact_email": "new@venue.com",
  "dev_mode": true
}
```

**Response:** `200 OK`

### Trigger Turnout Cutoff

**POST** `/api/settings/turnout-cutoff`

Trigger turnout cutoff for today.

**Authentication:** Staff only

**Response:** `200 OK`
```json
{
  "message": "Turnout cutoff activated for today",
  "turnout_cutoff_date": "2024-01-15"
}
```

### Demo Data Management

#### Get Demo Data Status

**GET** `/api/settings/demo-data/status`

**Authentication:** Admin only

**Response:** `200 OK`

#### Seed Demo Data

**POST** `/api/settings/demo-data/seed`

**Authentication:** Admin only

**Response:** `200 OK`

#### Clean Demo Data

**POST** `/api/settings/demo-data/clean`

**Authentication:** Admin only

**Response:** `200 OK`

### Scheduler Management

#### Get Scheduler Status

**GET** `/api/settings/scheduler/status`

Get the current status of the task scheduler.

**Authentication:** Admin only

**Response:** `200 OK`
```json
{
  "scheduler_running": true,
  "jobs": [
    {
      "id": "generate_health_tasks",
      "name": "Generate Daily Health Tasks",
      "next_run": "2024-01-16T00:01:00",
      "trigger": "cron[hour='0', minute='1']"
    }
  ],
  "todays_health_tasks": {
    "medication": 5,
    "wound_care": 2,
    "health_check": 3,
    "total": 10
  }
}
```

#### Preview Health Tasks

**GET** `/api/settings/scheduler/preview/{target_date}`

Preview health tasks for a given date.

**Authentication:** Admin only

**Path Parameters:**
- `target_date` (date, required)

**Response:** `200 OK`

#### Generate Health Tasks

**POST** `/api/settings/scheduler/generate/{target_date}`

Manually generate health tasks for a given date.

**Authentication:** Admin only

**Path Parameters:**
- `target_date` (date, required)

**Response:** `200 OK`

#### Run Task Rollover

**POST** `/api/settings/scheduler/rollover`

Move past incomplete tasks to backlog.

**Authentication:** Admin only

**Response:** `200 OK`

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "detail": "Error message describing what went wrong"
}
```

### 401 Unauthorized
```json
{
  "detail": "Not authenticated"
}
```

### 403 Forbidden
```json
{
  "detail": "Not authorized to perform this action"
}
```

### 404 Not Found
```json
{
  "detail": "Resource not found"
}
```

### 409 Conflict
```json
{
  "detail": "Conflict with existing resource"
}
```

### 422 Validation Error
```json
{
  "detail": [
    {
      "loc": ["body", "field_name"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

### 500 Internal Server Error
```json
{
  "detail": "Internal server error"
}
```

---

## Common Data Types

### User Roles
- `public`: Guest/public user
- `livery`: Livery client
- `coach`: Training coach
- `admin`: Administrator

### Booking Types
- `public`: Public/external booking
- `livery`: Livery client booking
- `event`: Special event
- `maintenance`: Maintenance block
- `training_clinic`: Training clinic

### Booking Status
- `pending`: Awaiting approval
- `confirmed`: Confirmed booking
- `cancelled`: Cancelled

### Service Categories
- `farrier`: Farrier services
- `dentist`: Dental services
- `vet`: Veterinary services
- `rehab`: Rehabilitation services

### Request Status
- `pending`: Awaiting review/quote
- `quoted`: Quote provided
- `approved`: Approved, ready to schedule
- `scheduled`: Scheduled with staff
- `completed`: Service completed
- `cancelled`: Request cancelled

### Turnout Types
- `out`: Turn out to field
- `in`: Keep in stable

### Leave Types
- `annual`: Annual leave
- `unpaid`: Unpaid leave
- `toil`: Time off in lieu
- `extended`: Extended leave

---

## Rate Limiting

The API does not currently implement rate limiting, but this may be added in future versions.

## Pagination

List endpoints that return large datasets do not currently implement pagination. All results are returned in a single response.

## Versioning

The API is currently at version 1.0.0. The version is included in the API documentation but not in the URL path.
