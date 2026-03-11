'use client';

import React, { useState, useEffect } from 'react';
import { updateProfile, updatePassword } from 'firebase/auth';
import { auth } from '@/services/firebase';

export default function ProfilePage() {
  const user = auth?.currentUser;
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.displayName) {
      setDisplayName(user.displayName);
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setMessage(null);

    try {
      await updateProfile(user, { displayName });
      setMessage({ type: 'success', text: 'Profile updated successfully.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to update profile.' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password should be at least 6 characters.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await updatePassword(user, newPassword);
      setMessage({ type: 'success', text: 'Password updated successfully.' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        setMessage({ type: 'error', text: 'Please logout and login again to change your password.' });
      } else {
        setMessage({ type: 'error', text: error.message || 'Failed to update password.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 animate-slide-up">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500">Manage your account preferences.</p>
      </div>

      {message && (
        <div className={`p-4 mb-6 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
          <i className={`fa-solid ${message.type === 'success' ? 'fa-check-circle' : 'fa-circle-exclamation'}`}></i>
          {message.text}
        </div>
      )}

      <div className="space-y-8">
        {/* Profile Card */}
        <div className="bg-white shadow-sm rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-lg font-bold text-slate-800">Personal Information</h3>
          </div>
          <form onSubmit={handleUpdateProfile} className="p-8 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="block w-full rounded-xl border-slate-200 bg-slate-100 text-slate-500 sm:text-sm p-3 border cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="block w-full bg-gray-100 rounded-xl border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all p-3 text-sm font-medium"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex justify-center py-2.5 px-5 border border-transparent shadow-sm text-sm font-bold rounded-full text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>

        {/* Security Card */}
        <div className="bg-white shadow-sm rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-lg font-bold text-slate-800">Security</h3>
          </div>
          <form onSubmit={handleUpdatePassword} className="p-8 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="block w-full rounded-xl border-slate-200 bg-gray-100 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all p-3 text-sm font-medium"
                placeholder="Min 6 chars"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                placeholder='Confirm Password'
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block bg-gray-100  w-full rounded-xl border-slate-100 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all p-3 text-sm font-medium"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading || !newPassword}
                className="inline-flex justify-center py-2.5 px-5 border border-transparent shadow-sm text-sm font-bold rounded-full text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all"
              >
                Update Password
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
