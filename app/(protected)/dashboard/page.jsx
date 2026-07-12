"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  getDocs,
  limit,
  orderBy,
  doc,
  getDoc,
} from "firebase/firestore";
import { auth, db } from "@/services/firebase";

export default function DashboardPage() {
  const [interviews, setInterviews] = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  const [prepContext, setPrepContext] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const user = auth?.currentUser;
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        setError(null);

        // 1. Fetch recent interviews (User-Private)
        const q = query(
          collection(db, `users/${user.uid}/interviews`),
          orderBy("createdAt", "desc"),
          limit(5),
        );
        const querySnapshot = await getDocs(q);
        const history = [];
        querySnapshot.forEach((doc) => {
          history.push({ id: doc.id, ...doc.data() });
        });
        setInterviews(history);

        // 2. Fetch Recommendation
        const recRef = doc(db, `users/${user.uid}/recommendations/current`);
        const recSnap = await getDoc(recRef);
        if (recSnap.exists()) {
          setRecommendation(recSnap.data());
        }

        // 3. Fetch Prep Context
        const contextRef = doc(db, `users/${user.uid}/prepContext/main`);
        const contextSnap = await getDoc(contextRef);
        if (contextSnap.exists()) {
          setPrepContext(contextSnap.data());
        }
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        setError("Failed to load your progress.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const completedSessions = interviews.filter((i) => i.status === "completed");
  const avgScore =
    completedSessions.length > 0
      ? Math.round(
          completedSessions.reduce(
            (acc, curr) => acc + (curr.feedback?.performanceScore || 0),
            0,
          ) / completedSessions.length,
        )
      : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* --- Header --- */}
      <header className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            {getTimeGreeting()},{" "}
            <span className="text-indigo-600">
              {user?.displayName?.split(" ")[0] || "Candidate"}
            </span>
          </h1>
          <p className="text-slate-500 mt-2 text-lg">
            {prepContext?.targetRole
              ? `Preparing for ${prepContext.targetRole} roles.`
              : "What would you like to work on today?"}
          </p>
        </div>
        <div className="hidden sm:block">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-100 px-3 py-1 rounded-full">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>
      </header>

      {/* --- Hero Section (Primary Actions) --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 animate-slide-up">
        {/* Action Card 1: Resume */}
        <div
          className="group relative bg-white rounded-3xl p-8 shadow-sm border border-slate-200 hover:shadow-xl hover:border-purple-200 transition-all duration-300 flex flex-col items-start overflow-hidden cursor-pointer"
          onClick={() => router.push("/resume-analyzer")}
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-purple-50 rounded-bl-full -mr-16 -mt-16 transition-transform duration-500 group-hover:scale-110"></div>

          <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center text-2xl mb-6 relative z-10 shadow-sm group-hover:scale-110 transition-transform duration-300">
            <i className="fa-solid fa-file-invoice"></i>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-3 relative z-10 group-hover:text-purple-700 transition-colors">
            Analyze My Resume
          </h2>
          <p className="text-slate-500 mb-8 leading-relaxed relative z-10">
            See how your resume matches a real job description and uncover
            exactly what interviewers will focus on.
          </p>

          <div className="mt-auto w-full relative z-10">
            <button className="w-full sm:w-auto px-6 py-3.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center justify-center gap-2">
              Start Resume Analysis <i className="fa-solid fa-arrow-right"></i>
            </button>
          </div>
        </div>

        {/* Action Card 2: Interview */}
        <div
          className="group relative bg-white rounded-3xl p-8 shadow-sm border border-slate-200 hover:shadow-xl hover:border-indigo-200 transition-all duration-300 flex flex-col items-start overflow-hidden cursor-pointer"
          onClick={() => router.push("/setup")}
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50 rounded-bl-full -mr-16 -mt-16 transition-transform duration-500 group-hover:scale-110"></div>

          <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl mb-6 relative z-10 shadow-sm group-hover:scale-110 transition-transform duration-300">
            <i className="fa-solid fa-microphone-lines"></i>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-3 relative z-10 group-hover:text-indigo-700 transition-colors">
            Practice an AI Interview
          </h2>
          <p className="text-slate-500 mb-8 leading-relaxed relative z-10">
            Simulate a real technical interview with our AI voice assistant. Get
            grilled on your stack and receive instant feedback.
          </p>

          <div className="mt-auto w-full relative z-10">
            <button className="w-full sm:w-auto px-6 py-3.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 hover:-translate-y-0.5 flex items-center justify-center gap-2">
              Start Mock Interview <i className="fa-solid fa-arrow-right"></i>
            </button>
          </div>
        </div>
      </div>

      {/* --- Smart Context & Stats --- */}
      <div
        className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12 animate-slide-up"
        style={{ animationDelay: "0.1s" }}
      >
        {/* Smart Context Banner */}
        <div className="lg:col-span-2 bg-gradient-to-br from-slate-50 to-white rounded-3xl border border-slate-200 p-8 flex flex-col justify-center relative overflow-hidden">
          {recommendation ? (
            // Personalized Recommendation State
            <div className="relative z-10">
              <div
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-4 border ${
                  recommendation.type === "review_weakness"
                    ? "bg-amber-100 text-amber-700 border-amber-200"
                    : "bg-emerald-100 text-emerald-700 border-emerald-200"
                }`}
              >
                <i
                  className={`fa-solid ${recommendation.type === "review_weakness" ? "fa-triangle-exclamation" : "fa-star"}`}
                ></i>
                Recommended Next Step
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">
                {recommendation.message}
              </h3>
              <p className="text-slate-500 mb-6 max-w-lg leading-relaxed">
                {recommendation.reason}
              </p>
              <button
                onClick={() => router.push(recommendation.targetAction)}
                className="text-indigo-600 font-bold text-sm hover:text-indigo-800 flex items-center gap-2 group transition-all"
              >
                Take Action{" "}
                <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
              </button>
            </div>
          ) : (
            // Default State
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold mb-4 border border-indigo-200">
                <i className="fa-solid fa-route"></i> Get Started
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">
                Build your interview roadmap
              </h3>
              <p className="text-slate-500 mb-6 max-w-lg leading-relaxed">
                Analyze your resume to let our AI identify your skill gaps and
                tailor a personal plan.
              </p>
              <button
                onClick={() => router.push("/resume-analyzer")}
                className="text-indigo-600 font-bold text-sm hover:text-indigo-800 flex items-center gap-2 group transition-all"
              >
                Analyze Resume First{" "}
                <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
              </button>
            </div>
          )}
        </div>

        {/* Stats Column */}
        <div className="space-y-4">
          {/* Stat 1 */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-1">
                Total Sessions
              </p>
              <p className="text-3xl font-bold text-slate-900">
                {interviews.length}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-xl">
              <i className="fa-regular fa-calendar-check"></i>
            </div>
          </div>

          {/* Stat 2 */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-1">
                Avg Score
              </p>
              <p className="text-3xl font-bold text-slate-900">
                {avgScore > 0 ? avgScore : "-"}
                <span className="text-sm text-slate-400 font-normal ml-1">
                  /100
                </span>
              </p>
            </div>
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-xl">
              <i className="fa-solid fa-chart-line"></i>
            </div>
          </div>

          {/* Motivation Card */}
          <div className="bg-amber-50/80 p-5 rounded-2xl border border-amber-100/50">
            <p className="text-amber-800 text-xs font-semibold leading-relaxed flex gap-2">
              <i className="fa-solid fa-lightbulb mt-0.5"></i>
              <span>
                Users who practice{" "}
                <span className="font-bold underline">6+ interviews</span>{" "}
                improve their offer rate by 2×.
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* --- Recent Activity --- */}
      <div className="animate-slide-up" style={{ animationDelay: "0.3s" }}>
        <div className="flex justify-between items-end mb-6 px-1">
          <h3 className="text-xl font-bold text-slate-900">Recent Activity</h3>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center">
              <i className="fa-solid fa-circle-notch fa-spin text-2xl mb-3"></i>
              <span>Loading history...</span>
            </div>
          ) : error ? (
            <div className="p-12 text-center text-red-500">
              <i className="fa-solid fa-circle-exclamation mb-2"></i>
              <p>{error}</p>
            </div>
          ) : interviews.length === 0 ? (
            <div className="py-16 px-6 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                <i className="fa-solid fa-clock-rotate-left text-2xl"></i>
              </div>
              <h4 className="text-slate-900 font-bold mb-1">
                No recent activity
              </h4>
              <p className="text-sm text-slate-500">
                Your practice sessions will appear here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {interviews.map((session) => (
                <li
                  key={session.id}
                  className="group hover:bg-slate-50 transition-colors duration-200"
                >
                  <Link href={`/result/${session.id}`} className="block p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-5">
                        {/* Status Icon */}
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg shadow-sm transition-transform group-hover:scale-105
                                                ${
                                                  session.status === "completed"
                                                    ? "bg-emerald-50 text-emerald-600"
                                                    : "bg-amber-50 text-amber-600"
                                                }`}
                        >
                          {session.status === "completed" ? (
                            <i className="fa-solid fa-check"></i>
                          ) : (
                            <i className="fa-solid fa-play ml-1"></i>
                          )}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-base">
                            {session.config.role}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded text-nowrap">
                              {session.config.type}
                            </span>
                            <span className="text-xs text-slate-400">•</span>
                            <span className="text-xs text-slate-500">
                              {session.config.level}
                            </span>
                            {/* Mode Display */}
                            {session.config.mode && (
                              <>
                                <span className="text-xs text-slate-400">
                                  •
                                </span>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full ${
                                    session.config.mode === "Friendly Coach"
                                      ? "bg-green-100 text-green-700"
                                      : session.config.mode === "Stress Mode"
                                        ? "bg-red-100 text-red-700"
                                        : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {session.config.mode}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right pl-4">
                        {session.status === "completed" ? (
                          <div className="flex flex-col items-end">
                            <span
                              className={`text-lg font-bold ${
                                (session.feedback?.performanceScore || 0) >= 80
                                  ? "text-emerald-600"
                                  : (session.feedback?.performanceScore || 0) >=
                                      60
                                    ? "text-amber-600"
                                    : "text-slate-700"
                              }`}
                            >
                              {session.feedback?.performanceScore || 0}
                            </span>
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wide">
                              Score
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end">
                            <span className="text-sm font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">
                              In Progress
                            </span>
                          </div>
                        )}
                        <p className="text-xs text-slate-300 font-medium mt-1">
                          {new Date(session.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
