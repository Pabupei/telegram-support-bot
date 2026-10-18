# Telegram Support Management Bot

A complete Telegram-based customer support system built with **Node.js**, **Telegram Bot API**, and **SQLite**.

The bot allows users to create support tickets, choose categories and priorities, continue conversations inside existing tickets, and track ticket status.

Administrators can manage tickets through a dedicated admin panel, assign tickets, reply to users, change priorities, filter requests, track activity, and view support statistics.

---

## Features

### User Features

- Create support tickets
- Choose ticket category
- Choose ticket priority
- View personal tickets
- View ticket status
- Continue conversations inside existing tickets
- View full conversation history
- Receive replies from support
- Receive ticket status updates
- Receive notification when support starts working on a ticket

### Admin Features

- Dedicated admin panel
- View all support tickets
- Assign tickets to an operator
- Reply directly to users
- View full conversation history
- Change ticket priority
- Change ticket status
- Reopen closed tickets
- Filter tickets
- View unassigned tickets
- Track last activity
- Track first response time
- View support statistics

---

## Ticket Categories

The bot currently supports:

- Technical
- Billing
- General

Categories can be extended or changed depending on the project requirements.

---

## Priority Levels

Each ticket can have one of four priority levels:

- Low
- Medium
- High
- Urgent

Administrators can change the priority after the ticket has been created.

---

## Ticket Statuses

Tickets can move through the following statuses:

- Open
- In Progress
- Closed

Closed tickets can also be reopened by the administrator.

---

## Conversation System

Every ticket has its own conversation history.

Messages are stored separately in the database and include:

- User messages
- Support replies
- Message timestamps
- Ticket association

Users can continue sending messages without creating a new ticket.

Administrators can open the complete conversation and respond directly from the admin panel.

---

## Operator Assignment

Administrators can assign a ticket using the:

`Assign to Me`

button.

When a ticket is assigned:

- the operator is stored in the database
- the ticket can automatically move to `In Progress`
- the user receives a notification
- the assigned operator is displayed inside the ticket

The system is structured so that multi-operator support can be added later.

---

## Ticket Filters

The admin panel supports filtering tickets by:

- All tickets
- Open
- In Progress
- Closed
- High & Urgent
- Unassigned

This allows support staff to quickly find the most important requests.

---

## Statistics

The admin dashboard provides support statistics including:

### Ticket Status

- Total tickets
- Open tickets
- In Progress tickets
- Closed tickets

### Priority Statistics

- Low
- Medium
- High
- Urgent

### Category Statistics

- Technical
- Billing
- General

### Support Performance

- Unassigned tickets
- Average first response time

---

## Database

The project uses **SQLite** for local data storage.

The database stores:

### Users

- Telegram ID
- Username
- First name
- Registration date

### Tickets

- Ticket ID
- User Telegram ID
- Message
- Category
- Priority
- Status
- Assigned operator
- First response time
- Last activity time
- Creation time

### Ticket Messages

- Message ID
- Ticket ID
- Sender type
- Telegram ID
- Message text
- Creation time

---

## Tech Stack

- JavaScript
- Node.js
- Telegram Bot API
- node-telegram-bot-api
- SQLite
- sqlite3
- dotenv

---

## Project Structure

```text
telegram-support-bot/
│
├── index.js
├── database.js
├── package.json
├── package-lock.json
├── .env
├── .gitignore
├── README.md
└── support.db