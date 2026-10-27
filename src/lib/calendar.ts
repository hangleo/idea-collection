import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

export type CalendarOption = {
  id: string;
  title: string;
  color?: string;
  isGoogle: boolean;
  calendar: Calendar.ExpoCalendar;
};

function detectGoogle(calendar: Calendar.ExpoCalendar): boolean {
  const haystack = [
    String(calendar.source?.name ?? ''),
    String(calendar.source?.type ?? ''),
    String(calendar.ownerAccount ?? ''),
    String(calendar.title ?? ''),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes('google') || haystack.includes('gmail') || haystack.includes('com.google');
}

export async function ensureCalendarPermission(): Promise<boolean> {
  const response = await Calendar.requestCalendarPermissions();
  return response.status === 'granted';
}

export async function getWritableCalendars(): Promise<CalendarOption[]> {
  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  return calendars
    .filter((c) => c.allowsModifications && (Platform.OS !== 'android' || c.isVisible !== false))
    .map((c) => ({
      id: c.id,
      title: c.title,
      color: c.color,
      isGoogle: detectGoogle(c),
      calendar: c,
    }))
    .sort((a, b) => Number(b.isGoogle) - Number(a.isGoogle) || a.title.localeCompare(b.title));
}

export async function addIdeaToCalendar(
  option: CalendarOption,
  input: { title: string; notes: string; startDate: Date; endDate: Date },
): Promise<string | null> {
  try {
    const result = await option.calendar.addEventWithForm({
      title: input.title,
      notes: input.notes,
      startDate: input.startDate,
      endDate: input.endDate,
    });
    if (result.action === 'canceled') return null;
    return result.id ?? `local-${Date.now()}`;
  } catch {
    // Fallback: create silently without the system form
    const event = await option.calendar.createEvent({
      title: input.title,
      notes: input.notes,
      startDate: input.startDate,
      endDate: input.endDate,
      calendarId: option.id,
    });
    return event.id ?? `local-${Date.now()}`;
  }
}
