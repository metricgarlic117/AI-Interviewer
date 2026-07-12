import React from 'react';
import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <p className="text-7xl font-extrabold text-indigo-200 mb-4">404</p>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Page not found</h1>
      <p className="text-slate-500 mb-8">The page you're looking for doesn't exist or was moved.</p>
      <Link
        to="/dashboard"
        className="px-6 py-3 bg-indigo-600 text-white rounded-full font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
