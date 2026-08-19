import { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from './lib/db.js';

const ICS_DOMAIN = 'marketpollen.app';

function icsEscape(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function foldLine(line: string): string {
  if (line.length <= 73) return line;
  const parts: string[] = [];
  let remaining = line;
  parts.push(remaining.slice(0, 73));
  remaining = remaining.slice(73);
  while (remaining.length > 72) {
    parts.push(` ${remaining.slice(0, 72)}`);
    remaining = remaining.slice(72);
  }
  if (remaining) parts.push(` ${remaining}`);
  return parts.join('\r\n');
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function dateStamp(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function utcStamp(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function parseTime(value: string | null): { h: number; m: number } | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  return { h: Number(match[1]), m: Number(match[2]) };
}

function addMinutes(h: number, m: number, extra: number): { h: number; m: number; extraDays: number } {
  const total = h * 60 + m + extra;
  const extraDays = Math.floor(total / (24 * 60));
  const rem = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return { h: Math.floor(rem / 60), m: rem % 60, extraDays };
}

function nextDateStamp(d: Date): string {
  const next = new Date(d);
  next.setDate(next.getDate() + 1);
  return dateStamp(next);
}

function eventToVEvent(event: {
  id: string;
  title: string;
  description: string | null;
  date: Date;
  start_time: string | null;
  end_time: string | null;
  type: string;
  status: string | null;
  location: string | null;
  notes: string | null;
  created_at: Date;
  completed_at: Date | null;
}): string {
  const start = parseTime(event.start_time);
  const end = parseTime(event.end_time);
  const stamp = dateStamp(event.date);
  const lines = [
    'BEGIN:VEVENT',
    `UID:marketpollen-${event.id}@${ICS_DOMAIN}`,
    `DTSTAMP:${utcStamp(event.completed_at || event.created_at)}`,
    `LAST-MODIFIED:${utcStamp(event.completed_at || event.created_at)}`,
  ];

  if (start) {
    const defaultEnd = addMinutes(start.h, start.m, 30);
    const endTime = end ?? defaultEnd;
    const endStamp = !end && defaultEnd.extraDays > 0 ? nextDateStamp(event.date) : stamp;
    lines.push(`DTSTART:${stamp}T${pad(start.h)}${pad(start.m)}00`);
    lines.push(`DTEND:${endStamp}T${pad(endTime.h)}${pad(endTime.m)}00`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${stamp}`);
    lines.push(`DTEND;VALUE=DATE:${nextDateStamp(event.date)}`);
  }

  lines.push(`SUMMARY:${icsEscape(event.title)}`);
  const details = [event.description, event.notes, event.type ? `Type: ${event.type}` : '']
    .filter(Boolean)
    .join('\n');
  if (details) lines.push(`DESCRIPTION:${icsEscape(details)}`);
  if (event.location) lines.push(`LOCATION:${icsEscape(event.location)}`);
  lines.push(event.status === 'cancelled' ? 'STATUS:CANCELLED' : 'STATUS:CONFIRMED');
  lines.push('END:VEVENT');
  return lines.map(foldLine).join('\r\n');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const raw = ((req.query?.id as string) || (req.query?.token as string) || '').trim();
  const token = raw.replace(/\.ics$/i, '');
  if (!token || token.length < 16) return res.status(404).end();

  const store = await prisma.store.findFirst({
    where: { calendar_feed_token: token },
    select: { id: true, name: true },
  });
  if (!store) return res.status(404).end();

  const start = new Date();
  start.setDate(start.getDate() - 30);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setMonth(end.getMonth() + 12);

  const events = await prisma.calendarEvent.findMany({
    where: {
      store_id: store.id,
      date: { gte: start, lte: end },
      NOT: { status: 'cancelled' },
    },
    orderBy: [{ date: 'asc' }, { start_time: 'asc' }],
  });

  const calendarName = `Market Pollen - ${store.name}`;
  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Market Pollen//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine(`X-WR-CALNAME:${icsEscape(calendarName)}`),
    'X-WR-CALDESC:Store events from Market Pollen. Updates automatically.',
    ...events.map(eventToVEvent),
    'END:VCALENDAR',
    '',
  ].join('\r\n');

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="market-pollen.ics"`);
  res.setHeader('Cache-Control', 'public, max-age=300');
  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(200).send(body);
}
