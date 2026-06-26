import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { api } from '../api/client';
import { formatDate } from '../helpers';

export default function SettingsPanel({ onClose }) {
  const [tab, setTab] = useState('password'); // 'password' | 'history'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(27,42,74,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 60 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#F7F3EC', borderRadius: 10, padding: 24, width: '100%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto', border: '1px solid #1B2A4A' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, margin: 0 }}>Account settings</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6458' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 18, borderBottom: '1px solid #E3DCC9' }}>
          {[['password', 'Change password'], ['history', 'Login history']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              background: 'none', border: 'none', padding: '8px 4px', marginBottom: -1, cursor: 'pointer',
              fontSize: 13, fontWeight: 600, color: tab === key ? '#1B2A4A' : '#6B6458',
              borderBottom: tab === key ? '2px solid #1B2A4A' : '2px solid transparent',
            }}>{label}</button>
          ))}
        </div>

        {tab === 'password' ? <ChangePasswordForm /> : <LoginHistoryList />}
      </div>
    </div>
  );
}

function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const inputStyle = { width: '100%', padding: '9px 10px', borderRadius: 6, border: '1px solid #D8D0BC', background: '#FFFDFA', fontSize: 14, boxSizing: 'border-box', marginTop: 4 };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: '#6B6458', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginTop: 12 };

  async function submit(e) {
    e.preventDefault();
    setError(''); setSuccess(false);
    if (newPassword.length < 8) { setError('New password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('New password and confirmation do not match.'); return; }
    setSaving(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label style={labelStyle}>Current password
        <input style={inputStyle} type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
      </label>
      <label style={labelStyle}>New password
        <input style={inputStyle} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
      </label>
      <label style={labelStyle}>Confirm new password
        <input style={inputStyle} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
      </label>

      {error && <div style={{ marginTop: 14, background: '#F7E6E1', border: '1px solid #B0432F', color: '#B0432F', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>{error}</div>}
      {success && <div style={{ marginTop: 14, background: '#E8F0E6', border: '1px solid #2F6F4E', color: '#2F6F4E', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>Password changed successfully.</div>}

      <button type="submit" disabled={saving} style={{
        marginTop: 18, width: '100%', background: '#1B2A4A', color: '#F7F3EC', border: 'none',
        borderRadius: 6, padding: '11px', fontSize: 14, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
      }}>
        {saving ? 'Saving…' : 'Change password'}
      </button>
    </form>
  );
}

function LoginHistoryList() {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.loginHistory().then(setHistory).catch(err => setError(err.message));
  }, []);

  if (error) return <div style={{ color: '#B0432F', fontSize: 13 }}>{error}</div>;
  if (!history) return <div style={{ color: '#6B6458', fontSize: 13 }}>Loading…</div>;
  if (history.length === 0) return <div style={{ color: '#6B6458', fontSize: 13 }}>No login history yet.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
      {history.map((h, i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12,
          padding: '8px 10px', borderRadius: 6, background: h.success ? '#FFFDFA' : '#F7E6E1',
          border: `1px solid ${h.success ? '#E3DCC9' : '#B0432F'}`,
        }}>
          <div>
            <div style={{ fontWeight: 600, color: h.success ? '#2F6F4E' : '#B0432F' }}>{h.success ? 'Successful login' : 'Failed attempt'}</div>
            <div style={{ color: '#6B6458', marginTop: 2 }}>{formatDate(h.created_at.slice(0, 10))} {h.created_at.slice(11, 16)} · {h.ip_address}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
