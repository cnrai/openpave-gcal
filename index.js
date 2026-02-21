#!/usr/bin/env node
/**
 * Google Calendar CLI - Secure Token Version
 * 
 * Uses the PAVE sandbox secure token system for authentication.
 * Tokens are never visible to sandbox code - they're injected by the host.
 * 
 * Token configuration in ~/.pave/permissions.yaml:
 * {
 *   "tokens": {
 *     "google-calendar": {
 *       "env": "GOOGLE_CALENDAR_ACCESS_TOKEN",
 *       "type": "oauth",
 *       "domains": ["www.googleapis.com", "*.googleapis.com"],
 *       "placement": { "type": "header", "name": "Authorization", "format": "Bearer {token}" },
 *       "refreshEnv": "GOOGLE_CALENDAR_REFRESH_TOKEN",
 *       "refreshUrl": "https://oauth2.googleapis.com/token",
 *       "clientIdEnv": "GOOGLE_CALENDAR_CLIENT_ID",
 *       "clientSecretEnv": "GOOGLE_CALENDAR_CLIENT_SECRET"
 *     }
 *   }
 * }
 */

// Parse command line arguments  
const args = process.argv.slice(2);

function parseArgs() {
  const parsed = {
    command: null,
    positional: [],
    options: {}
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('-')) {
      if (arg.startsWith('--')) {
        const [key, value] = arg.slice(2).split('=', 2);
        if (value !== undefined) {
          parsed.options[key] = value;
        } else if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          parsed.options[key] = args[i + 1];
          i++;
        } else {
          parsed.options[key] = true;
        }
      } else {
        const flag = arg.slice(1);
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          parsed.options[flag] = args[i + 1];
          i++;
        } else {
          parsed.options[flag] = true;
        }
      }
    } else {
      if (parsed.command === null) {
        parsed.command = arg;
      } else {
        parsed.positional.push(arg);
      }
    }
  }
  
  return parsed;
}

// Helper function to build query strings (URLSearchParams not available in sandbox)
function buildQueryString(params) {
  const parts = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }
  return parts.join('&');
}

// Helper function to format time for display
function formatTime(dateTimeStr) {
  if (!dateTimeStr) return '';
  const date = new Date(dateTimeStr);
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
}

// Helper function to format date for display
function formatDate(dateTimeStr) {
  if (!dateTimeStr) return '';
  const date = new Date(dateTimeStr);
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
}

// Helper function to format date range
function formatDateRange(startStr, endStr) {
  if (!startStr) return '';
  
  const start = new Date(startStr);
  const end = endStr ? new Date(endStr) : null;
  
  const startDate = start.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
  
  if (!end || start.toDateString() === end.toDateString()) {
    return startDate;
  }
  
  const endDate = end.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
  
  return `${startDate} - ${endDate}`;
}

// Calendar API client using secure tokens
class CalendarClient {
  constructor() {
    // Check if secure token system is available
    if (typeof hasToken === 'undefined') {
      throw new Error('Secure token system not available. Use: pave-run gcal.js');
    }

    if (!hasToken('google-calendar')) {
      console.error('Google Calendar token not configured.');
      console.error('');
      console.error('Add to ~/.pave/permissions.yaml:');
      console.error(`tokens:
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
    clientSecretEnv: GOOGLE_CALENDAR_CLIENT_SECRET`);
      console.error('');
      console.error('Then set environment variables:');
      console.error('  GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, GOOGLE_CALENDAR_REFRESH_TOKEN');
      throw new Error('Google Calendar token not configured');
    }

    this.baseUrl = 'https://www.googleapis.com/calendar/v3';
  }

  /**
   * Make authenticated request to Calendar API
   */
  request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = authenticatedFetch('google-calendar', url, {
        timeout: 15000,
        ...options
      });

