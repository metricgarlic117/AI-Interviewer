import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { getApiErrorMessage } from '../../../lib/axios';

export default function RegisterForm() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }

    setIsLoading(true);
    setError('');
    try {
      await register({ name: username, email, password });
      navigate('/dashboard');
    } catch (err) {
      const status = err?.response?.status;
      if (status === 409) {
        setError('Email already in use.');
      } else if (status === 422) {
        const details = err.response?.data?.errors;
        setError(details?.[0]?.message || 'Please check your details.');
      } else {
        setError(getApiErrorMessage(err, 'Failed to create account'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full glass-card p-8 sm:p-10 rounded-2xl shadow-2xl relative z-10">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Create Account</h2>
        <p className="mt-2 text-sm text-slate-600">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-semibold text-indigo-600 hover:text-indigo-500 transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
      <form className="mt-8 space-y-4" onSubmit={handleSignup}>
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100 flex items-center">
            <i className="fa-solid fa-circle-exclamation mr-2"></i>
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
          <input
            type="text"
            required
            className="block w-full px-4 py-3 bg-gray-100 rounded-xl border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
            placeholder="John Doe"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input
            type="email"
            required
            className="block w-full px-4 py-3 bg-gray-100 rounded-xl border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              required
              className="block w-full px-4 py-3 bg-gray-100 rounded-xl border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirm</label>
            <input
              type="password"
              required
              className="block w-full px-4 py-3 rounded-xl bg-gray-100 border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>
        <p className="text-[11px] text-slate-400">
          Minimum 8 characters, with at least one letter and one number.
        </p>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-6 flex justify-center py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5 disabled:opacity-70"
        >
          {isLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Create Account'}
        </button>
      </form>
    </div>
  );
}
