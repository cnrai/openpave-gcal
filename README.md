# OpenPAVE Google Calendar Skill

Secure Google Calendar management skill for the PAVE sandbox environment. Read and manage calendar events with OAuth authentication using the secure token system.

## Features

- **🔐 Secure Authentication** - OAuth tokens never exposed to sandbox code
- **📅 Calendar Management** - List calendars, view events, search
- **⏰ Time-based Queries** - Today's events, upcoming events, date ranges
- **🔍 Event Search** - Search events with queries and filters
- **📱 Multiple Output Formats** - Summary, full details, or JSON

## Installation

This skill runs in the PAVE sandbox environment with secure token management.

## Setup

### 1. Configure Token Permissions

Add to `~/.pave/permissions.yaml`:

```yaml
tokens:
  google-calendar:
    env: GOOGLE_CALENDAR_ACCESS_TOKEN
    type: oauth
    domains:
      - www.googleapis.com
      - "*.googleapis.com"
    placement:
      type: header
      name: Authorization
      format: "Bearer {token}"
    refreshEnv: GOOGLE_CALENDAR_REFRESH_TOKEN
    refreshUrl: https://oauth2.googleapis.com/token
    clientIdEnv: GOOGLE_CALENDAR_CLIENT_ID
    clientSecretEnv: GOOGLE_CALENDAR_CLIENT_SECRET
```

### 2. Set Environment Variables

Create a `.env` file or add to your environment:

```bash
# Google OAuth credentials (from Google Cloud Console)
GOOGLE_CALENDAR_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CALENDAR_CLIENT_SECRET=your-client-secret
GOOGLE_CALENDAR_REFRESH_TOKEN=your-refresh-token

# Access token (optional - will be auto-generated)
GOOGLE_CALENDAR_ACCESS_TOKEN=your-access-token
```

### 3. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Google Calendar API**
4. Create OAuth 2.0 credentials (Desktop application)
5. Download the credentials JSON file
6. Use the OAuth 2.0 playground to generate a refresh token with `https://www.googleapis.com/auth/calendar.readonly` scope

## Usage

### Basic Commands

```bash
# Check authentication status
pave-run gcal.js auth

# Show today's events
pave-run gcal.js today --summary

# Show upcoming events (next 7 days)
pave-run gcal.js upcoming --summary

# Show upcoming events for specific number of days
pave-run gcal.js upcoming 14 --summary

# List all calendars
pave-run gcal.js calendars --summary

# Search for events
pave-run gcal.js search "meeting" --summary

# Get specific event details
pave-run gcal.js event <eventId> --summary
```

### Advanced Usage

```bash
# Search events in date range
pave-run gcal.js search "standup" --from 2026-01-01 --to 2026-01-31

# List events from specific calendar
pave-run gcal.js today --calendar "work@company.com"

# Show full event details including attendees
pave-run gcal.js upcoming 7 --full

# Get raw JSON output
pave-run gcal.js calendars --json

# Limit number of results
pave-run gcal.js upcoming --max 10
```

## Commands

| Command | Description | Arguments | Options |
|---------|-------------|-----------|---------|
| `auth` | Show authentication status | | `--summary`, `--json` |
| `calendars` | List all calendars | | `--max <number>`, `--summary`, `--json` |
| `today` | Show today's events | | `--calendar <id>`, `--max <count>`, `--summary`, `--full`, `--json` |
| `upcoming` | Show upcoming events | `[days]` | `--calendar <id>`, `--max <count>`, `--days <number>`, `--summary`, `--full`, `--json` |
| `list` | List events from calendar | `[calendar]` | `--calendar <id>`, `--max <count>`, `--summary`, `--full`, `--json` |
| `search` | Search events | `<query>` | `--calendar <id>`, `--max <count>`, `--from <date>`, `--to <date>`, `--summary`, `--full`, `--json` |
| `event` | Get specific event details | `<eventId>` | `--calendar <id>`, `--summary`, `--json` |

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-c, --calendar <id>` | Calendar ID to query | `primary` |
| `-n, --max <count>` | Maximum results | Varies by command |
| `-d, --days <number>` | Number of days for upcoming | `7` |
| `-f, --from <date>` | Start date (YYYY-MM-DD) | |
| `-t, --to <date>` | End date (YYYY-MM-DD) | |
| `-q, --query <query>` | Search query | |
| `--summary` | Human-readable output | |
| `--full` | Show full event details | |
| `--json` | Raw JSON output | |

## Output Formats

### Summary Format (Human-readable)

```
📅 Events for Fri, Jan 17, 2026:

⏰ 9:00 AM - 10:00 AM   Team Standup
                       📍 Conference Room A
                       👥 5 attendee(s)

⏰ 2:00 PM - 3:00 PM   Project Review
                       📍 https://meet.google.com/abc-defg-hij
```

### Full Format

Includes all event details: attendees, status, creation/update times, and direct links.

### JSON Format

Raw API responses for programmatic use.

## Security Features

- **🔐 Secure Token Management** - OAuth tokens never visible to sandbox code
- **🌐 Domain Restrictions** - Network access limited to Google APIs only  
- **🛡️ Permission Controls** - Minimal filesystem and system access
- **🔄 Auto Token Refresh** - Automatic OAuth token refresh on expiry

## Error Handling

The skill provides helpful error messages for common issues:

- Missing token configuration
- Network permission requirements  
- Invalid date formats
- Calendar access errors
- Event not found

## Examples

### Check Today's Schedule

```bash
pave-run gcal.js today --summary
```

### Weekly Planning

```bash
pave-run gcal.js upcoming 7 --full
```

### Find All Meetings This Month

```bash
pave-run gcal.js search "meeting" --from 2026-01-01 --to 2026-01-31 --summary
```

### Export Calendar Data

```bash
pave-run gcal.js upcoming 30 --json > tmp/calendar-export.json
```

## License

MIT License - see LICENSE file for details.