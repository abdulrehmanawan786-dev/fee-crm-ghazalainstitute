export const COURSES = ['German A1', 'German A1 Online', 'German A2', 'German B1', 'German B2.1', 'German B2.2', 'IELTS', 'PTE', 'English Language'];
export const COURSE_FEES = {
  'German A1': 36000, 'German A1 Online': 33000, 'German A2': 40000, 'German B1': 43000,
  'German B2.1': 48000, 'German B2.2': 48000, 'IELTS': 18000, 'PTE': 25000, 'English Language': 5000,
};
export const COURSE_SHORT = {
  'German A1': 'A1', 'German A1 Online': 'A1 Online', 'German A2': 'A2', 'German B1': 'B1',
  'German B2.1': 'B2.1', 'German B2.2': 'B2.2', 'IELTS': 'IELTS', 'PTE': 'PTE', 'English Language': 'English',
};
export const METHODS = ['Cash', 'Bank Transfer', 'JazzCash', 'EasyPaisa', 'Card'];
export const MODES = ['Onsite', 'Online'];
export const ENROLL_STATUSES = ['Active', 'Inactive'];
export const REG_FEE_DEFAULT = 2000;

export function fmt(n) { return 'Rs ' + Number(n || 0).toLocaleString('en-PK'); }
export function todayStr() { return new Date().toISOString().slice(0, 10); }
export function monthKey(dateStr) { return dateStr ? dateStr.slice(0, 7) : ''; }
export function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}
export function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
export function shiftYear(ym, delta) { return shiftMonth(ym, delta * 12); }

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return '—';
  return `${d}-${MONTH_NAMES[m - 1]}-${y}`;
}

export function netTotal(s) { return s.registration_fee + s.course_fee - (s.discount || 0); }

export function findPayment(s, type) { return (s.payments || []).find(p => p.type === type); }

export function totalPaid(s) {
  return (s.payments || []).filter(p => p.paid_date).reduce((sum, p) => sum + p.amount, 0);
}
export function balance(s) { return netTotal(s) - totalPaid(s); }

export function computedStatus(s) {
  if (s.remarks === 'Drop') return 'drop';
  if (s.remarks === 'Refund') return 'refund';
  if (balance(s) <= 0) return 'paid';
  const today = todayStr();
  const overdue = (s.payments || []).some(p => !p.paid_date && p.due_date && p.due_date < today);
  return overdue ? 'overdue' : 'pending';
}

export function monthContext(s, ym) {
  let paid = 0, outstanding = 0;
  (s.payments || []).forEach(p => {
    if (monthKey(p.due_date) === ym) {
      if (p.paid_date) paid += p.amount; else outstanding += p.amount;
    }
  });
  return { paid, outstanding };
}

export const STATUS_STYLE = {
  paid: { bg: '#E8F0E6', border: '#2F6F4E', text: '#2F6F4E', label: 'PAID' },
  pending: { bg: '#FBF1E0', border: '#C68A3F', text: '#9C6B26', label: 'PENDING' },
  overdue: { bg: '#F7E6E1', border: '#B0432F', text: '#B0432F', label: 'OVERDUE' },
  drop: { bg: '#EAEAEA', border: '#6B6458', text: '#6B6458', label: 'DROP' },
  refund: { bg: '#E6E9F7', border: '#4A4F8C', text: '#4A4F8C', label: 'REFUND' },
};
