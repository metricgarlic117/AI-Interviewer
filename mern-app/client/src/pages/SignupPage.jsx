import React from 'react';
import RegisterForm from '../features/auth/components/RegisterForm';

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-200/30 rounded-full blur-3xl mix-blend-multiply filter opacity-50 animate-blob"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-200/30 rounded-full blur-3xl mix-blend-multiply filter opacity-50 animate-blob animation-delay-2000"></div>

      <RegisterForm />
    </div>
  );
}
