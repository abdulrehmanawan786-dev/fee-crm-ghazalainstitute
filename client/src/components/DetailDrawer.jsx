import React, { useState, useEffect } from 'react';
import { X, Check, Clock, AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import { fmt, formatDate, todayStr, netTotal, balance, findPayment, METHODS, STATUS_STYLE } from '../helpers';
import { api } from '../api/client';
import { Stamp } from './StudentTable';
import ReceiptView from './ReceiptView';
// This is the full "student profile" view — registration details, enrollment status,
// payment breakdown, and photos all in one place, with edit/delete actions available
// directly here so the admin/agent doesn't need to go back to the table for routine work.
export default function DetailDrawer({ student, onClose, onChanged, onEdit, onDeleteRequest }) {
  const [methodFor, setMethodFor] = useState(null);
  const [images, setImages] = useState([]);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [viewerImage, setViewerImage] = useState(null);
  const [printingPayment, setPrintingPayment] = useState(null);
  const total = netTotal(student);
  const bal = balance(student);

  useEffect(() => {
    (async () => {
      try {
        const list = await api.listImages(student.id);
        const withUrls = await Promise.all(list.map(async img => ({ ...img, url: await api.imageBlobUrl(img.filename) })));
        setImages(withUrls);
      } catch (e) { /* none */ }
      setImgLoaded(true);
    })();
  }, [student.id]);

  async function pickMethod(type, method) {
    const updated = await api.markPaid(student.id, type, method);
    setMethodFor(null);
    onChanged(updated);
  }
  async function unmark(type) {
    const updated = await api.unmarkPaid(student.id, type);
    onChanged(updated);
  }

  const reg = findPayment(student, 'registration');
  const inst1 = findPayment(student, 'installment1');
  const inst2 = findPayment(student, 'installment2');
  const lump = findPayment(student, 'lumpsum');

  const infoRow = { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #EFE9DA', fontSize: 13 };
  const infoLabel = { color: '#6B6458' };
  const infoValue = { fontWeight: 600, color: '#1B2A4A' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(27,42,74,0.45)', display: 'flex', justifyContent: 'flex-end', zIndex: 40 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#F7F3EC', width: '100%', maxWidth: 520, height: '100%', overflowY: 'auto', padding: 24, borderLeft: '2px solid #1B2A4A' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 24, margin: 0 }}>{student.name}</h2>
              {student.status === 'Inactive' && (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#6B6458', border: '1px solid #D8D0BC', borderRadius: 3, padding: '2px 6px', textTransform: 'uppercase' }}>Inactive</span>
              )}
            </div>
            <div style={{ color: '#6B6458', fontSize: 13, marginTop: 2 }}>
              {student.course} ({student.mode}) · {student.phone || 'no phone'}{student.slip_no ? ` · Slip #${student.slip_no}` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => onEdit(student)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6458', padding: 4 }}><Pencil size={18} /></button>
            <button onClick={() => onDeleteRequest(student.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B0432F', padding: 4 }}><Trash2 size={18} /></button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6458', padding: 4 }}><X size={20} /></button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, margin: '14px 0', fontFamily: "'Courier New', monospace", fontSize: 14 }}>
          <div>Total: <b>{fmt(total)}</b></div>
          <div style={{ color: bal > 0 ? '#9C6B26' : '#2F6F4E' }}>Balance: <b>{fmt(bal)}</b></div>
        </div>

        <div style={{ background: '#FFFDFA', border: '1px solid #E3DCC9', borderRadius: 8, padding: '4px 14px', marginBottom: 18 }}>
          <div style={infoRow}><span style={infoLabel}>Registration date</span><span style={infoValue}>{formatDate(student.reg_date)}</span></div>
          <div style={infoRow}><span style={infoLabel}>Registration fee</span><span style={infoValue}>{fmt(student.registration_fee)}</span></div>
          <div style={infoRow}><span style={infoLabel}>Course fee</span><span style={infoValue}>{fmt(student.course_fee)}</span></div>
          <div style={infoRow}><span style={infoLabel}>Discount</span><span style={infoValue}>{fmt(student.discount)}</span></div>
          <div style={infoRow}><span style={infoLabel}>Payment plan</span><span style={infoValue}>{student.payment_mode === 'lumpsum' ? 'Lumpsum' : 'Installments'}</span></div>
          <div style={{ ...infoRow, borderBottom: 'none' }}><span style={infoLabel}>Remarks</span><span style={infoValue}>{student.remarks || 'Active'}</span></div>
        </div>

        {imgLoaded && images.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
            {images.map(img => (
              <img key={img.id} src={img.url} alt="" onClick={() => setViewerImage(img.url)}
                style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid #D8D0BC', cursor: 'pointer' }} />
            ))}
          </div>
        )}

        <div style={{ fontSize: 12, fontWeight: 700, color: '#6B6458', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, borderBottom: '1px solid #E3DCC9', paddingBottom: 4 }}>
          Registration fee
        </div>
        {reg && (
          <LineItem label="Registration" payment={reg}
  onPay={() => setMethodFor('registration')} onUnmark={() => unmark('registration')}
  onPrintReceipt={() => setPrintingPayment(reg)}
  showMethodPicker={methodFor === 'registration'} onPickMethod={m => pickMethod('registration', m)} />
        )}

        <div style={{ fontSize: 12, fontWeight: 700, color: '#6B6458', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '20px 0 8px', borderBottom: '1px solid #E3DCC9', paddingBottom: 4 }}>
          {student.payment_mode === 'lumpsum' ? 'Lumpsum payment' : 'Installments'}
        </div>
        {student.payment_mode === 'lumpsum' && lump && (
          <LineItem label="Full payment" payment={lump}
  onPay={() => setMethodFor('lumpsum')} onUnmark={() => unmark('lumpsum')}
  onPrintReceipt={() => setPrintingPayment(lump)}
  showMethodPicker={methodFor === 'lumpsum'} onPickMethod={m => pickMethod('lumpsum', m)} />
        )}
        {student.payment_mode !== 'lumpsum' && (
          <>
            {inst1 && <LineItem label="1st installment" payment={inst1}
  onPay={() => setMethodFor('installment1')} onUnmark={() => unmark('installment1')}
  onPrintReceipt={() => setPrintingPayment(inst1)}
  showMethodPicker={methodFor === 'installment1'} onPickMethod={m => pickMethod('installment1', m)} />}
{inst2 && <LineItem label="2nd installment" payment={inst2}
  onPay={() => setMethodFor('installment2')} onUnmark={() => unmark('installment2')}
  onPrintReceipt={() => setPrintingPayment(inst2)}
  showMethodPicker={methodFor === 'installment2'} onPickMethod={m => pickMethod('installment2', m)} />}
          </>
        )}
      </div>

      {viewerImage && (
        <div onClick={() => setViewerImage(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: 24 }}>
          <img src={viewerImage} alt="" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: 8 }} />
        </div>
      )}

      {printingPayment && (
        <ReceiptView student={student} payment={printingPayment} onClose={() => setPrintingPayment(null)} />
      )}
    </div>
  );
}

