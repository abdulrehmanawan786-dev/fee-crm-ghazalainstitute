import React from 'react';
import { Check, Clock, AlertTriangle, Ban, RotateCcw, Trash2, Pencil, ImageOff } from 'lucide-react';
import { fmt, formatDate, netTotal, balance, computedStatus, monthContext, STATUS_STYLE } from '../helpers';

function Stamp({ status }) {
  const st = STATUS_STYLE[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 3,
      border: `1.5px solid ${st.border}`, background: st.bg, color: st.text,
      fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
      transform: status === 'paid' ? 'rotate(-2deg)' : 'none',
    }}>
      {status === 'paid' && <Check size={11} strokeWidth={3} />}
      {status === 'overdue' && <AlertTriangle size={11} strokeWidth={3} />}
      {status === 'pending' && <Clock size={11} strokeWidth={3} />}
      {status === 'drop' && <Ban size={11} strokeWidth={3} />}
      {status === 'refund' && <RotateCcw size={11} strokeWidth={3} />}
      {st.label}
    </span>
  );
}

export default function StudentTable({ students, selectedMonth, onRowClick, onEdit, confirmDeleteId, setConfirmDeleteId, onDelete }) {
  if (students.length === 0) {
    return <div style={{ textAlign: 'center', padding: 40, color: '#6B6458', border: '1px dashed #D8D0BC', borderRadius: 8 }}>No matching students.</div>;
  }
  const cols = '0.5fr 1.1fr 1.5fr 1.1fr 1.3fr 0.9fr 0.9fr 1.3fr 1fr 1fr 1fr 0.8fr';
  const cellDivider = { borderRight: '1px solid #2C3E5C', paddingRight: 8, paddingLeft: 4 };
  const cellDividerBody = { borderRight: '1px solid #E3DCC9', paddingRight: 8, paddingLeft: 4, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' };

  return (
    <div style={{ border: '1px solid #E3DCC9', borderRadius: 8, overflow: 'auto', background: '#FFFDFA' }}>
      <div style={{ minWidth: 1180 }}>
        <div style={{ display: 'grid', gridTemplateColumns: cols, padding: '10px 16px', background: '#1B2A4A', color: '#F7F3EC', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <div style={cellDivider}>S.No</div>
          <div style={cellDivider}>Reg. date</div>
          <div style={cellDivider}>Student</div>
          <div style={cellDivider}>Phone</div>
          <div style={cellDivider}>Course</div>
          <div style={cellDivider}>Reg fee</div>
          <div style={cellDivider}>Course fee</div>
          <div style={cellDivider}>Paid this month</div>
          <div style={cellDivider}>Balance</div>
          <div style={cellDivider}>Total amount</div>
          <div style={cellDivider}>Status</div>
          <div></div>
        </div>
        {students.map((s, idx) => {
          const total = netTotal(s);
          const bal = balance(s);
          const status = computedStatus(s);
          const confirming = confirmDeleteId === s.id;
          const ctx = selectedMonth ? monthContext(s, selectedMonth) : null;
          return (
            <div key={s.id} onClick={() => !confirming && onRowClick(s.id)} style={{
              display: 'grid', gridTemplateColumns: cols, padding: '12px 16px',
              borderTop: '2px solid #C9BFA5', background: '#FFFDFA',
              alignItems: 'stretch', cursor: 'pointer', fontSize: 13, minHeight: 52,
            }}>
              <div style={{ ...cellDividerBody, color: '#6B6458', fontFamily: "'Courier New', monospace", fontSize: 12 }}>{idx + 1}</div>
              <div style={{ ...cellDividerBody, fontSize: 12, color: '#6B6458', fontFamily: "'Courier New', monospace" }}>{formatDate(s.reg_date)}</div>
              <div style={cellDividerBody}>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {s.name}
                  {!s.imageCount && <ImageOff size={12} style={{ color: '#C68A3F' }} />}
                </div>
                {s.slip_no && <div style={{ fontSize: 11, color: '#6B6458' }}>Slip #{s.slip_no}</div>}
              </div>
              <div style={{ ...cellDividerBody, color: '#6B6458', fontSize: 12 }}>{s.phone || '—'}</div>
              <div style={{ ...cellDividerBody, color: '#6B6458' }}>{s.course} <span style={{ fontSize: 11, opacity: 0.7 }}>({s.mode})</span></div>
              <div style={{ ...cellDividerBody, fontFamily: "'Courier New', monospace", fontSize: 12 }}>{fmt(s.registration_fee)}</div>
              <div style={{ ...cellDividerBody, fontFamily: "'Courier New', monospace", fontSize: 12 }}>{fmt(s.course_fee)}</div>
              <div style={{ ...cellDividerBody, fontSize: 12, fontFamily: "'Courier New', monospace" }}>
                {ctx && ctx.paid > 0 && <div style={{ color: '#2F6F4E' }}>{fmt(ctx.paid)} paid</div>}
                {ctx && ctx.outstanding > 0 && <div style={{ color: '#9C6B26' }}>{fmt(ctx.outstanding)} outstanding</div>}
                {ctx && ctx.paid === 0 && ctx.outstanding === 0 && <span style={{ color: '#6B6458' }}>—</span>}
              </div>
              <div style={{ ...cellDividerBody, fontFamily: "'Courier New', monospace", color: bal > 0 ? '#9C6B26' : '#2F6F4E' }}>{fmt(bal)}</div>
              <div style={{ ...cellDividerBody, fontFamily: "'Courier New', monospace" }}>{fmt(total)}</div>
              <div style={cellDividerBody}><Stamp status={status} /></div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center', paddingLeft: 4 }}>
                {!confirming ? (
                  <>
                    <button onClick={e => { e.stopPropagation(); onEdit(s.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6458', padding: 4 }}>
                      <Pencil size={15} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(s.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B0432F', padding: 4 }}>
                      <Trash2 size={15} />
                    </button>
                  </>
                ) : (
                  <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <button onClick={() => onDelete(s.id)} style={{ background: '#B0432F', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
                    <button onClick={() => setConfirmDeleteId(null)} style={{ background: 'none', border: '1px solid #D8D0BC', borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: 'pointer', color: '#6B6458' }}>Cancel</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { Stamp };
