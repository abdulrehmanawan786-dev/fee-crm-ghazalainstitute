import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { BarChart, Bar, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { api } from '../api/client';
import { fmt, formatDate, todayStr, monthLabel } from '../helpers';

const TABS = [
  ['course', 'Course-wise'],
  ['comparison', 'Monthly / Yearly'],
  ['income', 'Income Summary'],
];

function defaultFrom() {
  const d = new Date();
  d.setMonth(d.getMonth() - 11);
  return d.toISOString().slice(0, 10);
}

function periodLabel(period, granularity) {
  if (granularity === 'year') return period;
  if (granularity === 'month') return monthLabel(period);
  return formatDate(period); // day or week (week shown as its starting date)
}

export default function ReportsPage({ onBack }) {
  const [tab, setTab] = useState('course');

  return (
    <div style={{ minHeight: '100vh', background: '#F7F3EC', fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", color: '#1B2A4A', paddingBottom: 60 }}>
      <div style={{ borderBottom: '2px solid #1B2A4A', padding: '24px 20px 18px', background: '#F7F3EC' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#1B2A4A', fontWeight: 600, fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 10 }}>
            <ArrowLeft size={16} /> Back to dashboard
          </button>
          <h1 style={{ fontFamily: "Georgia, 'Iowan Old Style', serif", fontSize: 26, fontWeight: 700, margin: 0 }}>Reports</h1>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid #E3DCC9', flexWrap: 'wrap' }}>
          {TABS.map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              background: 'none', border: 'none', padding: '10px 6px', marginBottom: -1, cursor: 'pointer',
              fontSize: 14, fontWeight: 600, color: tab === key ? '#1B2A4A' : '#6B6458',
              borderBottom: tab === key ? '2px solid #1B2A4A' : '2px solid transparent',
            }}>{label}</button>
          ))}
        </div>

        {tab === 'course' && <CourseWiseReport />}
        {tab === 'comparison' && <ComparisonReport />}
        {tab === 'income' && <IncomeReport />}
      </div>
    </div>
  );
}

function FilterBar({ dateFrom, setDateFrom, dateTo, setDateTo, granularity, setGranularity, granularityOptions, onClear }) {
  const inputStyle = { background: '#FFFDFA', border: '1px solid #D8D0BC', borderRadius: 6, padding: '7px 10px', fontSize: 13 };
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
      {granularityOptions && (
        <div style={{ display: 'flex', gap: 6 }}>
          {granularityOptions.map(([key, label]) => (
            <button key={key} onClick={() => setGranularity(key)} style={{
              background: granularity === key ? '#1B2A4A' : '#FFFDFA', color: granularity === key ? '#F7F3EC' : '#1B2A4A',
              border: '1px solid #D8D0BC', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>
      )}
      <span style={{ color: '#6B6458', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>Date range:</span>
      <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inputStyle} />
      <span style={{ color: '#6B6458' }}>to</span>
      <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inputStyle} />
      {(dateFrom || dateTo) && (
        <button onClick={onClear} style={{ background: 'none', border: 'none', color: '#9C6B26', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
          Clear filter
        </button>
      )}
    </div>
  );
}

function StatusLine({ from, to }) {
  return (
    <div style={{ fontSize: 12, color: '#6B6458', marginBottom: 14 }}>
      Showing {formatDate(from)} → {formatDate(to)}
    </div>
  );
}

function CourseWiseReport() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    const params = {};
    if (dateFrom && dateTo) { params.dateFrom = dateFrom; params.dateTo = dateTo; }
    api.courseWiseReport(params).then(setData).catch(err => setError(err.message));
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  if (error) return <div style={{ color: '#B0432F', fontSize: 13 }}>{error}</div>;
  if (!data) return <div style={{ color: '#6B6458' }}>Loading…</div>;

  const totals = data.rows.reduce((acc, r) => ({
    studentsEnrolled: acc.studentsEnrolled + r.studentsEnrolled,
    collected: acc.collected + r.collected,
    outstanding: acc.outstanding + r.outstanding,
  }), { studentsEnrolled: 0, collected: 0, outstanding: 0 });

  return (
    <div>
      <FilterBar dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo}
        onClear={() => { setDateFrom(''); setDateTo(''); }} />
      <StatusLine from={data.from} to={data.to} />

      <div style={{ border: '1px solid #E3DCC9', borderRadius: 8, overflow: 'hidden', background: '#FFFDFA' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '10px 16px', background: '#1B2A4A', color: '#F7F3EC', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>
          <div>Course</div>
          <div>Students enrolled</div>
          <div>Collected</div>
          <div>Outstanding</div>
        </div>
        {data.rows.map(r => (
          <div key={r.course} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '10px 16px', borderTop: '1px solid #EFE9DA', fontSize: 14 }}>
            <div style={{ fontWeight: 600 }}>{r.course}</div>
            <div style={{ fontFamily: "'Courier New', monospace" }}>{r.studentsEnrolled}</div>
            <div style={{ fontFamily: "'Courier New', monospace", color: '#2F6F4E' }}>{fmt(r.collected)}</div>
            <div style={{ fontFamily: "'Courier New', monospace", color: r.outstanding > 0 ? '#9C6B26' : '#6B6458' }}>{fmt(r.outstanding)}</div>
          </div>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '10px 16px', borderTop: '2px solid #1B2A4A', fontSize: 14, fontWeight: 700, background: '#F7F3EC' }}>
          <div>Total</div>
          <div style={{ fontFamily: "'Courier New', monospace" }}>{totals.studentsEnrolled}</div>
          <div style={{ fontFamily: "'Courier New', monospace", color: '#2F6F4E' }}>{fmt(totals.collected)}</div>
          <div style={{ fontFamily: "'Courier New', monospace", color: '#9C6B26' }}>{fmt(totals.outstanding)}</div>
        </div>
      </div>
    </div>
  );
}

function ComparisonReport() {
  const [granularity, setGranularity] = useState('month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    const params = { granularity };
    if (dateFrom && dateTo) { params.dateFrom = dateFrom; params.dateTo = dateTo; }
    api.comparisonReport(params).then(setData).catch(err => setError(err.message));
  }, [granularity, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  if (error) return <div style={{ color: '#B0432F', fontSize: 13 }}>{error}</div>;
  if (!data) return <div style={{ color: '#6B6458' }}>Loading…</div>;

  const chartData = data.rows.map(r => ({ ...r, label: periodLabel(r.period, granularity) }));

  return (
    <div>
      <FilterBar dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo}
        granularity={granularity} setGranularity={setGranularity}
        granularityOptions={[['month', 'Monthly'], ['year', 'Yearly']]}
        onClear={() => { setDateFrom(''); setDateTo(''); }} />
      <StatusLine from={data.from} to={data.to} />

      {chartData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6B6458', border: '1px dashed #D8D0BC', borderRadius: 8 }}>No data in this range.</div>
      ) : (
        <div style={{ background: '#FFFDFA', border: '1px solid #E3DCC9', borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E3DCC9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B6458' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#6B6458' }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#6B6458' }} />
              <Tooltip formatter={(v, name) => name === 'Students' ? v : fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="collected" name="Collected" fill="#2F6F4E" radius={[3, 3, 0, 0]} />
              <Bar yAxisId="left" dataKey="outstanding" name="Outstanding" fill="#C68A3F" radius={[3, 3, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="studentsEnrolled" name="Students" stroke="#1B2A4A" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ border: '1px solid #E3DCC9', borderRadius: 8, overflow: 'hidden', background: '#FFFDFA' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', padding: '10px 16px', background: '#1B2A4A', color: '#F7F3EC', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>
          <div>{granularity === 'year' ? 'Year' : 'Month'}</div>
          <div>Students</div>
          <div>Collected</div>
          <div>Outstanding</div>
        </div>
        {chartData.map(r => (
          <div key={r.period} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', padding: '10px 16px', borderTop: '1px solid #EFE9DA', fontSize: 14 }}>
            <div style={{ fontWeight: 600 }}>{r.label}</div>
            <div style={{ fontFamily: "'Courier New', monospace" }}>{r.studentsEnrolled}</div>
            <div style={{ fontFamily: "'Courier New', monospace", color: '#2F6F4E' }}>{fmt(r.collected)}</div>
            <div style={{ fontFamily: "'Courier New', monospace", color: r.outstanding > 0 ? '#9C6B26' : '#6B6458' }}>{fmt(r.outstanding)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function IncomeReport() {
  const [granularity, setGranularity] = useState('day');
  const [dateFrom, setDateFrom] = useState(defaultFrom());
  const [dateTo, setDateTo] = useState(todayStr());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    const params = { granularity };
    if (dateFrom && dateTo) { params.dateFrom = dateFrom; params.dateTo = dateTo; }
    api.incomeReport(params).then(setData).catch(err => setError(err.message));
  }, [granularity, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  if (error) return <div style={{ color: '#B0432F', fontSize: 13 }}>{error}</div>;
  if (!data) return <div style={{ color: '#6B6458' }}>Loading…</div>;

  const chartData = data.rows.map(r => ({ ...r, label: formatDate(typeof r.period === 'string' ? r.period.slice(0, 10) : r.period) }));
  const total = data.rows.reduce((sum, r) => sum + Number(r.collected), 0);

  return (
    <div>
      <FilterBar dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo}
        granularity={granularity} setGranularity={setGranularity}
        granularityOptions={[['day', 'Daily'], ['week', 'Weekly']]}
        onClear={() => { setDateFrom(defaultFrom()); setDateTo(todayStr()); }} />
      <StatusLine from={data.from} to={data.to} />

      <div style={{ background: '#FFFDFA', border: '1px solid #E3DCC9', borderRadius: 6, padding: '14px 16px', marginBottom: 16, display: 'inline-block' }}>
        <div style={{ fontSize: 11, color: '#6B6458', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Total income in range</div>
        <div style={{ fontFamily: "'Courier New', monospace", fontSize: 22, fontWeight: 700, color: '#2F6F4E' }}>{fmt(total)}</div>
      </div>

      {chartData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6B6458', border: '1px dashed #D8D0BC', borderRadius: 8 }}>No income recorded in this range.</div>
      ) : (
        <div style={{ background: '#FFFDFA', border: '1px solid #E3DCC9', borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E3DCC9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B6458' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6B6458' }} />
              <Tooltip formatter={v => fmt(v)} />
              <Bar dataKey="collected" name="Collected" fill="#2F6F4E" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