      if (!response.ok) {
        const error = response.json();
        const err = new Error(error.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        err.status = response.status;
        err.code = error.error?.code;
        err.data = error;
        throw err;
      }

      return response.json();
    } catch (error) {
      if (error.message.includes('Network permission denied')) {
        throw new Error('Network permission required: --allow-network=googleapis.com');
      }
      throw error;
    }
  }

  /**
   * List all calendars
   */
  listCalendars(options = {}) {
    const params = buildQueryString({
      maxResults: options.maxResults || 250,
      showDeleted: options.showDeleted || false,
      showHidden: options.showHidden || false
    });

    return this.request(`/users/me/calendarList?${params}`);
  }

  /**
   * Get calendar by ID
   */
  getCalendar(calendarId) {
    return this.request(`/calendars/${encodeURIComponent(calendarId)}`);
  }

  /**
   * List events from a calendar
   */
  listEvents(calendarId = 'primary', options = {}) {
    const params = buildQueryString({
      timeMin: options.timeMin,
      timeMax: options.timeMax,
      q: options.query,
      maxResults: options.maxResults || 250,
      singleEvents: options.singleEvents !== false,
      orderBy: options.orderBy || 'startTime',
      showDeleted: options.showDeleted || false
    });

    return this.request(`/calendars/${encodeURIComponent(calendarId)}/events?${params}`);
  }

  /**
   * Get a specific event
   */
  getEvent(calendarId, eventId) {
    return this.request(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`);
  }

  /**
   * Get today's events
   */
  getTodayEvents(calendarId = 'primary', options = {}) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    return this.listEvents(calendarId, {
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      maxResults: options.maxResults || 50,
      ...options
    });
  }

  /**
   * Get upcoming events (next N days)
   */
  getUpcomingEvents(days = 7, calendarId = 'primary', options = {}) {
    const now = new Date();
    const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return this.listEvents(calendarId, {
      timeMin: now.toISOString(),
      timeMax: endDate.toISOString(),
      maxResults: options.maxResults || 100,
      ...options
    });
  }

  /**
   * Search events across timeframe
   */
  searchEvents(query, options = {}) {
    const calendarId = options.calendar || 'primary';
    return this.listEvents(calendarId, {
      q: query,
      timeMin: options.timeMin,
      timeMax: options.timeMax,
      maxResults: options.maxResults || 50,
      ...options
    });
  }
}

// Event formatting utilities
class EventFormatter {
  static format(event, options = {}) {
    const start = event.start?.dateTime || event.start?.date;
    const end = event.end?.dateTime || event.end?.date;
    const isAllDay = !event.start?.dateTime;
    
    return {
      id: event.id,
      summary: event.summary || '(No title)',
      description: event.description || '',
      location: event.location || '',
      start,
      end,
      isAllDay,
      status: event.status,
      created: event.created,
      updated: event.updated,
      htmlLink: event.htmlLink,
      attendees: event.attendees || [],
      attendeeCount: (event.attendees || []).length,
      organizer: event.organizer,
      recurrence: event.recurrence,
      reminders: event.reminders
    };
  }

  static formatTimeRange(event) {
    const formatted = this.format(event);
    
    if (formatted.isAllDay) {
      return 'All day';
    }

    const startTime = formatTime(formatted.start);
    const endTime = formatTime(formatted.end);
    
    return `${startTime} - ${endTime}`;
  }

  static formatSummary(event, options = {}) {
    const formatted = this.format(event);
    const timeRange = this.formatTimeRange(event);
    
    let summary = `${timeRange.padEnd(20)} ${formatted.summary}`;
    
    if (options.showLocation && formatted.location) {
      summary += `\n${''.padEnd(22)} 📍 ${formatted.location}`;
    }
    
    if (options.showAttendees && formatted.attendeeCount > 0) {
      summary += `\n${''.padEnd(22)} 👥 ${formatted.attendeeCount} attendee(s)`;
    }
    
    if (options.showStatus && formatted.status !== 'confirmed') {
      summary += `\n${''.padEnd(22)} ⚠️  ${formatted.status}`;
    }
    
    return summary;
  }
}

// Print functions
function printHelp() {
  console.log(`
📅 Google Calendar CLI - Secure Token Version

USAGE:
  node gcal.js <command> [options]

COMMANDS:
  auth                     Show authentication status
  calendars               List all calendars
  today                   Show today's events
  upcoming [days]         Show upcoming events (default: 7 days)
  list [calendar]         List events from specific calendar
  search <query>          Search events
  event <eventId>         Get specific event details

OPTIONS:
  -c, --calendar <id>     Calendar ID (default: primary)
  -n, --max <count>       Maximum results (default: varies by command)
  -q, --query <query>     Search query
  -f, --from <date>       Start date (YYYY-MM-DD)
  -t, --to <date>         End date (YYYY-MM-DD)
  -d, --days <number>     Number of days for upcoming events
  --summary               Show brief summary only
  --full                  Show full event details
  --json                  Output raw JSON

EXAMPLES:
  node gcal.js today --summary
  node gcal.js upcoming 14 --calendar primary
  node gcal.js search "meeting" --from 2026-01-01 --to 2026-01-31
  node gcal.js calendars --json
  node gcal.js list primary --max 20

TOKEN SETUP:
  Tokens are configured in ~/.pave/permissions.yaml
  Environment variables needed:
    GOOGLE_CALENDAR_CLIENT_ID       - OAuth client ID
    GOOGLE_CALENDAR_CLIENT_SECRET   - OAuth client secret  
    GOOGLE_CALENDAR_REFRESH_TOKEN   - OAuth refresh token
    GOOGLE_CALENDAR_ACCESS_TOKEN    - (optional) Current access token
`);
}

function checkAuth() {
  try {
    const client = new CalendarClient();
    const calendars = client.listCalendars({ maxResults: 1 });
    
    console.log('✅ Authentication successful');
    console.log(`📅 Access to ${calendars.items?.length || 0} calendar(s) confirmed`);
    console.log('🔐 Using secure token system (credentials not exposed to sandbox)');
    
    if (calendars.items && calendars.items.length > 0) {
      const primary = calendars.items.find(cal => cal.primary);
      if (primary) {
        console.log(`📧 Primary calendar: ${primary.summary}`);
      }
    }
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    
    if (error.message.includes('not configured')) {
      console.error('💡 Configure google-calendar token in ~/.pave/permissions.yaml');
    }
    
    process.exit(1);
  }
}

function listCalendars(args) {
  try {
    const client = new CalendarClient();
    const options = {
      maxResults: args.options.max ? parseInt(args.options.max) : 250
    };
    
    const calendars = client.listCalendars(options);
    
    if (args.options.json) {
      console.log(JSON.stringify(calendars, null, 2));
      return;
    }
    
    console.log(`📅 Found ${calendars.items?.length || 0} calendar(s):\n`);
    
    if (calendars.items && calendars.items.length > 0) {
      for (const cal of calendars.items) {
        const primary = cal.primary ? ' (PRIMARY)' : '';
        const access = cal.accessRole ? ` [${cal.accessRole}]` : '';
        
        console.log(`📅 ${cal.summary}${primary}${access}`);
        
        if (!args.options.summary) {
          console.log(`   ID: ${cal.id}`);
          if (cal.description) {
            console.log(`   Description: ${cal.description}`);
          }
          if (cal.timeZone) {
            console.log(`   Timezone: ${cal.timeZone}`);
          }
          console.log('');
        }
      }
    }
  } catch (error) {
    console.error('❌ Failed to list calendars:', error.message);
    process.exit(1);
  }
}

function showToday(args) {
  try {
    const client = new CalendarClient();
    const calendarId = args.options.calendar || args.options.c || 'primary';
    
    const events = client.getTodayEvents(calendarId, {
      maxResults: args.options.max ? parseInt(args.options.max) : 50
    });
    
    if (args.options.json) {
      console.log(JSON.stringify(events, null, 2));
      return;
    }
    
    const today = formatDate(new Date().toISOString());
    console.log(`📅 Events for ${today}:\n`);
    
    if (events.items && events.items.length > 0) {
      for (const event of events.items) {
        const summary = EventFormatter.formatSummary(event, {
          showLocation: !args.options.summary,
          showAttendees: args.options.full,
          showStatus: args.options.full
        });
        
        console.log(`⏰ ${summary}\n`);
      }
    } else {
      console.log('📅 No events scheduled for today');
    }
  } catch (error) {
    console.error('❌ Failed to get today\'s events:', error.message);
    process.exit(1);
  }
}

function showUpcoming(args) {
  try {
    const client = new CalendarClient();
    const days = args.positional && args.positional[0] ? parseInt(args.positional[0]) : 
                 args.options.days ? parseInt(args.options.days) : 
                 args.options.d ? parseInt(args.options.d) : 7;
    const calendarId = args.options.calendar || args.options.c || 'primary';
    
    const events = client.getUpcomingEvents(days, calendarId, {
      maxResults: args.options.max ? parseInt(args.options.max) : 100
    });
    
    if (args.options.json) {
      console.log(JSON.stringify(events, null, 2));
      return;
    }
    
    console.log(`📅 Upcoming events (next ${days} days):\n`);
    
    if (events.items && events.items.length > 0) {
      let currentDate = '';
      let count = 0;
      const maxDisplay = args.options.summary ? 10 : 50;
      
      for (const event of events.items) {
        if (count >= maxDisplay) break;
        
        const start = event.start?.dateTime || event.start?.date;
        const eventDate = formatDate(start);
        
        if (eventDate !== currentDate) {
          currentDate = eventDate;
          console.log(`--- ${eventDate} ---`);
        }
        
        const summary = EventFormatter.formatSummary(event, {
          showLocation: !args.options.summary,
          showAttendees: args.options.full,
          showStatus: args.options.full
        });
        
        console.log(`⏰ ${summary}\n`);
        count++;
      }
      
      if (events.items.length > maxDisplay) {
        console.log(`... and ${events.items.length - maxDisplay} more events`);
        console.log('💡 Use --max to increase limit or remove --summary for more details');
      }
    } else {
      console.log(`📅 No upcoming events in the next ${days} days`);
    }
  } catch (error) {
    console.error('❌ Failed to get upcoming events:', error.message);
    process.exit(1);
  }
}

function searchEvents(args) {
  try {
    if (!args.positional || args.positional.length === 0) {
      console.error('❌ Search query required');
      console.error('Usage: node gcal.js search "meeting"');
      process.exit(1);
    }
    
    const client = new CalendarClient();
    const query = args.positional[0];
    const calendarId = args.options.calendar || args.options.c || 'primary';
    
    const options = {
      calendar: calendarId,
      maxResults: args.options.max ? parseInt(args.options.max) : 50
    };
    
    if (args.options.from || args.options.f) {
      const fromDate = args.options.from || args.options.f;
      options.timeMin = new Date(fromDate).toISOString();
    }
    
    if (args.options.to || args.options.t) {
      const toDate = args.options.to || args.options.t;
      options.timeMax = new Date(toDate).toISOString();
    }
    
    const events = client.searchEvents(query, options);
    
    if (args.options.json) {
      console.log(JSON.stringify(events, null, 2));
      return;
    }
    
    console.log(`🔍 Search results for "${query}":\n`);
    
    if (events.items && events.items.length > 0) {
      for (const event of events.items) {
        const start = event.start?.dateTime || event.start?.date;
        const eventDate = formatDate(start);
        
        const summary = EventFormatter.formatSummary(event, {
          showLocation: !args.options.summary,
          showAttendees: args.options.full,
          showStatus: args.options.full
        });
        
        console.log(`📅 ${eventDate}`);
        console.log(`⏰ ${summary}\n`);
      }
    } else {
      console.log(`📅 No events found matching "${query}"`);
    }
  } catch (error) {
    console.error('❌ Search failed:', error.message);
    process.exit(1);
  }
}

function showEvent(args) {
  try {
    if (!args.positional || args.positional.length === 0) {
      console.error('❌ Event ID required');
      console.error('Usage: node gcal.js event <eventId>');
      process.exit(1);
    }
    
    const client = new CalendarClient();
    const eventId = args.positional[0];
    const calendarId = args.options.calendar || args.options.c || 'primary';
    
    const event = client.getEvent(calendarId, eventId);
    
    if (args.options.json) {
      console.log(JSON.stringify(event, null, 2));
      return;
    }
    
    const formatted = EventFormatter.format(event);
    
    console.log(`📅 Event Details:\n`);
    console.log(`Title: ${formatted.summary}`);
    console.log(`Time: ${EventFormatter.formatTimeRange(event)}`);
    console.log(`Date: ${formatDate(formatted.start)}`);
    
    if (formatted.location) {
      console.log(`Location: ${formatted.location}`);
    }
    
    if (formatted.description) {
      console.log(`Description: ${formatted.description}`);
    }
    
    if (formatted.attendees.length > 0) {
      console.log(`\nAttendees (${formatted.attendees.length}):`);
      for (const attendee of formatted.attendees.slice(0, 10)) {
        const name = attendee.displayName || attendee.email;
        const status = attendee.responseStatus || 'unknown';
        console.log(`  - ${name} (${status})`);
      }
      
      if (formatted.attendees.length > 10) {
        console.log(`  ... and ${formatted.attendees.length - 10} more`);
      }
    }
    
    console.log(`\nStatus: ${formatted.status}`);
    console.log(`Created: ${new Date(formatted.created).toLocaleString()}`);
    console.log(`Updated: ${new Date(formatted.updated).toLocaleString()}`);
    
    if (formatted.htmlLink) {
      console.log(`Link: ${formatted.htmlLink}`);
    }
  } catch (error) {
    console.error('❌ Failed to get event:', error.message);
    process.exit(1);
  }
}

// Main execution function
function main() {
  const parsed = parseArgs();
  
  if (!parsed.command || parsed.command === 'help' || parsed.options.help) {
    printHelp();
    return;
  }
  
  try {
    switch (parsed.command) {
      case 'auth':
        checkAuth();
        break;
        
      case 'calendars':
        listCalendars(parsed);
        break;
        
      case 'today':
        showToday(parsed);
        break;
        
      case 'upcoming':
        showUpcoming(parsed);
        break;
        
      case 'search':
        searchEvents(parsed);
        break;
        
      case 'event':
        showEvent(parsed);
        break;
        
      case 'list':
        // Alias for upcoming with no time limit
        parsed.options.days = '365'; // List events for next year
        showUpcoming(parsed);
        break;
        
      default:
        console.error(`❌ Unknown command: ${parsed.command}`);
        console.error('💡 Run: node gcal.js help');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Execution failed:', error.message);
    
    if (error.message.includes('Secure token system')) {
      console.error('💡 This script must run in sandbox: pave-run gcal.js');
    }
    
    if (parsed.options.json) {
      console.error(JSON.stringify({
        error: error.message,
        status: error.status,
        data: error.data
      }, null, 2));
    } else if (process.env.DEBUG) {
      console.error('Stack trace:', error.stack);
    }
    
    process.exit(1);
  }
}

// Execute
main();