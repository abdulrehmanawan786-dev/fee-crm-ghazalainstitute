import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function ResetPassword() {
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token') || '');
  }, []);

  async function handleReset(e) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords match nahi kar rahe!');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password kam az kam 8 characters ka hona chahiye!');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.resetPassword(token, newPassword);
      setMsg('✅ Password successfully change ho gaya! Ab login karen.');
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
      <div style={{
        background: '#FFFDFA', border: '1px solid #1B2A4A', borderRadius: 10, padding: 36, width: '100%', maxWidth: 380,
      }}>
        <h1 style={{ fontFamily: "Georgia, 'Iowan Old Style', serif", fontSize: 26, margin: '0 0 4px', color: '#1B2A4A' }}>
          Ghazala Institute
        </h1>
        <p style={{ margin: '0 0 24px', color: '#6B6458', fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>Reset Password</p>

        {msg ? (
          <div>
            <div style={{ padding: '10px 12px', borderRadius: 6, fontSize: 13, background: '#E6F7E6', border: '1px solid #2F6F4E', color: '#2F6F4E', marginBottom: 16 }}>
              {msg}
            </div>
            <button onClick={() => window.location.href = '/'} style={{
              width: '100%', background: '#1B2A4A', color: '#F7F3EC', border: 'none',
              borderRadius: 6, padding: '12px', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}>
              Login par jaen
            </button>
          </div>
        ) : (
          <form onSubmit={handleReset}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6B6458', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Naya Password
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoFocus
                style={{ display: 'block', width: '100%', marginTop: 4, padding: '10px 12px', borderRadius: 6, border: '1px solid #D8D0BC', fontSize: 15, boxSizing: 'border-box' }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6B6458', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginTop: 16 }}>
              Confirm Password
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: '10px 12px', borderRadius: 6, border: '1px solid #D8D0BC', fontSize: 15, boxSizing: 'border-box' }} />
            </label>
            {error && (
              <div style={{ marginTop: 16, background: '#F7E6E1', border: '1px solid #B0432F', color: '#B0432F', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} style={{
              marginTop: 22, width: '100%', background: '#1B2A4A', color: '#F7F3EC', border: 'none',
              borderRadius: 6, padding: '12px', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}>
              {loading ? 'Reset ho raha hai…' : 'Password Reset Karen'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
