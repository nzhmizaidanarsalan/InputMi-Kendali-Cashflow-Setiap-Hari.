export function formatIDR(amount: number): string {
  if (typeof amount !== 'number' || isNaN(amount) || !Number.isFinite(amount)) return 'Rp 0';
  const isNegative = amount < 0;
  const absVal = Math.abs(Math.round(amount));
  const formatted = absVal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${isNegative ? '-' : ''}Rp ${formatted}`;
}

export function formatIDRSigned(amount: number, type: 'income' | 'expense'): string {
  if (typeof amount !== 'number' || isNaN(amount) || !Number.isFinite(amount)) return 'Rp 0';
  const absVal = Math.abs(Math.round(amount));
  const formatted = absVal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (type === 'income') {
    return `+Rp ${formatted}`;
  }
  return `-Rp ${formatted}`;
}

export function formatNumberIDR(amount: number): string {
  if (typeof amount !== 'number' || isNaN(amount) || !Number.isFinite(amount)) return '0';
  return Math.abs(Math.round(amount)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function parseIDR(str: string | number): number {
  if (typeof str === 'number') {
    return isNaN(str) || !Number.isFinite(str) ? 0 : Math.round(str);
  }
  if (!str) return 0;
  
  let s = String(str).trim();
  // Strip trailing cents like ,00 or .00 if present
  s = s.replace(/,\d{2}$/, '').replace(/\.00$/, '');
  // Extract all digit characters
  const clean = s.replace(/[^0-9]/g, '');
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

export function getCurrentDateStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getGroupDateHeader(dateStr: string): string {
  const today = getCurrentDateStr();
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yYear = d.getFullYear();
  const yMonth = String(d.getMonth() + 1).padStart(2, '0');
  const yDay = String(d.getDate()).padStart(2, '0');
  const yesterday = `${yYear}-${yMonth}-${yDay}`;

  if (dateStr === today) {
    return `HARI INI • ${formatIndoDate(dateStr).toUpperCase()}`;
  }
  if (dateStr === yesterday) {
    return `KEMARIN • ${formatIndoDate(dateStr).toUpperCase()}`;
  }
  return formatIndoDate(dateStr).toUpperCase();
}

export function getCurrentTimeStr(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}
