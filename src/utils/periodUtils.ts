import { Transaction } from '../types';

export const INDO_MONTHS: Record<string, number> = {
  januari: 1,
  februari: 2,
  maret: 3,
  april: 4,
  mei: 5,
  juni: 6,
  juli: 7,
  agustus: 8,
  september: 9,
  oktober: 10,
  november: 11,
  desember: 12,
  // Support English & abbreviations
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

export const MONTH_NUMBER_TO_INDO: Record<number, string> = {
  1: 'Januari',
  2: 'Februari',
  3: 'Maret',
  4: 'April',
  5: 'Mei',
  6: 'Juni',
  7: 'Juli',
  8: 'Agustus',
  9: 'September',
  10: 'Oktober',
  11: 'November',
  12: 'Desember',
};

export interface ParsedPeriod {
  isAll: boolean;
  year?: number;
  month?: number; // 1-indexed: 1 = Januari, 12 = Desember
  monthName?: string;
  label: string;
}

/**
 * Parses a period string like "September 2026", "Agustus 2026", or "Semua Periode".
 */
export function parsePeriodString(periodStr: string): ParsedPeriod {
  if (!periodStr || periodStr.trim().toLowerCase().includes('semua')) {
    return { isAll: true, label: 'Semua Periode' };
  }

  const trimmed = periodStr.trim();
  const parts = trimmed.split(/\s+/);

  if (parts.length >= 2) {
    const rawMonth = parts[0].toLowerCase();
    const rawYear = parseInt(parts[1], 10);
    const monthNum = INDO_MONTHS[rawMonth];

    if (monthNum && !isNaN(rawYear) && rawYear > 1970 && rawYear < 2100) {
      const monthName = MONTH_NUMBER_TO_INDO[monthNum] || parts[0];
      return {
        isAll: false,
        year: rawYear,
        month: monthNum,
        monthName,
        label: `${monthName} ${rawYear}`,
      };
    }
  }

  return { isAll: true, label: 'Semua Periode' };
}

/**
 * Calendar-safe extraction of Year and Month from a transaction date string (e.g. "2026-09-04").
 * Avoids any timezone shifting or UTC offsets.
 */
export function parseTxYearMonth(dateStr: string | null | undefined): { year: number; month: number; day: number } | null {
  if (!dateStr || typeof dateStr !== 'string') return null;

  // Match YYYY-MM-DD or YYYY-MM
  const match = dateStr.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/);
  if (match) {
    return {
      year: parseInt(match[1], 10),
      month: parseInt(match[2], 10),
      day: match[3] ? parseInt(match[3], 10) : 1,
    };
  }

  // Fallback if ISO string with T
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T/);
  if (isoMatch) {
    return {
      year: parseInt(isoMatch[1], 10),
      month: parseInt(isoMatch[2], 10),
      day: parseInt(isoMatch[3], 10),
    };
  }

  return null;
}

/**
 * Filters transactions strictly by the selected period.
 * If "Semua Periode", returns all transactions.
 * If a specific month (e.g. "Agustus 2026"), returns ONLY transactions whose date matches that month & year.
 */
export function filterTransactionsByPeriod(
  transactions: Transaction[],
  periodStr: string
): Transaction[] {
  const parsed = parsePeriodString(periodStr);
  if (parsed.isAll) {
    return transactions;
  }

  return transactions.filter((tx) => {
    const ym = parseTxYearMonth(tx.date);
    if (!ym) return false;
    return ym.year === parsed.year && ym.month === parsed.month;
  });
}

/**
 * Get number of days in a given calendar month and year.
 */
export function getDaysInCalendarMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Get the day of the week for the 1st day of the month.
 * Returns 0 for Monday (Senin), ..., 6 for Sunday (Minggu).
 */
export function getFirstDayWeekday(year: number, month: number): number {
  // JavaScript getDay(): 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const jsDay = new Date(year, month - 1, 1).getDay();
  // Convert to Monday = 0, ..., Sunday = 6
  return (jsDay + 6) % 7;
}

/**
 * Get today's calendar date in Asia/Jakarta timezone.
 */
export function getJakartaToday(date = new Date()): { year: number; month: number; day: number; dateString: string } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateString = formatter.format(date);
  const [yStr, mStr, dStr] = dateString.split('-');
  return {
    year: parseInt(yStr, 10),
    month: parseInt(mStr, 10),
    day: parseInt(dStr, 10),
    dateString,
  };
}

/**
 * Parse a liability due date string into a calendar date { year, month, day, dateString }.
 * Handles: "2026-09-22", "22 Sep 2026", "22 September 2026", "22-09-2026", "Akhir Bulan", etc.
 */
export function parseLiabilityDueDate(
  dueDateStr: string | null | undefined,
  refYear = 2026,
  refMonth = 9
): { year: number; month: number; day: number; dateString: string } | null {
  if (!dueDateStr) return null;
  const str = dueDateStr.trim();

  // 1. ISO format: YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    return {
      year: y,
      month: m,
      day: d,
      dateString: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    };
  }

  // 2. Format: "22 Sep 2026" or "22-09-2026" or "22 September 2026"
  const dmyMatch = str.match(/^(\d{1,2})[\s\-\/\.]*([A-Za-z]+|\d{1,2})[\s\-\/\.]*(\d{4})?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const monthPart = dmyMatch[2].toLowerCase();
    const year = dmyMatch[3] ? parseInt(dmyMatch[3], 10) : refYear;
    let month = refMonth;

    if (/^\d+$/.test(monthPart)) {
      month = parseInt(monthPart, 10);
    } else {
      for (const [k, v] of Object.entries(INDO_MONTHS)) {
        if (monthPart.startsWith(k)) {
          month = v;
          break;
        }
      }
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return {
        year,
        month,
        day,
        dateString: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      };
    }
  }

  // 3. "Akhir Bulan" -> Last day of reference month
  if (str.toLowerCase().includes('akhir')) {
    const lastDay = getDaysInCalendarMonth(refYear, refMonth);
    return {
      year: refYear,
      month: refMonth,
      day: lastDay,
      dateString: `${refYear}-${String(refMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  return null;
}

/**
 * Calculates calendar day difference between today and target due date.
 * Returns (dueDate - today) in days.
 * E.g., today 2026-09-19, due 2026-09-22 -> returns 3 (H-3).
 * E.g., today 2026-09-21, due 2026-09-22 -> returns 1 (H-1).
 * E.g., today 2026-09-22, due 2026-09-22 -> returns 0 (Hari H).
 */
export function getCalendarDayDifference(todayDateStr: string, targetDueDateStr: string): number {
  const [tY, tM, tD] = todayDateStr.split('-').map(Number);
  const [dY, dM, dD] = targetDueDateStr.split('-').map(Number);
  const tUtc = Date.UTC(tY, tM - 1, tD);
  const dUtc = Date.UTC(dY, dM - 1, dD);
  return Math.round((dUtc - tUtc) / (24 * 60 * 60 * 1000));
}
