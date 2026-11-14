/**
 * Formats single budget values or budget ranges for display.
 * E.g.:
 * - 500000 -> "₹5,00,000"
 * - "80000" -> "₹80,000"
 * - "₹1,00,000 – ₹3,00,000" -> "₹1,00,000 – ₹3,00,000"
 * - "100000 - 300000" -> "₹100000 – ₹300000"
 */
export function formatBudgetDisplay(budget: string | number | undefined | null): string {
  if (budget === undefined || budget === null || budget === '') return '';
  const str = String(budget).trim();
  if (!str) return '';

  // If it's a range containing separator like "-", "–", "—", "to"
  if (/[-–—]|\bto\b/i.test(str)) {
    if (str.includes('₹')) {
      return str;
    }
    return str.replace(/([0-9,]+)\s*(?:-|–|—|\bto\b)\s*([0-9,]+)/i, (_, min, max) => `₹${min} – ₹${max}`);
  }

  // Single value
  if (str.startsWith('₹')) {
    return str;
  }

  const num = Number(str.replace(/[^\d.]/g, ''));
  if (!isNaN(num) && num > 0) {
    return `₹${num.toLocaleString('en-IN')}`;
  }
  return `₹${str}`;
}

/**
 * Calculates the next calendar day string (YYYY-MM-DD) using timezone-safe UTC arithmetic.
 * Essential for FullCalendar all-day exclusive end dates.
 * E.g. "2026-11-15" -> "2026-11-16"
 */
export function getNextDayStr(dateStr: string): string {
  try {
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
    const [year, month, day] = parts;
    const d = new Date(Date.UTC(year, month - 1, day + 1));
    return d.toISOString().slice(0, 10);
  } catch {
    return dateStr;
  }
}
