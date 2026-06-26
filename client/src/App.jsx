import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowLeft, AlertTriangle, Camera, Download, LogOut, Settings } from 'lucide-react';
import { api, getToken, setToken } from './api/client';
import Login from './components/Login';
import StudentTable from './components/StudentTable';
import StudentModal from './components/StudentModal';
import DetailDrawer from './components/DetailDrawer';
import SettingsPanel from './components/SettingsPanel';
import { COURSES, MODES, fmt, formatDate, todayStr, monthLabel, shiftMonth, shiftYear, COURSE_SHORT } from './helpers';
import logoUrl from './Logo - Change - Copy.png';
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export default function App() {
  const [username, setUsername] = useState(null);
  const [checking, setChecking] = useState(true);

  function doLogout() {
    setToken(null);
    setUsername(null);
  }

  useEffect(() => {
    // We don't have a "whoami" endpoint, so just trust a stored token until an API
    // call comes back 401 (handled globally below). This avoids an extra round trip
    // on every page load.
    setUsername(getToken() ? 'admin' : null);
    setChecking(false);
    const onExpire = () => setUsername(null);
    window.addEventListener('ghazala-auth-expired', onExpire);
    return () => window.removeEventListener('ghazala-auth-expired', onExpire);
  }, []);

  // Session timeout: any click, keypress, or scroll resets a 30-minute timer.
  // If nothing happens for 30 minutes while logged in, log out automatically.
  useEffect(() => {
    if (!username) return;
    let timer = setTimeout(doLogout, IDLE_TIMEOUT_MS);
    function reset() {
      clearTimeout(timer);
      timer = setTimeout(doLogout, IDLE_TIMEOUT_MS);
    }
    const events = ['click', 'keydown', 'scroll', 'mousemove'];
    events.forEach(e => window.addEventListener(e, reset));
    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [username]);

  if (checking) return null;
  if (!username) return <Login onLoggedIn={setUsername} />;
  return <Dashboard onLogout={doLogout} />;
}

function Dashboard({ onLogout }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('All');
  const [modeFilter, setModeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(todayStr().slice(0, 7));
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [detailStudent, setDetailStudent] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [drillDown, setDrillDown] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [overdueIds, setOverdueIds] = useState([]);
  const [pendingImageIds, setPendingImageIds] = useState([]);

  const refreshList = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const params = { course: courseFilter, mode: modeFilter, status: statusFilter };
      if (search.trim()) params.search = search.trim();
      if (dateFrom && dateTo) { params.dateFrom = dateFrom; params.dateTo = dateTo; }
      else if (!search.trim()) params.month = selectedMonth;
      const data = await api.listStudents(params);
      setStudents(data);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, courseFilter, modeFilter, statusFilter, dateFrom, dateTo, selectedMonth]);

  const refreshDashboard = useCallback(async () => {
    try {
      const [m, overdue, pending] = await Promise.all([
        api.dashboard(selectedMonth), api.overdue(), api.pendingImages(),
      ]);
      setMonthly(m);
      setOverdueIds(overdue.ids);
      setPendingImageIds(pending.ids);
    } catch (err) {
      console.error(err);
    }
  }, [selectedMonth]);

  useEffect(() => { refreshList(); }, [refreshList]);
  useEffect(() => { refreshDashboard(); }, [refreshDashboard]);

  function openAdd() { setEditingStudent(null); setModalOpen(true); }
  function openEdit(student) { setEditingStudent(student); setModalOpen(true); setDrillDown(null); }
  async function openEditById(id) {
    const s = await api.getStudent(id);
    openEdit(s);
  }

  async function handleDelete(id) {
    await api.deleteStudent(id);
    setConfirmDeleteId(null);
    if (detailStudent?.id === id) setDetailStudent(null);
    refreshList();
    refreshDashboard();
    if (drillDown) setDrillDown(d => ({ ...d, students: d.students.filter(s => s.id !== id) }));
  }

  function handleSaved() {
    setModalOpen(false);
    refreshList();
    refreshDashboard();
  }

  function handleDetailChanged(updated) {
    setDetailStudent(updated);
    refreshList();
    refreshDashboard();
    if (drillDown) setDrillDown(d => ({ ...d, students: d.students.map(s => s.id === updated.id ? updated : s) }));
  }

  async function showDrillDown(title, ids) {
    if (!ids || ids.length === 0) { setDrillDown({ title, students: [] }); return; }
    const list = await api.byIds(ids);
    setDrillDown({ title, students: list });
  }

  async function showCourseDrillDown(course) {
    const list = await api.listStudents({ month: selectedMonth, course });
    setDrillDown({ title: `${course} students — ${monthLabel(selectedMonth)}`, students: list });
  }

  async function downloadCsv() {
    const url = await api.exportCsvUrl();
    const a = document.createElement('a');
    a.href = url;
    a.download = `ghazala-fees-${todayStr()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const statCards = monthly ? [
    {
      key: 'students', label: 'Students this month', value: monthly.studentCount, color: '#1B2A4A', mono: false,
      onClick: () => showDrillDown(`Students admitted — ${monthLabel(selectedMonth)}`, monthly.studentIds),
      breakdown: monthly.byCourse,
    },
    { key: 'collection', label: 'Collected this month', value: fmt(monthly.collection), color: '#2F6F4E', mono: true, onClick: () => showDrillDown(`Collected — ${monthLabel(selectedMonth)}`, monthly.collectedIds) },
    { key: 'outstanding', label: 'Outstanding this month', value: fmt(monthly.outstanding), color: '#9C6B26', mono: true, onClick: () => showDrillDown(`Outstanding — ${monthLabel(selectedMonth)}`, monthly.outstandingIds) },
    { key: 'regfee', label: 'Registration fee this month', value: fmt(monthly.regFee), color: '#1B2A4A', mono: true, onClick: () => showDrillDown(`Registration fee collected — ${monthLabel(selectedMonth)}`, monthly.regFeeIds) },
    { key: 'inst1', label: '1st installment outstanding', value: fmt(monthly.inst1Outstanding), sub: `${monthly.inst1Count} student${monthly.inst1Count === 1 ? '' : 's'}`, color: '#9C6B26', mono: true, onClick: () => showDrillDown(`1st installment due — ${monthLabel(selectedMonth)}`, monthly.inst1Ids) },
    { key: 'inst2', label: '2nd installment outstanding', value: fmt(monthly.inst2Outstanding), sub: `${monthly.inst2Count} student${monthly.inst2Count === 1 ? '' : 's'}`, color: '#9C6B26', mono: true, onClick: () => showDrillDown(`2nd installment due — ${monthLabel(selectedMonth)}`, monthly.inst2Ids) },
  ] : [];

  const statusLabel = search.trim() && dateFrom && dateTo
    ? `Search results for "${search.trim()}" within ${formatDate(dateFrom)} → ${formatDate(dateTo)}`
    : search.trim() ? `Search results across all months for "${search.trim()}"`
    : (dateFrom && dateTo) ? `Registrations from ${formatDate(dateFrom)} to ${formatDate(dateTo)}`
    : `Students registered in ${monthLabel(selectedMonth)}`;

  return (
    <div style={{ minHeight: '100vh', background: '#F7F3EC', fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", color: '#1B2A4A', paddingBottom: 60 }}>
      <div style={{ borderBottom: '2px solid #1B2A4A', padding: '24px 20px 18px', background: '#F7F3EC' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={logoUrl} alt="Ghazala Institute" style={{ height: 150, width: 'auto' }} />
          </div>
          <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
            <span style={{ fontFamily: "Georgia, serif", fontSize: 32, fontWeight: 700, color: '#1B2A4A' }}>Fee Ledger</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={downloadCsv} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFFDFA', border: '1px solid #D8D0BC', borderRadius: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#1B2A4A' }}>
              <Download size={14} /> Export CSV
            </button>
         <button onClick={() => setSettingsOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFFDFA', border: '1px solid #D8D0BC', borderRadius: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#1B2A4A' }}>
              <Settings size={14} /> Settings
            </button>
            <button onClick={onLogout} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid #D8D0BC', borderRadius: 6, padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: '#6B6458' }}>
              <LogOut size={14} /> Log out
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }}>
        {loadError && (
          <div style={{ background: '#F7E6E1', border: '1px solid #B0432F', color: '#B0432F', padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: 13 }}>{loadError}</div>
        )}

        {overdueIds.length > 0 && (
          <button onClick={() => showDrillDown('Overdue payments', overdueIds)} style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', marginBottom: 10,
            background: '#F7E6E1', border: '1px solid #B0432F', borderRadius: 6, padding: '10px 14px', cursor: 'pointer',
          }}>
            <AlertTriangle size={16} style={{ color: '#B0432F' }} />
            <span style={{ fontSize: 13, color: '#B0432F' }}><b>{overdueIds.length}</b> payment{overdueIds.length === 1 ? '' : 's'} overdue right now — tap to review</span>
          </button>
        )}
        {pendingImageIds.length > 0 && (
          <button onClick={() => showDrillDown('Students missing photos', pendingImageIds)} style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', marginBottom: 16,
            background: '#FBF1E0', border: '1px solid #C68A3F', borderRadius: 6, padding: '10px 14px', cursor: 'pointer',
          }}>
            <Camera size={16} style={{ color: '#9C6B26' }} />
            <span style={{ fontSize: 13, color: '#9C6B26' }}><b>{pendingImageIds.length}</b> student{pendingImageIds.length === 1 ? '' : 's'} missing photos — tap to review</span>
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <button onClick={() => setSelectedMonth(shiftYear(selectedMonth, -1))} title="Previous year" style={navBtn}><ChevronsLeft size={16} /></button>
          <button onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))} title="Previous month" style={navBtn}><ChevronLeft size={16} /></button>
          <div style={{ fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 16, minWidth: 150, textAlign: 'center', background: '#FFFDFA', border: '1px solid #D8D0BC', borderRadius: 6, padding: '6px 14px' }}>
            {monthLabel(selectedMonth)}
          </div>
          <button onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))} title="Next month" style={navBtn}><ChevronRight size={16} /></button>
          <button onClick={() => setSelectedMonth(shiftYear(selectedMonth, 1))} title="Next year" style={navBtn}><ChevronsRight size={16} /></button>
          <input type="month" value={selectedMonth} onChange={e => e.target.value && setSelectedMonth(e.target.value)} style={{ background: '#FFFDFA', border: '1px solid #D8D0BC', borderRadius: 6, padding: '6px 10px', fontSize: 13 }} />
          {selectedMonth !== todayStr().slice(0, 7) && (
            <button onClick={() => setSelectedMonth(todayStr().slice(0, 7))} style={{ background: 'none', border: 'none', color: '#9C6B26', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Jump to this month</button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }} className="gl-stats">
          {statCards.map(c => (
            <button key={c.key} onClick={c.onClick} style={{ background: '#FFFDFA', border: '1px solid #E3DCC9', borderRadius: 6, padding: '14px 16px', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}>
              <div style={{ fontSize: 11, color: '#6B6458', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontFamily: c.mono ? "'Courier New', monospace" : 'inherit', fontSize: 22, fontWeight: 700, color: c.color }}>{c.value}</div>
              {c.sub && <div style={{ fontSize: 11, color: '#6B6458', marginTop: 2 }}>{c.sub}</div>}
              {c.breakdown && Object.keys(c.breakdown).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {Object.entries(c.breakdown).map(([course, count]) => (
                    <span key={course} onClick={e => { e.stopPropagation(); showCourseDrillDown(course); }} style={{
                      fontSize: 11, background: '#F7F3EC', border: '1px solid #E3DCC9', borderRadius: 4, padding: '2px 7px', color: '#6B6458', fontFamily: "'Courier New', monospace", cursor: 'pointer',
                    }}>{COURSE_SHORT[course] || course} · {count}</span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>

        {!drillDown && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12, fontSize: 13 }}>
            <span style={{ color: '#6B6458', fontWeight: 600, fontSize: 12, textTransform: 'uppercase' }}>Date range:</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={dateInput} />
            <span style={{ color: '#6B6458' }}>to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={dateInput} />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); }} style={{ background: 'none', border: 'none', color: '#9C6B26', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Clear range</button>
            )}
          </div>
        )}

        {drillDown ? (
          <div>
            <button onClick={() => setDrillDown(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#1B2A4A', fontWeight: 600, fontSize: 14, cursor: 'pointer', marginBottom: 10, padding: 0 }}>
              <ArrowLeft size={16} /> Back to full list
            </button>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 17, marginBottom: 10 }}>{drillDown.title}</div>
            <StudentTable students={drillDown.students} selectedMonth={selectedMonth} onRowClick={id => setDetailStudent(drillDown.students.find(s => s.id === id))}
              onEdit={openEditById} confirmDeleteId={confirmDeleteId} setConfirmDeleteId={setConfirmDeleteId} onDelete={handleDelete} />
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: '1 1 200px' }}>
                <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: '#6B6458' }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search any month — name, phone, slip no, course…"
                  style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: 6, border: '1px solid #D8D0BC', background: '#FFFDFA', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} style={selectStyle}>
                <option>All</option>
                {COURSES.map(c => <option key={c}>{c}</option>)}
              </select>
              <select value={modeFilter} onChange={e => setModeFilter(e.target.value)} style={selectStyle}>
                <option value="All">All (online + onsite)</option>
                {MODES.map(m => <option key={m}>{m}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
                <option value="All">All status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
                <option value="drop">Drop</option>
                <option value="refund">Refund</option>
              </select>
              <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1B2A4A', color: '#F7F3EC', border: 'none', borderRadius: 6, padding: '9px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                <Plus size={15} /> Add student
              </button>
            </div>

            <div style={{ fontSize: 12, color: '#6B6458', marginBottom: 8 }}>
              {statusLabel} · {students.length} record{students.length === 1 ? '' : 's'}
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#6B6458' }}>Loading…</div>
            ) : (
              <StudentTable students={students} selectedMonth={selectedMonth} onRowClick={id => setDetailStudent(students.find(s => s.id === id))}
                onEdit={openEditById} confirmDeleteId={confirmDeleteId} setConfirmDeleteId={setConfirmDeleteId} onDelete={handleDelete} />
            )}
          </>
        )}
      </div>

      {modalOpen && <StudentModal initial={editingStudent} onSave={handleSaved} onClose={() => setModalOpen(false)} />}
      {detailStudent && <DetailDrawer student={detailStudent} onClose={() => setDetailStudent(null)} onChanged={handleDetailChanged} />}
   {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />} </div>
  );
}

const navBtn = { background: '#FFFDFA', border: '1px solid #D8D0BC', borderRadius: 6, padding: 6, cursor: 'pointer', display: 'flex' };
const dateInput = { background: '#FFFDFA', border: '1px solid #D8D0BC', borderRadius: 6, padding: '6px 10px', fontSize: 13 };
const selectStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #D8D0BC', background: '#FFFDFA', fontSize: 14 };
