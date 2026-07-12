"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "@/services/firebase";
import { getSessionMessages } from "@/services/userData";

// --- Helper Components ---

function CategoryBar({ label, score, icon }) {
  const pct = Math.round((score / 10) * 100);
  const color =
    score >= 8
      ? "bg-emerald-500"
      : score >= 6
        ? "bg-blue-500"
        : score >= 4
          ? "bg-amber-500"
          : "bg-rose-500";
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-sm">
        <span className="flex items-center gap-2 font-medium text-slate-700">
          <i className={`fa-solid ${icon} text-slate-400 w-4`}></i>
          {label}
        </span>
        <span className="font-bold text-slate-800">
          {score}
          <span className="text-slate-400 font-normal">/10</span>
        </span>
      </div>
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function HiringBadge({ decision }) {
  const map = {
    "Strong Hire": {
      bg: "bg-emerald-50 border-emerald-300 text-emerald-800",
      text: "Strong Hire",
      icon: "fa-circle-check",
    },
    Hire: {
      bg: "bg-blue-50 border-blue-300 text-blue-800",
      text: "Hire",
      icon: "fa-thumbs-up",
    },
    Borderline: {
      bg: "bg-amber-50 border-amber-300 text-amber-800",
      text: "Borderline",
      icon: "fa-circle-half-stroke",
    },
    "No Hire": {
      bg: "bg-rose-50 border-rose-300 text-rose-800",
      text: "No Hire",
      icon: "fa-circle-xmark",
    },
  };
  const style = map[decision] || map["Borderline"];
  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-bold ${style.bg}`}
    >
      <i className={`fa-solid ${style.icon}`}></i>
      {style.text}
    </span>
  );
}

export default function ResultPage({ params }) {
  const resolvedParams = React.use(params);
  const sessionId = resolvedParams.id;
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandQuestions, setExpandQuestions] = useState(false);

  useEffect(() => {
    const fetchResult = async () => {
      if (!sessionId) return;
      const user = auth.currentUser;
      if (!user) return;

      try {
        const docRef = doc(db, `users/${user.uid}/interviews`, sessionId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const subMessages = await getSessionMessages(user.uid, sessionId);
          const legacyMessages = data.messages || [];
          const allMessages = [...legacyMessages, ...subMessages].sort(
            (a, b) => a.timestamp - b.timestamp,
          );
          setSession({ id: docSnap.id, ...data, messages: allMessages });
        }
      } catch (error) {
        console.error("Error fetching result:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchResult();
  }, [sessionId]);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );

  if (!session || !session.feedback)
    return (
      <div className="p-10 text-center text-slate-500">Feedback not found.</div>
    );

  const { feedback, config } = session;
  const f = feedback;

  // Derive grade color
  const gradeColor =
    f.performanceScore >= 80
      ? "text-emerald-700 bg-emerald-50 border-emerald-300"
      : f.performanceScore >= 65
        ? "text-blue-700 bg-blue-50 border-blue-300"
        : f.performanceScore >= 50
          ? "text-amber-700 bg-amber-50 border-amber-300"
          : "text-rose-700 bg-rose-50 border-rose-300";

  // Sanitise config display fields — guard against hallucinated text from old sessions
  const VALID_LEVELS = [
    "Intern",
    "Junior",
    "Mid-level",
    "Senior",
    "Lead",
    "Staff",
  ];
  const VALID_TYPES = [
    "Technical",
    "Behavioral",
    "Mixed",
    "System Design",
    "HR",
  ];
  const safeField = (value, validList) => {
    if (!value || typeof value !== "string") return "—";
    if (value.length > 30) return "—"; // clearly hallucinated
    if (
      validList &&
      !validList.some((v) => value.toLowerCase().includes(v.toLowerCase()))
    )
      return value; // let it pass if list misses it
    return value;
  };
  const safeLevel = safeField(config.level, VALID_LEVELS);
  const safeType = safeField(config.type, VALID_TYPES);
  const safeMode = safeField(config.mode?.split(" ")[0]);

  // Category scores with defaults for old sessions
  const cats = f.categoryScores || {
    technicalKnowledge: Math.round(f.performanceScore / 10),
    problemSolving: Math.round(f.performanceScore / 10),
    communicationClarity: Math.round(f.performanceScore / 10),
    culturalAndBehavioral: Math.round(f.performanceScore / 10),
    cvAlignment: 5,
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wide">
              Interview Scorecard
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-slate-500 text-xs">
              {new Date(session.createdAt).toLocaleDateString()}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">{config.role}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {safeLevel} · {safeType} Interview · {config.mode}
          </p>
        </div>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 bg-white border border-slate-200 rounded-full text-sm font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* TOP ROW: Score + Hiring Decision */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Score Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
          <div
            className={`w-36 h-36 rounded-full flex flex-col items-center justify-center border-[5px] mb-4 ${gradeColor}`}
          >
            <span className="text-5xl font-extrabold tracking-tight leading-none">
              {f.performanceScore}
            </span>
            <span className="text-xs font-bold uppercase opacity-70 mt-1">
              / 100
            </span>
          </div>
          <div
            className={`text-3xl font-extrabold mb-1 ${gradeColor.split(" ")[0]}`}
          >
            {f.overallGrade || "—"}
          </div>
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">
            Overall Grade
          </p>
        </div>

        {/* Hiring Decision + Rationale */}
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-100 p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                <i className="fa-solid fa-gavel text-sm"></i>
              </div>
              <h3 className="font-bold text-slate-800">Hiring Decision</h3>
            </div>
            <div className="mb-4">
              <HiringBadge decision={f.hiringDecision || "Borderline"} />
            </div>
            <p className="text-slate-600 text-sm leading-relaxed">
              {f.hiringRationale || f.communicationSkills}
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 text-center gap-2">
            <div>
              <div className="text-xs text-slate-400 uppercase font-medium mb-1">
                Level
              </div>
              <div className="text-sm font-bold text-slate-700">
                {safeLevel}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase font-medium mb-1">
                Type
              </div>
              <div className="text-sm font-bold text-slate-700">{safeType}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase font-medium mb-1">
                Mode
              </div>
              <div className="text-sm font-bold text-slate-700">{safeMode}</div>
            </div>
          </div>
        </div>
      </div>

      {/* CATEGORY SCORES */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
            <i className="fa-solid fa-chart-bar text-sm"></i>
          </div>
          <h3 className="font-bold text-slate-800">Performance Breakdown</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5">
          <CategoryBar
            label="Technical Knowledge"
            score={cats.technicalKnowledge}
            icon="fa-code"
          />
          <CategoryBar
            label="Problem Solving"
            score={cats.problemSolving}
            icon="fa-brain"
          />
          <CategoryBar
            label="Communication Clarity"
            score={cats.communicationClarity}
            icon="fa-message"
          />
          <CategoryBar
            label="Cultural & Behavioral"
            score={cats.culturalAndBehavioral}
            icon="fa-people-group"
          />
          <CategoryBar
            label="CV Alignment"
            score={cats.cvAlignment}
            icon="fa-file-lines"
          />
        </div>
      </div>

      {/* ASSESSMENTS: Technical + Communication */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-violet-50 flex items-center justify-center text-violet-600">
              <i className="fa-solid fa-code"></i>
            </div>
            <h3 className="font-bold text-slate-800">Technical Accuracy</h3>
          </div>
          <p className="text-slate-600 text-sm leading-relaxed">
            {f.technicalAccuracy}
          </p>
        </div>
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <i className="fa-solid fa-message"></i>
            </div>
            <h3 className="font-bold text-slate-800">Communication Skills</h3>
          </div>
          <p className="text-slate-600 text-sm leading-relaxed">
            {f.communicationSkills}
          </p>
        </div>
      </div>

      {/* CV ALIGNMENT + JD ALIGNMENT */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-amber-100 border-l-4 border-l-amber-400">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
              <i className="fa-solid fa-file-lines"></i>
            </div>
            <h3 className="font-bold text-slate-800">CV / Resume Alignment</h3>
            <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              {cats.cvAlignment}/10
            </span>
          </div>
          <p className="text-slate-600 text-sm leading-relaxed">
            {f.cvAlignmentFeedback ||
              "No CV was provided for this session. Provide your CV in the setup to get personalised alignment feedback."}
          </p>
        </div>

        {f.jdAlignmentFeedback ? (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-indigo-100 border-l-4 border-l-indigo-400">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                <i className="fa-solid fa-briefcase"></i>
              </div>
              <h3 className="font-bold text-slate-800">
                Job Description Match
              </h3>
            </div>
            <p className="text-slate-600 text-sm leading-relaxed">
              {f.jdAlignmentFeedback}
            </p>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-3xl p-6 border border-dashed border-slate-200 flex flex-col items-center justify-center text-center gap-2">
            <i className="fa-solid fa-briefcase text-slate-300 text-2xl"></i>
            <p className="text-slate-400 text-sm">
              No Job Description provided.
              <br />
              Add a JD in Setup for role-specific feedback.
            </p>
          </div>
        )}
      </div>

      {/* STRENGTHS + WEAKNESSES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-emerald-50/50 rounded-3xl p-6 border border-emerald-100">
          <h3 className="font-bold text-emerald-800 mb-4 flex items-center gap-2">
            <i className="fa-solid fa-thumbs-up"></i> Strengths
          </h3>
          <ul className="space-y-3">
            {f.strengths.map((s, i) => (
              <li key={i} className="flex items-start text-sm text-slate-700">
                <i className="fa-solid fa-check text-emerald-500 mt-1 mr-2.5 flex-shrink-0"></i>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-rose-50/50 rounded-3xl p-6 border border-rose-100">
          <h3 className="font-bold text-rose-800 mb-4 flex items-center gap-2">
            <i className="fa-solid fa-arrow-trend-up"></i> Growth Areas
          </h3>
          <ul className="space-y-3">
            {f.weaknesses.map((w, i) => (
              <li key={i} className="flex items-start text-sm text-slate-700">
                <i className="fa-solid fa-bullseye text-rose-400 mt-1 mr-2.5 flex-shrink-0"></i>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ACTIONABLE TIPS */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-lightbulb text-amber-500"></i> Actionable
            Improvement Tips
          </h3>
        </div>
        <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {f.improvementTips.map((tip, i) => (
            <div key={i} className="flex gap-4">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                {i + 1}
              </span>
              <p className="text-sm text-slate-600 leading-relaxed">{tip}</p>
            </div>
          ))}
        </div>
      </div>

      {/* PER-QUESTION FEEDBACK */}
      {f.perQuestionFeedback && f.perQuestionFeedback.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden mb-6">
          <button
            onClick={() => setExpandQuestions(!expandQuestions)}
            className="w-full px-8 py-5 flex justify-between items-center bg-slate-50/50 hover:bg-slate-100/70 transition-colors text-left"
          >
            <span className="font-bold text-slate-700 flex items-center gap-2">
              <i className="fa-solid fa-list-check text-indigo-400"></i>
              Per-Question Breakdown
              <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full text-xs font-bold">
                {f.perQuestionFeedback.length} questions
              </span>
            </span>
            <i
              className={`fa-solid fa-chevron-down text-slate-400 transition-transform duration-300 ${expandQuestions ? "rotate-180" : ""}`}
            ></i>
          </button>

          {expandQuestions && (
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {f.perQuestionFeedback.map((q, i) => {
                const scoreColor =
                  q.score >= 8
                    ? "bg-emerald-100 text-emerald-800"
                    : q.score >= 6
                      ? "bg-blue-100 text-blue-800"
                      : q.score >= 4
                        ? "bg-amber-100 text-amber-800"
                        : "bg-rose-100 text-rose-800";
                return (
                  <div key={i} className="p-6">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold mt-0.5">
                          Q{i + 1}
                        </span>
                        <p className="font-semibold text-slate-800 text-sm">
                          {q.question}
                        </p>
                      </div>
                      <span
                        className={`flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${scoreColor}`}
                      >
                        {q.score}/10
                      </span>
                    </div>
                    {q.candidateAnswer && (
                      <div className="ml-9 mb-2 bg-indigo-50 rounded-xl p-3">
                        <p className="text-xs text-indigo-500 font-bold uppercase mb-1">
                          Your Answer
                        </p>
                        <p className="text-sm text-slate-700 leading-relaxed">
                          {q.candidateAnswer}
                        </p>
                      </div>
                    )}
                    <div className="ml-9 bg-slate-50 rounded-xl p-3">
                      <p className="text-xs text-slate-400 font-bold uppercase mb-1">
                        Evaluation
                      </p>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {q.evaluation}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* FULL TRANSCRIPT */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <details className="group">
          <summary className="px-6 py-4 cursor-pointer flex justify-between items-center bg-slate-50 hover:bg-slate-100 transition-colors list-none">
            <span className="font-bold text-slate-700 text-sm uppercase tracking-wide">
              View Full Transcript
            </span>
            <span className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-open:rotate-180 transition-transform">
              <i className="fa-solid fa-chevron-down"></i>
            </span>
          </summary>
          <div className="p-6 space-y-4 border-t border-slate-200">
            {session.messages
              .filter((m) => m.text !== "Start the interview now.")
              .map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "model" ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[80%] p-4 rounded-xl text-sm ${msg.role === "model" ? "bg-slate-100 text-slate-800" : "bg-indigo-50 text-indigo-900"}`}
                  >
                    <p className="text-xs font-bold mb-1 opacity-50 uppercase">
                      {msg.role === "model" ? "AI Interviewer" : "You"}
                    </p>
                    {msg.text}
                  </div>
                </div>
              ))}
          </div>
        </details>
      </div>
    </div>
  );
}
