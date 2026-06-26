import React, { useState } from 'react';
import { api, setToken, setRole } from '../api/client';

export default function Login({ onLoggedIn }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, username: u, role } = await api.login(username.trim(), password);
      setToken(token);
      setRole(role);
      onLoggedIn(u, role);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#F7F3EC', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", padding: 20,
    }}>
      <form onSubmit={submit} style={{
        background: '#FFFDFA', border: '1px solid #1B2A4A', borderRadius: 10, padding: 36, width: '100%', maxWidth: 380,
      }}>
        <h1 style={{ fontFamily: "Georgia, 'Iowan Old Style', serif", fontSize: 26, margin: '0 0 4px', color: '#1B2A4A' }}>
          Ghazala Institute
        </h1>
        <p style={{ margin: '0 0 24px', color: '#6B6458', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>Fee Ledger — Admin Login</p>

        <label style={{ fontSize: 12, fontWeight: 600, color: '#6B6458', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Username
          <input value={username} onChange={e => setUsername(e.target.value)} autoFocus
            style={{ display: 'block', width: '100%', marginTop: 4, padding: '10px 12px', borderRadius: 6, border: '1px solid #D8D0BC', fontSize: 15, boxSizing: 'border-box' }} />
        </label>

        <label style={{ fontSize: 12, fontWeight: 600, color: '#6B6458', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginTop: 16 }}>
          Password
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: '10px 12px', borderRadius: 6, border: '1px solid #D8D0BC', fontSize: 15, boxSizing: 'border-box' }} />
        </label>

        {error && (
          <div style={{ marginTop: 16, background: '#F7E6E1', border: '1px solid #B0432F', color: '#B0432F', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} style={{
          marginTop: 22, width: '100%', background: '#1B2A4A', color: '#F7F3EC', border: 'none',
          borderRadius: 6, padding: '12px', fontSize: 15, fontWeight: 600, cursor: loading ? 'default' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
