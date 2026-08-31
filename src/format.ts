const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function addMonths(iso: string, months: number): string {
  const date = parseISODate(iso);
  date.setMonth(date.getMonth() + months);
  return toISODate(date);
}

export function monthBounds(iso: string): { start: string; end: string } {
  const date = parseISODate(iso);
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: toISODate(start), end: toISODate(end) };
}

export function daysInMonth(iso: string): number {
  const date = parseISODate(iso);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function monthYearLabel(iso: string): string {
  const date = parseISODate(iso);
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

export function monthYearUpper(iso: string): string {
  return monthYearLabel(iso).toUpperCase();
}

/** Ledger date: D/MM/YYYY with no leading zero on the day. */
export function formatLedgerDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${Number(d)}/${m}/${y}`;
}

export function formatIndianInt(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded).toString();
  if (digits.length <= 3) {
    return sign + digits;
  }
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${sign}${rest},${last3}`;
}

export function formatQty(value: number | null | undefined): string {
  if (value == null) {
    return '';
  }
  if (Number.isInteger(value)) {
    return formatIndianInt(value);
  }
  const fixed = value.toFixed(2);
  const [whole, frac] = fixed.split('.');
  return `${formatIndianInt(Number(whole))}.${frac}`;
}

export function formatRupees(value: number): string {
  return `₹${formatIndianInt(value)}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function datesInRange(start: string, end: string): string[] {
  const out: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}
