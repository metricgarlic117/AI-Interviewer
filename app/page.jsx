"use client";
import React from "react";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-slate-50 overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 backdrop-blur-sm border border-indigo-100 mb-8 animate-fade-in">
          <span className="flex h-2 w-2 rounded-full bg-indigo-500"></span>
          <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">
            AI-Powered Interview Prep
          </span>
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 tracking-tight mb-6 animate-slide-up">
          Master Your <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
            Tech Interview
          </span>
        </h1>

        <p
          className="mt-4 max-w-2xl mx-auto text-xl text-slate-600 mb-10 leading-relaxed animate-slide-up"
          style={{ animationDelay: "0.1s" }}
        >
          Practice with an advanced AI that simulates real technical interviews.
          Get instant, actionable feedback and level up your career.
        </p>

        <div
          className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-slide-up"
          style={{ animationDelay: "0.2s" }}
        >
          <Link
            href="/signup"
            className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white transition-all duration-200 bg-slate-900 font-pj rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 hover:bg-gray-800 hover:-translate-y-1 shadow-xl hover:shadow-2xl"
          >
            Start for Free
            <i className="fa-solid fa-arrow-right ml-2 transition-transform group-hover:translate-x-1"></i>
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-slate-700 transition-all duration-200 bg-white border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-100"
          >
            Log In
          </Link>
        </div>

        {/* Feature Grid */}
        <div
          className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 text-left animate-slide-up"
          style={{ animationDelay: "0.3s" }}
        >
          {[
            {
              icon: "fa-microphone-lines",
              title: "Voice-First AI",
              desc: "Speak naturally. Our AI listens, understands context, and responds with human-like latency.",
            },
            {
              icon: "fa-code",
              title: "Technical Deep Dives",
              desc: "From React hooks to System Design, select your stack and get grilled on what matters.",
            },
            {
              icon: "fa-chart-pie",
              title: "Instant Feedback",
              desc: "Receive a detailed scorecard on your communication, accuracy, and areas for improvement.",
            },
          ].map((feature, idx) => (
            <div
              key={idx}
              className="bg-white/60 backdrop-blur-md p-8 rounded-2xl border border-white/50 shadow-sm hover:shadow-md transition-all hover:-translate-y-1"
            >
              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-6 text-indigo-600 text-xl">
                <i className={`fa-solid ${feature.icon}`}></i>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
