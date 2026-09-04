export function formatIDR(amount: number): string {
  if (isNaN(amount)) return 'Rp 0';
  const isNegative = amount < 0;
  const absVal = Math.abs(Math.round(amount));
  const formatted = absVal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${isNegative ? '-' : ''}Rp ${formatted}`;
}

export function formatIDRSigned(amount: number, type: 'income' | 'expense'): string {
  const absVal = Math.abs(Math.round(amount));
  const formatted = absVal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (type === 'income') {
    return `+Rp ${formatted}`;
  }
  return `-Rp ${formatted}`;
}

export function formatNumberIDR(amount: number): string {
  if (isNaN(amount)) return '0';
  return Math.abs(Math.round(amount)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function parseIDR(str: string): number {
  if (!str) return 0;
  const clean = str.replace(/[^0-9]/g, '');
  return parseInt(clean, 10) || 0;
}

export function formatIndoDate(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthIndex = parseInt(parts[1], 10) - 1;
      const day = parts[2].padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      return `${day} ${months[monthIndex] || 'Sep'} ${year}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export function getGroupDateHeader(dateStr: string): string {
  const today = '2026-09-04';
  const yesterday = '2026-09-03';

  if (dateStr === today) {
    return `HARI INI • ${formatIndoDate(dateStr).toUpperCase()}`;
  }
  if (dateStr === yesterday) {
    return `KEMARIN • ${formatIndoDate(dateStr).toUpperCase()}`;
  }
  return formatIndoDate(dateStr).toUpperCase();
}

export function getCurrentDateStr(): string {
  return '2026-09-04';
}

export function getCurrentTimeStr(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}