function LineItem({ label, payment, onPay, onUnmark, onPrintReceipt, showMethodPicker, onPickMethod }) {
  const { amount, due_date, paid_date, method, was_overdue } = payment;
  const status = paid_date ? 'paid' : (due_date && due_date < todayStr() ? 'overdue' : 'pending');
  return (
    <div style={{ border: '1px solid #E3DCC9', borderRadius: 6, padding: '10px 12px', marginBottom: 8, background: '#FFFDFA' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
          <div style={{ fontSize: 12, color: '#6B6458' }}>Due {formatDate(due_date)} {paid_date && `· paid ${formatDate(paid_date)}${method ? ' via ' + method : ''}`}</div>
          {paid_date && was_overdue ? <div style={{ fontSize: 11, color: '#B0432F', fontWeight: 600, marginTop: 2 }}>⚠ Paid late (after due date)</div> : null}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: "'Courier New', monospace", fontWeight: 700, marginBottom: 4 }}>{fmt(amount)}</div>
          <Stamp status={status} />
        </div>
      </div>
      {!paid_date && !showMethodPicker && (
        <button onClick={onPay} style={{ marginTop: 8, width: '100%', background: '#1B2A4A', color: '#F7F3EC', border: 'none', borderRadius: 5, padding: '7px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Mark paid
        </button>
      )}
      {showMethodPicker && (
        <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {METHODS.map(m => (
            <button key={m} onClick={() => onPickMethod(m)} style={{ background: '#FBF1E0', border: '1px solid #C68A3F', color: '#9C6B26', borderRadius: 5, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {m}
            </button>
          ))}
        </div>
      )}
      {paid_date && (
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onPrintReceipt} style={{ background: 'none', border: '1px solid #D8D0BC', color: '#1B2A4A', fontSize: 12, cursor: 'pointer', borderRadius: 5, padding: '5px 10px', fontWeight: 600 }}>
            Print receipt
          </button>
          <button onClick={onUnmark} style={{ background: 'none', border: 'none', color: '#B0432F', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
