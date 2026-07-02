import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { api } from '../api/client';
import { formatDate } from '../helpers';

export default function SettingsPanel({ onClose, role }) {
  const [tab, setTab] = useState('password'); // 'password' | 'history' | 'team'
useEffect(() => {
    function handleEsc(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);
  const tabs = [['password', 'Change password'], ['history', 'Login history']];
  if (role === 'admin') tabs.push(['team', 'Manage team']);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(27,42,74,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 60 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#F7F3EC', borderRadius: 10, padding: 24, width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto', border: '1px solid #1B2A4A' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, margin: 0 }}>Account settings</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B6458' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 18, borderBottom: '1px solid #E3DCC9', flexWrap: 'wrap' }}>
          {tabs.map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              background: 'none', border: 'none', padding: '8px 4px', marginBottom: -1, cursor: 'pointer',
              fontSize: 13, fontWeight: 600, color: tab === key ? '#1B2A4A' : '#6B6458',
              borderBottom: tab === key ? '2px solid #1B2A4A' : '2px solid transparent',
            }}>{label}</button>
          ))}
        </div>

        {tab === 'password' && <ChangePasswordForm />}
        {tab === 'history' && <LoginHistoryList />}
        {tab === 'team' && <ManageTeam />}
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

function ManageTeam() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('agent');
  const [addError, setAddError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState('agent');
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  function load() {
    api.listUsers().then(setUsers).catch(err => setError(err.message));
  }
  useEffect(() => { load(); }, []);

  function openEdit(u) {
    setEditingUser(u);
    setEditUsername(u.username);
    setEditPassword('');
    setEditRole(u.role);
    setEditError('');
    setShowAdd(false);
  }

  async function saveEdit(e) {
    e.preventDefault();
    setEditError('');
    if (editPassword && editPassword.length < 8) { setEditError('Password must be at least 8 characters.'); return; }
    setEditSaving(true);
    try {
      await api.updateUser(editingUser.id, editUsername.trim(), editPassword || null, editRole);
      setEditingUser(null);
      load();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  async function addUser(e) {
    e.preventDefault();
    setAddError('');
    if (newPassword.length < 8) { setAddError('Password must be at least 8 characters.'); return; }
    setSaving(true);
    try {
      await api.createUser(newUsername.trim(), newPassword, newRole);
      setNewUsername(''); setNewPassword(''); setNewRole('agent'); setShowAdd(false);
      load();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeUser(id, username) {
    if (!window.confirm(`Remove "${username}"'s login? They will no longer be able to sign in.`)) return;
    try {
      await api.deleteUser(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  const inputStyle = { width: '100%', padding: '9px 10px', borderRadius: 6, border: '1px solid #D8D0BC', background: '#FFFDFA', fontSize: 14, boxSizing: 'border-box', marginTop: 4 };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: '#6B6458', textTransform: 'uppercase', letterSpacing: '0.04em' };

  if (error) return <div style={{ color: '#B0432F', fontSize: 13 }}>{error}</div>;
  if (!users) return <div style={{ color: '#6B6458', fontSize: 13 }}>Loading…</div>;

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {users.map(u => (
          <div key={u.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: editingUser?.id === u.id ? '6px 6px 0 0' : 6, background: '#FFFDFA', border: '1px solid #E3DCC9', fontSize: 13 }}>
              <div>
                <b>{u.username}</b>{' '}
                <span style={{ fontSize: 10, fontWeight: 700, color: u.role === 'admin' ? '#1B2A4A' : '#9C6B26', border: '1px solid #D8D0BC', borderRadius: 3, padding: '1px 5px', textTransform: 'uppercase', marginLeft: 4 }}>{u.role}</span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => editingUser?.id === u.id ? setEditingUser(null) : openEdit(u)} style={{ background: 'none', border: 'none', color: '#1B2A4A', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
                  {editingUser?.id === u.id ? 'Cancel' : 'Edit'}
                </button>
                <button onClick={() => removeUser(u.id, u.username)} style={{ background: 'none', border: 'none', color: '#B0432F', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>Remove</button>
              </div>
            </div>

            {editingUser?.id === u.id && (
              <form onSubmit={saveEdit} style={{ border: '1px solid #E3DCC9', borderTop: 'none', borderRadius: '0 0 6px 6px', padding: 12, background: '#F7F3EC' }}>
                <label style={labelStyle}>Username
                  <input style={inputStyle} value={editUsername} onChange={e => setEditUsername(e.target.value)} />
                </label>
                <label style={{ ...labelStyle, display: 'block', marginTop: 8 }}>New password <span style={{ color: '#9C6B26', fontSize: 10, fontWeight: 400 }}>(khali chhoden agar change nahi karna)</span>
                  <input style={inputStyle} type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="Leave blank to keep current" />
                </label>
                <label style={{ ...labelStyle, display: 'block', marginTop: 8 }}>Role
                  <select style={inputStyle} value={editRole} onChange={e => setEditRole(e.target.value)}>
                    <option value="agent">Agent</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                {editError && <div style={{ marginTop: 8, background: '#F7E6E1', border: '1px solid #B0432F', color: '#B0432F', padding: '6px 10px', borderRadius: 6, fontSize: 12 }}>{editError}</div>}
                <button type="submit" disabled={editSaving} style={{ marginTop: 10, width: '100%', background: '#2F6F4E', color: '#F7F3EC', border: 'none', borderRadius: 6, padding: '8px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: editSaving ? 0.7 : 1 }}>
                  {editSaving ? 'Saving…' : 'Save changes'}
                </button>
              </form>
            )}
          </div>
        ))}
      </div>

      {!showAdd ? (
        <button onClick={() => { setShowAdd(true); setEditingUser(null); }} style={{ width: '100%', background: '#1B2A4A', color: '#F7F3EC', border: 'none', borderRadius: 6, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + Add team member
        </button>
      ) : (
        <form onSubmit={addUser} style={{ border: '1px solid #E3DCC9', borderRadius: 8, padding: 14, background: '#FFFDFA' }}>
          <label style={labelStyle}>Username
            <input style={inputStyle} value={newUsername} onChange={e => setNewUsername(e.target.value)} />
          </label>
          <label style={{ ...labelStyle, display: 'block', marginTop: 10 }}>Password
            <input style={inputStyle} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          </label>
          <label style={{ ...labelStyle, display: 'block', marginTop: 10 }}>Role
            <select style={inputStyle} value={newRole} onChange={e => setNewRole(e.target.value)}>
              <option value="agent">Agent</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          {addError && <div style={{ marginTop: 10, background: '#F7E6E1', border: '1px solid #B0432F', color: '#B0432F', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>{addError}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="submit" disabled={saving} style={{ flex: 1, background: '#1B2A4A', color: '#F7F3EC', border: 'none', borderRadius: 6, padding: '9px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Adding…' : 'Add'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} style={{ flex: 1, background: 'none', border: '1px solid #D8D0BC', borderRadius: 6, padding: '9px', fontSize: 13, cursor: 'pointer', color: '#6B6458' }}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
