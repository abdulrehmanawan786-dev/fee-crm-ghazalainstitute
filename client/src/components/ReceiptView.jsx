import React from 'react';
import { X, Printer } from 'lucide-react';
import { fmt, formatDate, netTotal, totalPaid, balance } from '../helpers';
import logoUrl from '../Logo - Change - Copy.png';

const TYPE_LABELS = {
  registration: 'Registration fee',
  installment1: '1st installment',
  installment2: '2nd installment',
  lumpsum: 'Full payment',
};

const TERMS = [
  'A 50% refund will be granted if dissatisfaction is reported within 3 days of enrollment.',
  'Registration Fee: Rs. 2,000 (Non-refundable).',
  'No refunds after 3 days of payment, regardless of class attendance. The full course fee must be paid at the beginning of the course.',
  'Exam preparation post-course is chargeable based on the number of classes attended.',
];

function printedOnNow() {
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `${formatDate(now.toISOString().slice(0, 10))} ${time}`;
}

export default function ReceiptView({ student, payment, onClose }) {
  return (
    <div className="receipt-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(27,42,74,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 80 }} onClick={onClose}>
      <style>{`
        @media print {
          /* Hide absolutely everything on the page, then reveal only the receipt
             subtree — this way it never matters what else is open behind it
             (student profile, table, etc.), only the receipt itself ever prints. */
          body * { visibility: hidden !important; }
          .receipt-overlay, .receipt-overlay * { visibility: visible !important; }
          .receipt-overlay { position: absolute !important; inset: auto !important; top: 0; left: 0; background: none !important; padding: 0 !important; display: block !important; }
          .receipt-no-print { display: none !important; }
          .receipt-card { box-shadow: none !important; border: none !important; }
          .screen-only-copy { display: none !important; }
          .print-only-copy { display: block !important; page-break-after: always; }
        }
        .print-only-copy { display: none; }
      `}</style>

      {/* What you see in the app — one preview copy, with the close/print controls. */}
      <div className="screen-only-copy" onClick={e => e.stopPropagation()}>
        <ReceiptCard student={student} payment={payment} onClose={onClose} showControls />
      </div>

      {/* What actually prints — two copies, never shown on screen. */}
      <div className="print-only-copy"><ReceiptCard student={student} payment={payment} copyLabel="Student Copy" /></div>
      <div className="print-only-copy"><ReceiptCard student={student} payment={payment} copyLabel="Office Copy" /></div>
    </div>
  );
}

function ReceiptCard({ student, payment, onClose, showControls, copyLabel }) {
  const total = netTotal(student);
  const paidToDate = totalPaid(student);
  const bal = balance(student);

  return (
    <div className="receipt-card" style={{ background: '#fff', borderRadius: 10, padding: 28, width: '100%', maxWidth: 440, maxHeight: showControls ? '90vh' : 'none', overflowY: showControls ? 'auto' : 'visible', border: '1px solid #1B2A4A', margin: '0 auto' }}>

      {showControls && (
        <div className="receipt-no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6458' }}><X size={18} /></button>
        </div>
      )}

      {copyLabel && (
        <div style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#9C6B26', textTransform: 'uppercase', marginBottom: 8 }}>{copyLabel}</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E3DCC9', paddingBottom: 14, marginBottom: 14 }}>
        <img src={logoUrl} alt="Ghazala Institute" style={{ height: 56, width: 'auto' }} />
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 11, color: '#6B6458', margin: 0 }}>Receipt</p>
          <p style={{ fontWeight: 700, fontSize: 18, margin: '2px 0 0', fontFamily: "'Courier New', monospace" }}>#{payment.receipt_number ?? '—'}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13, marginBottom: 16 }}>
        <div>
          <p style={{ color: '#6B6458', margin: '0 0 2px', fontSize: 12 }}>Student</p>
          <p style={{ fontWeight: 600, margin: 0 }}>{student.name}</p>
        </div>
        <div>
          <p style={{ color: '#6B6458', margin: '0 0 2px', fontSize: 12 }}>Date issued</p>
          <p style={{ fontWeight: 600, margin: 0 }}>{formatDate(payment.paid_date)}</p>
        </div>
        <div>
          <p style={{ color: '#6B6458', margin: '0 0 2px', fontSize: 12 }}>Course</p>
          <p style={{ fontWeight: 600, margin: 0 }}>{student.course} ({student.mode})</p>
        </div>
        <div>
          <p style={{ color: '#6B6458', margin: '0 0 2px', fontSize: 12 }}>Payment method</p>
          <p style={{ fontWeight: 600, margin: 0 }}>{payment.method || '—'}</p>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #E3DCC9', paddingTop: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0' }}>
          <span style={{ color: '#6B6458' }}>{TYPE_LABELS[payment.type]}</span>
          <span style={{ fontWeight: 600 }}>{fmt(payment.amount)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '10px 0 0', borderTop: '1px solid #E3DCC9', marginTop: 4 }}>
          <span style={{ fontWeight: 700 }}>Amount received</span>
          <span style={{ fontWeight: 700, fontSize: 17 }}>{fmt(payment.amount)}</span>
        </div>
      </div>

      <div style={{ background: '#F7F3EC', borderRadius: 6, padding: '10px 12px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
          <span style={{ color: '#6B6458' }}>Total course fee</span>
          <span>{fmt(total)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
          <span style={{ color: '#6B6458' }}>Paid to date</span>
          <span>{fmt(paidToDate)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0', fontWeight: 700 }}>
          <span>Balance remaining</span>
          <span style={{ color: bal > 0 ? '#9C6B26' : '#2F6F4E' }}>{fmt(bal)}</span>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #E3DCC9', paddingTop: 12, marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 700, margin: '0 0 6px', color: '#1B2A4A' }}>Terms &amp; Conditions</p>
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 10, color: '#6B6458', lineHeight: 1.5 }}>
          {TERMS.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid #E3DCC9', paddingTop: 14, marginBottom: showControls ? 4 : 0 }}>
        <p style={{ fontSize: 11, color: '#6B6458', margin: 0, maxWidth: 180 }}>This is a computer-generated receipt and does not require a physical signature.</p>
        <div style={{ textAlign: 'right' }}>
          <div style={{ width: 90, borderBottom: '1px solid #1B2A4A', marginBottom: 4, height: 24, marginLeft: 'auto' }}></div>
          <p style={{ fontSize: 10, color: '#6B6458', margin: 0 }}>Authorized signature</p>
          <p style={{ fontSize: 9, color: '#6B6458', margin: '8px 0 0' }}>Printed: {printedOnNow()}</p>
        </div>
      </div>

      {showControls && (
        <button onClick={() => window.print()} className="receipt-no-print" style={{
          marginTop: 16, width: '100%', background: '#1B2A4A', color: '#F7F3EC', border: 'none',
          borderRadius: 6, padding: '11px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <Printer size={16} /> Print / Save as PDF
        </button>
      )}
    </div>
  );
}
