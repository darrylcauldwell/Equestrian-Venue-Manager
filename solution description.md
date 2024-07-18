# Solution Description

## Relational Database

Database Type: PostgreSQL

Users Table: Stores user account information.

| Field | Type | Description |
| --- | --- | --- |
| user_id | SERIAL | Unique user identifier |
| user_email | VARCHAR(100) | User's email address |
| user_name | VARCHAR(50) | User's name |
| user_phone | INTEGER | User's phone number |
| user_livery_status | BOOLEAN | Is user a yard livery |
| user_staff_status | BOOLEAN | Is user a yard staff |
| user_hashed_password | VARCHAR(100) | Hashed user password |

Arena Table: Contains data related to the arenas.

| Field | Type | Description |
| --- | --- | --- |
| arena_id | SERIAL | Unique arena identifier |
| arena_name | VARCHAR(50) | Arena name |
| arena_description | VARCHAR(100) | Description of  arena |

Calendar Events Table: Contains data related to calendar events

| Field | Type | Description |
| --- | --- | --- |
| calendar_event_id | SERIAL | Unique calendar entry identifier |
| calendar_event_description | VARCHAR(100) | Calendar entry description |
| calendar_event_arena_id | INTEGER | Unique arena identifier |
| calendar_event_payment_ref | INTEGER | Identifier from external payment system or livery status |
| calendar_event_start_time | TIMESTAMP | Calendar entry start time |
| calendar_event_end_time | TIMESTAMP | Calendar entry end time |
| calendar_event_type | ENUM | Calendar entry type,  enumeration: external, event, livery,  maintenance |
| calendar_event_user_id | INTEGER | User ID of the calendar event booker |

Horses Table: Contains data related to the horses.

| Field | Type | Description |
| --- | --- | --- |
| horse_id | SERIAL | Unique horse identifier |
| horse_name | VARCHAR(100) | Horse's name |
| horse_colour | VARCHAR(50) | Horse's colour |
| horse_birth_year | INTEGER | Horse's birth year |
| horse_owner_id | INTEGER | User ID of the horse's owner |

## NoSQL Database

Each relational database table could become a collection:

Users collection:

```json
{
  "users": [
    {
      "user_id": "u1",
      "user_email": "user@example.com",
      "user_name": "John Doe",
      "user_phone": 1234567890,
      "user_livery_status": true,
      "user_staff_status": false,
      "user_hashed_password": "hashedpassword123"
    },
    {
      "user_id": "u2",
      "user_email": "user1@example.com",
      "user_name": "Joan Doe",
      "user_phone": 1234567890,
      "user_livery_status": true,
      "user_staff_status": false,
      "user_hashed_password": "hashedpassword123"
    }
  ]
}
```

Arenas collection:

```json
{
  "_id": "a1",
  "name": "Indoor Arena",
  "description": "Indoor arena"
},
{
  "_id": "a2",
  "name": "Outdoor Arena",
  "description": "All weather outdoor arena"
}
```

Future Calendar Events collection:

```json
{
  "events": [
    {
    "event_id": "e3",
    "description": "Jumping Lesson",
    "arena_id": "a1",
    "payment_ref": "pay123",
    "start_time": "2024-07-17T14:00:00Z",
    "end_time": "2024-07-17T16:00:00Z",
    "event_type": "external",
    "user": "n1"
    },
     {
    "event_id": "e4",
    "description": "Dressage Competition",
    "arena_id": "a1",
    "payment_ref": "pay123",
    "start_time": "2024-07-17T14:00:00Z",
    "end_time": "2024-07-17T16:00:00Z",
    "event_type": "event",
    "user": "n1"
    }   
  ]
}
```

Historical Calendar Events collection:

```json
{
  "events": [
    {
    "event_id": "e1",
    "description": "Jumping Lesson",
    "arena_id": "a1",
    "payment_ref": "pay123",
    "start_time": "2024-07-17T14:00:00Z",
    "end_time": "2024-07-17T16:00:00Z",
    "event_type": "external",
    "user": "n1"
    },
     {
    "event_id": "e2",
    "description": "Dressage Competition",
    "arena_id": "a1",
    "payment_ref": "pay123",
    "start_time": "2024-07-17T14:00:00Z",
    "end_time": "2024-07-17T16:00:00Z",
    "event_type": "event",
    "user": "n1"
    }   
  ]
}
```

Horse collection:

```json
{
  "horses": [
    {
      "horse_id": "h1",
      "horse_name": "Wellbrow Ethan",
      "horse_colour": "Black",
      "horse_birth_year": 2011,
      "horse_owner_id": "u1"
    },
    {
      "horse_id": "h2",
      "horse_name": "Ridge Cross Lad",
      "horse_colour": "Chestnut",
      "horse_birth_year": 2013,
      "horse_owner_id": "u1"
    }
  ]
}
```

## Internal API

Python Flask based API which offers following routes

User Registration Endpoint:
Endpoint: /api/v1/user/account
Method: POST
Description: Allows new users to register by providing their name, email, and password.

User Update Endpoint:
Endpoint: /api/v1/user/account
Method: PUT
Description: Allows new users to update their record by providing their name, email, and password.

User Login Endpoint:
Endpoint: /api/v1/user/sign-in
Method: POST
Description: Allows registered users to log in by providing their email and password.

User Logout Endpoint:
Endpoint: /api/v1/user/sign-out
Method: POST
Description: Allows users to logout

Refresh Token Endpoint:
Endpoint: /api/v1/user/refresh
Method: POST
Description: Allows users to refresh their access token by providing a valid refresh token. This ensures continued access to protected resources without the need for re-authentication.

Create Horse Endpoint:
Endpoint: /api/v1/horse/
Method: POST
Description: Allows users to create a new horse profile by providing details such as the horse's name, colour, and year of birth. This information is added to the user's list of horses.

List Horses Endpoint:
Endpoint: /api/v1/horse/
Method: GET
Description: Retrieves a list of all horses associated with the user's account. Users can view and manage their horse profiles conveniently.

Create Calendar Event Endpoint:
Endpoint: /api/v1/calendar/
Method: POST
Description: Allows users to create a new event

List Calendar Events Endpoint:
Endpoint: /api/v1/calendar/
Method: GET
Description: Retrieves a list of all available slots, calendar events associated with the user's account and if livery events associated with all user's account type livery.

Create Arenas Endpoint:
Endpoint: /api/v1/arena/
Method: POST
Description: Add an arena.

Get Arena Endpoint:
Endpoint: /api/v1/arena/<arena_id>
Method: GET
Description: Retrieve an arena.

Update Arenas Endpoint:
Endpoint: /api/v1/arena/<arena_id>
Method: PUT
Description: Update an arena.

List Arenas Endpoint:
Endpoint: /api/v1/arena/
Method: GET
Description: Retrieves a list of all arenas.
