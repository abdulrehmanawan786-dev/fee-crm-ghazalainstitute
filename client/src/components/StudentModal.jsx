import React, { useState, useRef } from 'react';
import { X, Camera } from 'lucide-react';
import { COURSES, COURSE_FEES, MODES, ENROLL_STATUSES, REG_FEE_DEFAULT, INSTRUCTORS, SCHEDULE_OPTIONS, METHODS, getCourseScheduleDefault, calculateEndDate, fmt, formatDate, todayStr, findPayment } from '../helpers';
import { api } from '../api/client';

export default function StudentModal({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || '');
  const [slipNo, setSlipNo] = useState(initial?.slip_no || '');
  const [phone, setPhone] = useState(initial?.phone || '');
  const [course, setCourse] = useState(initial?.course || COURSES[0]);
  const [mode, setMode] = useState(initial?.mode || 'Onsite');
  const [status, setStatus] = useState(initial?.status || 'Active');
  const [registrationFee, setRegistrationFee] = useState(initial?.registration_fee ?? REG_FEE_DEFAULT);
  const [courseFee, setCourseFee] = useState(initial?.course_fee ?? COURSE_FEES[COURSES[0]]);
  const [regDate, setRegDate] = useState(initial?.reg_date || todayStr());
  const [discount, setDiscount] = useState(initial?.discount ?? 0);
  const [paymentMode, setPaymentMode] = useState(initial?.payment_mode || 'installment');

  const initialInstructorIsCustom = initial?.instructor && !INSTRUCTORS.includes(initial.instructor);
  const [instructorChoice, setInstructorChoice] = useState(
    initial?.instructor ? (initialInstructorIsCustom ? 'Other' : initial.instructor) : ''
  );
  const [instructorCustom, setInstructorCustom] = useState(initialInstructorIsCustom ? initial.instructor : '');

  const [classSchedule, setClassSchedule] = useState(initial?.class_schedule || getCourseScheduleDefault(initial?.course || COURSES[0], initial?.mode || 'Onsite').schedule);
  const [courseStartDate, setCourseStartDate] = useState(initial?.course_start_date || '');
  const [courseEndDate, setCourseEndDate] = useState(initial?.course_end_date || '');
  const [endDateManuallySet, setEndDateManuallySet] = useState(!!initial?.course_end_date);

  const regPayment = initial && findPayment(initial, 'registration');
  const inst1Payment = initial && findPayment(initial, 'installment1');
  const inst2Payment = initial && findPayment(initial, 'installment2');
  const lumpPayment = initial && findPayment(initial, 'lumpsum');

  const [inst1Date, setInst1Date] = useState(inst1Payment?.due_date || '');
  const [inst2Date, setInst2Date] = useState(inst2Payment?.due_date || '');
  const [lumpsumDate, setLumpsumDate] = useState(lumpPayment?.due_date || '');
  const [regPaid, setRegPaid] = useState(!!regPayment?.paid_date);
  const [inst1Paid, setInst1Paid] = useState(!!inst1Payment?.paid_date);
  const [inst2Paid, setInst2Paid] = useState(!!inst2Payment?.paid_date);
  const [lumpsumPaid, setLumpsumPaid] = useState(!!lumpPayment?.paid_date);
  const [regMethod, setRegMethod] = useState(regPayment?.method || METHODS[0]);
  const [inst1Method, setInst1Method] = useState(inst1Payment?.method || METHODS[0]);
  const [inst2Method, setInst2Method] = useState(inst2Payment?.method || METHODS[0]);
  const [lumpsumMethod, setLumpsumMethod] = useState(lumpPayment?.method || METHODS[0]);
  const [remarks, setRemarks] = useState(initial?.remarks ?? null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [images, setImages] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [imagesLoaded, setImagesLoaded] = useState(!initial);
  const fileInputRef = useRef(null);

  React.useEffect(() => {
    if (!initial) return;
    (async () => {
      try {
        const list = await api.listImages(initial.id);
        setImages(list);
      } catch (e) { /* none yet */ }
      setImagesLoaded(true);
    })();
  }, [initial]);

  function handleCourseChange(c) {
    setCourse(c);
    setCourseFee(COURSE_FEES[c] ?? 0);
    if (!endDateManuallySet) setClassSchedule(getCourseScheduleDefault(c, mode).schedule);
  }
  function handleModeChange(m) {
    setMode(m);
    if (!endDateManuallySet) setClassSchedule(getCourseScheduleDefault(course, m).schedule);
  }

  React.useEffect(() => {
    if (endDateManuallySet) return;
    if (!courseStartDate || !classSchedule) { setCourseEndDate(''); return; }
    const { totalClasses } = getCourseScheduleDefault(course, mode);
    setCourseEndDate(calculateEndDate(courseStartDate, classSchedule, totalClasses));
  }, [courseStartDate, classSchedule, course, mode, endDateManuallySet]);

  const previewTotal = (Number(registrationFee) || 0) + (Number(courseFee) || 0) - (Number(discount) || 0);
  const remaining = previewTotal - (Number(registrationFee) || 0);
  const previewInst1 = Math.round(remaining / 2);
  const previewInst2 = remaining - previewInst1;

  function handleFilePick(files) {
  setPendingFiles(prev => [...prev, ...files]);
}
  function removePendingFile(idx) {
    setPendingFiles(prev => prev.filter((_, i) => i !== idx));
  }
  async function removeUploadedImage(imageId) {
    await api.deleteImage(imageId);
    setImages(prev => prev.filter(img => img.id !== imageId));
  }

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) { setError('Student name is required.'); return; }
    if (paymentMode === 'installment' && (!inst1Date || !inst2Date)) { setError('Both installment dates are required, or switch to lumpsum.'); return; }
    if (paymentMode === 'lumpsum' && !lumpsumDate) { setError('Payment due date is required for lumpsum.'); return; }
    setError('');
    setSaving(true);
    try {
      const payload = {
        name: name.trim(), slipNo: slipNo.trim(), phone: phone.trim(), course, mode, status,
        registrationFee: Number(registrationFee) || 0, courseFee: Number(courseFee) || 0,
        regDate, discount: Number(discount) || 0, paymentMode,
        inst1Date, inst2Date, lumpsumDate, remarks,
        regPaid, inst1Paid, inst2Paid, lumpsumPaid,
        regMethod, inst1Method, inst2Method, lumpsumMethod,
        instructor: instructorChoice === 'Other' ? instructorCustom.trim() : (instructorChoice || null),
        classSchedule, courseStartDate: courseStartDate || null, courseEndDate: courseEndDate || null,
      };
      const saved = initial ? await api.updateStudent(initial.id, payload) : await api.createStudent(payload);
      if (pendingFiles.length > 0) {
        await api.uploadImages(saved.id, pendingFiles);
      }
      onSave(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = { width: '100%', padding: '9px 10px', borderRadius: 6, border: '1px solid #D8D0BC', background: '#FFFDFA', fontSize: 14, boxSizing: 'border-box', marginTop: 4 };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: '#6B6458', textTransform: 'uppercase', letterSpacing: '0.04em' };
  const checkRow = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#1B2A4A', marginTop: 8 };
  const datePreview = { display: 'block', fontSize: 11, color: '#9C6B26', fontFamily: "'Courier New', monospace", marginTop: 3, textTransform: 'none', fontWeight: 400 };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(27,42,74,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }} onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} style={{
        background: '#F7F3EC', borderRadius: 10, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', border: '1px solid #1B2A4A',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, margin: 0 }}>{initial ? 'Edit student' : 'New registration'}</h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6458' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <label style={{ ...labelStyle, flex: 2 }}>Student name
            <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} />
          </label>
          <label style={{ ...labelStyle, flex: 1 }}>Slip no.
            <input style={inputStyle} value={slipNo} onChange={e => setSlipNo(e.target.value)} placeholder="0451" />
          </label>
        </div>

        <label style={{ ...labelStyle, display: 'block', marginTop: 12 }}>Phone
          <input style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="03xx-xxxxxxx" />
        </label>

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <label style={{ ...labelStyle, flex: 2 }}>Course
            <select style={inputStyle} value={course} onChange={e => handleCourseChange(e.target.value)}>
              {COURSES.map(c => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label style={{ ...labelStyle, flex: 1 }}>Mode
            <select style={inputStyle} value={mode} onChange={e => handleModeChange(e.target.value)}>
              {MODES.map(m => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label style={{ ...labelStyle, flex: 1 }}>Status
            <select style={inputStyle} value={status} onChange={e => setStatus(e.target.value)}>
              {ENROLL_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <label style={{ ...labelStyle, flex: 1 }}>Registration fee
            <input style={inputStyle} type="number" value={registrationFee} onChange={e => setRegistrationFee(e.target.value)} />
          </label>
          <label style={{ ...labelStyle, flex: 1 }}>Reg. date
            <input style={inputStyle} type="date" value={regDate} onChange={e => setRegDate(e.target.value)} />
            <span style={datePreview}>{formatDate(regDate)}</span>
          </label>
        </div>
        <label style={checkRow}>
          <input type="checkbox" checked={regPaid} onChange={e => setRegPaid(e.target.checked)} /> Registration fee paid
        </label>
        {regPaid && (
          <select style={{ ...inputStyle, marginTop: 6 }} value={regMethod} onChange={e => setRegMethod(e.target.value)}>
            {METHODS.map(m => <option key={m}>{m}</option>)}
          </select>
        )}

        <label style={{ ...labelStyle, display: 'block', marginTop: 12 }}>Discount (optional)
          <input style={inputStyle} type="number" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0" />
        </label>

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <label style={{ ...labelStyle, flex: 1 }}>Instructor
            <select style={inputStyle} value={instructorChoice} onChange={e => setInstructorChoice(e.target.value)}>
              <option value="">— Not assigned —</option>
              {INSTRUCTORS.map(i => <option key={i}>{i}</option>)}
              <option value="Other">Other (type name)</option>
            </select>
          </label>
          {instructorChoice === 'Other' && (
            <label style={{ ...labelStyle, flex: 1 }}>Instructor name
              <input style={inputStyle} value={instructorCustom} onChange={e => setInstructorCustom(e.target.value)} placeholder="Type name" />
            </label>
          )}
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: '#6B6458', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 16, marginBottom: 6 }}>
          Course schedule
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <label style={{ ...labelStyle, flex: 1 }}>Class days
            <select style={inputStyle} value={classSchedule} onChange={e => setClassSchedule(e.target.value)}>
              {SCHEDULE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label style={{ ...labelStyle, flex: 1 }}>Start date
            <input style={inputStyle} type="date" value={courseStartDate} onChange={e => setCourseStartDate(e.target.value)} />
            <span style={datePreview}>{formatDate(courseStartDate)}</span>
          </label>
        </div>
        <label style={{ ...labelStyle, display: 'block', marginTop: 10 }}>End date
          <input style={inputStyle} type="date" value={courseEndDate}
            onChange={e => { setCourseEndDate(e.target.value); setEndDateManuallySet(true); }} />
          <span style={datePreview}>{formatDate(courseEndDate)}</span>
          {!endDateManuallySet && courseEndDate && (
            <span style={{ display: 'block', fontSize: 11, color: '#6B6458', marginTop: 2, textTransform: 'none', fontWeight: 400 }}>
              Auto-calculated from start date + class schedule. Edit to override.
            </span>
          )}
        </label>

        <label style={{ ...checkRow, marginTop: 16, fontWeight: 700 }}>
          <input type="checkbox" checked={paymentMode === 'lumpsum'} onChange={e => setPaymentMode(e.target.checked ? 'lumpsum' : 'installment')} />
          Lumpsum payment (single payment instead of 2 installments)
        </label>

        {paymentMode === 'lumpsum' ? (
          <>
            <label style={{ ...labelStyle, display: 'block', marginTop: 10 }}>Payment due date
              <input style={inputStyle} type="date" value={lumpsumDate} onChange={e => setLumpsumDate(e.target.value)} />
              <span style={datePreview}>{formatDate(lumpsumDate)}</span>
            </label>
            <label style={checkRow}>
              <input type="checkbox" checked={lumpsumPaid} onChange={e => setLumpsumPaid(e.target.checked)} /> Payment received
            </label>
            {lumpsumPaid && (
              <select style={{ ...inputStyle, marginTop: 6 }} value={lumpsumMethod} onChange={e => setLumpsumMethod(e.target.value)}>
                {METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
            )}
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <label style={{ ...labelStyle, flex: 1 }}>1st installment date
                <input style={inputStyle} type="date" value={inst1Date} onChange={e => setInst1Date(e.target.value)} />
                <span style={datePreview}>{formatDate(inst1Date)}</span>
              </label>
              <label style={{ ...labelStyle, flex: 1 }}>2nd installment date
                <input style={inputStyle} type="date" value={inst2Date} onChange={e => setInst2Date(e.target.value)} />
                <span style={datePreview}>{formatDate(inst2Date)}</span>
              </label>
            </div>
            <label style={checkRow}>
              <input type="checkbox" checked={inst1Paid} onChange={e => setInst1Paid(e.target.checked)} /> 1st installment paid
            </label>
            {inst1Paid && (
              <select style={{ ...inputStyle, marginTop: 6 }} value={inst1Method} onChange={e => setInst1Method(e.target.value)}>
                {METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
            )}
            <label style={checkRow}>
              <input type="checkbox" checked={inst2Paid} onChange={e => setInst2Paid(e.target.checked)} /> 2nd installment paid
            </label>
            {inst2Paid && (
              <select style={{ ...inputStyle, marginTop: 6 }} value={inst2Method} onChange={e => setInst2Method(e.target.value)}>
                {METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
            )}
          </>
        )}

        {initial && (
          <label style={{ ...labelStyle, display: 'block', marginTop: 14 }}>Remarks
            <select style={inputStyle} value={remarks || ''} onChange={e => setRemarks(e.target.value || null)}>
              <option value="">Active</option>
              <option value="Drop">Drop</option>
              <option value="Refund">Refund</option>
            </select>
          </label>
        )}

        <div style={{ marginTop: 14, padding: '10px 12px', background: '#FBF1E0', border: '1px solid #C68A3F', borderRadius: 6, fontSize: 13 }}>
          Total: <b style={{ fontFamily: "'Courier New', monospace" }}>{fmt(previewTotal)}</b>
          {paymentMode === 'installment' && previewTotal > 0 && (
            <div style={{ marginTop: 4, fontSize: 12, color: '#9C6B26' }}>1st: {fmt(previewInst1)} · 2nd: {fmt(previewInst2)}</div>
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={labelStyle}>Photos (optional)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            {imagesLoaded && images.map(img => (
              <div key={img.id} style={{ position: 'relative', width: 64, height: 64 }}>
                <AuthedThumb filename={img.filename} />
                <button type="button" onClick={() => removeUploadedImage(img.id)} style={{
                  position: 'absolute', top: -6, right: -6, background: '#B0432F', color: '#fff', border: 'none',
                  borderRadius: '50%', width: 18, height: 18, fontSize: 11, cursor: 'pointer', lineHeight: 1,
                }}>×</button>
              </div>
            ))}
            {pendingFiles.map((f, i) => (
              <div key={i} style={{ position: 'relative', width: 64, height: 64 }}>
                <img src={URL.createObjectURL(f)} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid #C68A3F' }} />
                <button type="button" onClick={() => removePendingFile(i)} style={{
                  position: 'absolute', top: -6, right: -6, background: '#B0432F', color: '#fff', border: 'none',
                  borderRadius: '50%', width: 18, height: 18, fontSize: 11, cursor: 'pointer', lineHeight: 1,
                }}>×</button>
              </div>
            ))}
            <button type="button" onClick={() => fileInputRef.current?.click()} style={{
              width: 64, height: 64, border: '1.5px dashed #C68A3F', borderRadius: 6, background: '#FBF1E0',
              color: '#9C6B26', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Camera size={20} />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
              onChange={e => {
                const files = Array.from(e.target.files);
                if (files.length) handleFilePick(files);
                e.target.value = '';
              }} />
          </div>
          <div style={{ fontSize: 11, color: '#6B6458', marginTop: 4 }}>e.g. CNIC, fee receipt.</div>
        </div>

        {error && (
          <div style={{ marginTop: 14, background: '#F7E6E1', border: '1px solid #B0432F', color: '#B0432F', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>{error}</div>
        )}

        <button type="submit" disabled={saving} style={{
          marginTop: 20, width: '100%', background: '#1B2A4A', color: '#F7F3EC', border: 'none',
          borderRadius: 6, padding: '11px', fontSize: 14, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
        }}>
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Add student'}
        </button>
      </form>
    </div>
  );
}

function AuthedThumb({ filename }) {
  const [url, setUrl] = useState(null);
  React.useEffect(() => {
    let active = true;
    api.imageBlobUrl(filename).then(u => { if (active) setUrl(u); }).catch(() => {});
    return () => { active = false; };
  }, [filename]);
  if (!url) return <div style={{ width: 64, height: 64, borderRadius: 6, background: '#EFE9DA' }} />;
  return <img src={url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid #D8D0BC' }} />;
}
