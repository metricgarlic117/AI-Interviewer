import React, { useState } from 'react';
import { useAuth } from '../features/auth/hooks/useAuth';
import * as authApi from '../features/auth/services/authApi';
import { getApiErrorMessage } from '../lib/axios';

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const updated = await authApi.updateProfile({ name: displayName });
      setUser(updated);
      setMessage({ type: 'success', text: 'Profile updated successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, 'Failed to update profile.') });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password should be at least 8 characters.' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const text = await authApi.changePassword({ currentPassword, newPassword });
      setMessage({ type: 'success', text: text || 'Password updated successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, 'Failed to update password.') });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 animate-slide-up">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500">Manage your account preferences.</p>
      </div>

      {message && (
        <div
          className={`p-4 mb-6 rounded-xl flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-100'
              : 'bg-red-50 text-red-700 border border-red-100'
          }`}
        >
          <i
            className={`fa-solid ${
              message.type === 'success' ? 'fa-check-circle' : 'fa-circle-exclamation'
            }`}
          ></i>
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
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="block w-full rounded-xl border-slate-200 bg-slate-100 text-slate-500 sm:text-sm p-3 border cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Display Name
              </label>
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
                disabled={isLoading}
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
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="block w-full rounded-xl border-slate-200 bg-gray-100 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all p-3 text-sm font-medium"
                placeholder="Your current password"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="block w-full rounded-xl border-slate-200 bg-gray-100 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all p-3 text-sm font-medium"
                placeholder="Min 8 chars, letters + numbers"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                placeholder="Confirm Password"
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block bg-gray-100 w-full rounded-xl border-slate-100 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all p-3 text-sm font-medium"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isLoading || !newPassword || !currentPassword}
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
