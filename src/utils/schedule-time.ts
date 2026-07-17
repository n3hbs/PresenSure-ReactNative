import type { CourseSchedule } from '@/types/course-schedule';

export const MANILA_TIME_ZONE = 'Asia/Manila';

export const DAY_LABELS: Record<string, string> = {
  monday: 'Mon',
  mon: 'Mon',
  m: 'Mon',
  tuesday: 'Tue',
  tue: 'Tue',
  t: 'Tue',
  wednesday: 'Wed',
  wed: 'Wed',
  w: 'Wed',
  thursday: 'Thu',
  thu: 'Thu',
  th: 'Thu',
  friday: 'Fri',
  fri: 'Fri',
  f: 'Fri',
  saturday: 'Sat',
  sat: 'Sat',
  s: 'Sat',
  sunday: 'Sun',
  sun: 'Sun',
  su: 'Sun',
};

const DAY_DATE_INDEX: Record<string, number> = {
  monday: 1,
  mon: 1,
  m: 1,
  tuesday: 2,
  tue: 2,
  t: 2,
  wednesday: 3,
  wed: 3,
  w: 3,
  thursday: 4,
  thu: 4,
  th: 4,
  friday: 5,
  fri: 5,
  f: 5,
  saturday: 6,
  sat: 6,
  s: 6,
  sunday: 0,
  sun: 0,
  su: 0,
};

const DAY_SEQUENCE: Record<string, number> = {
  monday: 1,
  mon: 1,
  m: 1,
  tuesday: 2,
  tue: 2,
  t: 2,
  wednesday: 3,
  wed: 3,
  w: 3,
  thursday: 4,
  thu: 4,
  th: 4,
  friday: 5,
  fri: 5,
  f: 5,
  saturday: 6,
  sat: 6,
  s: 6,
  sunday: 7,
  sun: 7,
  su: 7,
};

export function getDayLabel(day: string) {
  const normalized = day.trim().toLowerCase();
  return DAY_LABELS[normalized] ?? normalized.slice(0, 3).replace(/^\w/, (value) => value.toUpperCase());
}

export function getDaySequence(day: string) {
  return DAY_SEQUENCE[day.trim().toLowerCase()] ?? Number.MAX_SAFE_INTEGER;
}

export function getDayCodes(days?: string[] | string) {
  if (Array.isArray(days)) return days;
  if (!days) return [];

  const trimmedDays = days.trim();
  if (!trimmedDays) return [];
  if (DAY_DATE_INDEX[trimmedDays.toLowerCase()] !== undefined || DAY_LABELS[trimmedDays.toLowerCase()]) {
    return [trimmedDays];
  }
  if (/[\s,]+/.test(trimmedDays)) return trimmedDays.split(/[\s,]+/).filter(Boolean);

  const codes: string[] = [];
  let index = 0;

  while (index < trimmedDays.length) {
    const twoLetters = trimmedDays.substring(index, index + 2);
    const twoLettersLower = twoLetters.toLowerCase();
    if (twoLettersLower === 'th' || twoLettersLower === 'su') {
      codes.push(twoLetters);
      index += 2;
    } else {
      codes.push(trimmedDays[index]);
      index += 1;
    }
  }

  return codes.filter(Boolean);
}

export function formatDays(days?: string[] | string) {
  const dayValues = getDayCodes(days).sort((first, second) => getDaySequence(first) - getDaySequence(second));
  return dayValues.length > 0 ? dayValues.map(getDayLabel).join(' | ') : 'No days';
}

export function formatTime(time?: string) {
  if (!time) return 'Not set';

  const [hourValue, minuteValue = '00'] = time.split(':');
  const hour = Number(hourValue);
  if (Number.isNaN(hour)) return time;

  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minuteValue.padStart(2, '0')} ${period}`;
}

export function parseTimeToMinutes(time?: string) {
  if (!time) return Number.MAX_SAFE_INTEGER;
  const [hours = '0', minutes = '0'] = time.split(':');
  return Number(hours) * 60 + Number(minutes);
}

export function getManilaNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    timeZone: MANILA_TIME_ZONE,
    weekday: 'long',
  }).formatToParts(new Date());

  const weekday = parts.find((part) => part.type === 'weekday')?.value.toLowerCase() ?? 'monday';
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');

  return {
    dayIndex: DAY_DATE_INDEX[weekday] ?? 1,
    minutes: hour * 60 + minute,
  };
}

export function isScheduleToday(schedule: CourseSchedule, manilaNow = getManilaNow()) {
  const codes = getDayCodes(schedule.days ?? schedule.day);
  if (codes.length === 0) return true;

  return codes.some((code) => DAY_DATE_INDEX[code.trim().toLowerCase()] === manilaNow.dayIndex);
}

export function isScheduleActive(schedule: CourseSchedule, manilaNow = getManilaNow()) {
  if (!isScheduleToday(schedule, manilaNow)) return false;

  const currentMinutes = manilaNow.minutes;
  const start = parseTimeToMinutes(schedule.start_time);
  const end = parseTimeToMinutes(schedule.end_time);

  return currentMinutes >= start && currentMinutes <= end;
}
