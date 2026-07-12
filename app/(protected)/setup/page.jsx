"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { addDoc, collection, getDoc, doc } from "firebase/firestore";
import * as pdfjsLib from "pdfjs-dist";
import { auth, db } from "@/services/firebase";
import { InterviewLevel, InterviewType, InterviewMode } from "@/types";
import { saveResume, saveJobDescription } from "@/services/userData";

// Handle PDF.js import quirks (ESM vs CJS/Namespace)
const pdfjs = pdfjsLib;
const api = pdfjs.default || pdfjs;

// Configure PDF.js worker
if (api.GlobalWorkerOptions) {
  api.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`;
}

const TEMPLATES = [
  {
    id: "senior-frontend",
    title: "Senior Frontend",
    icon: "fa-brands fa-react",
    color: "text-sky-500 bg-sky-50",
    config: {
      role: "Senior Frontend Engineer",
      type: InterviewType.Technical,
      level: InterviewLevel.Senior,
      mode: InterviewMode.Realistic,
      techStack: "React, TypeScript, Redux, Performance, CSS Arch",
      questionCount: 7,
    },
  },
  {
    id: "junior-backend",
    title: "Junior Backend",
    icon: "fa-brands fa-node",
    color: "text-green-600 bg-green-50",
    config: {
      role: "Junior Backend Developer",
      type: InterviewType.Technical,
      level: InterviewLevel.Junior,
      mode: InterviewMode.Coach,
      techStack: "Node.js, Express, REST APIs, SQL, Auth",
      questionCount: 5,
    },
  },
  {
    id: "data-scientist",
    title: "Data Scientist",
    icon: "fa-solid fa-chart-line",
    color: "text-orange-500 bg-orange-50",
    config: {
      role: "Data Scientist",
      type: InterviewType.Technical,
      level: InterviewLevel.Junior,
      mode: InterviewMode.Realistic,
      techStack: "Python, Pandas, ML, Statistics, SQL",
      questionCount: 6,
    },
  },
  {
    id: "behavioral",
    title: "Behavioral Prep",
    icon: "fa-solid fa-users",
    color: "text-purple-600 bg-purple-50",
    config: {
      role: "Software Engineer",
      type: InterviewType.Behavioral,
      level: InterviewLevel.Senior,
      mode: InterviewMode.Coach,
      techStack: "Leadership, Conflict Resolution, Culture Fit",
      questionCount: 4,
    },
  },
];

const formatFileSize = (bytes) => {
  if (bytes === 0) return "N/A";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

function SetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [contextLoaded, setContextLoaded] = useState(false);

  // Loading state for file parsing
  const [parsingFile, setParsingFile] = useState(false);
  const [resumeFile, setResumeFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const [config, setConfig] = useState({
    role: "Frontend Engineer",
    type: InterviewType.Technical,
    level: InterviewLevel.Junior,
    mode: InterviewMode.Realistic,
    techStack: "React, TypeScript, Tailwind CSS",
    questionCount: 5,
    jobDescription: "",
    resumeText: "",
  });

  // Fetch User Prep Context or use URL Search Params (from Resume Analyzer)
  useEffect(() => {
    const fetchContext = async () => {
      const user = auth.currentUser;
      if (!user) return;

      // Check if we came from Resume Analyzer via URL params
      const fromAnalysis = searchParams.get("fromAnalysis");
      if (fromAnalysis === "true") {
        const role = searchParams.get("role");
        const level = searchParams.get("level");
        const techStack = searchParams.get("techStack");
        const jd = searchParams.get("jd");
        const resume = searchParams.get("resume");

        setConfig((prev) => ({
          ...prev,
          role: role || prev.role,
          level: level || prev.level,
          techStack: techStack || prev.techStack,
          jobDescription: jd || "",
          resumeText: resume || "",
        }));
        if (resume) {
          setResumeFile({ name: "Imported Resume", size: 0 });
        }
        setContextLoaded(true);
        return; // Prioritize analysis result over general context
      }

      try {
        const contextRef = doc(db, `users/${user.uid}/prepContext/main`);
        const snap = await getDoc(contextRef);
        if (snap.exists()) {
          const data = snap.data();
          setConfig((prev) => ({
            ...prev,
            role: data.targetRole || prev.role,
            level: data.seniorityLevel || prev.level,
          }));
        }
      } catch (e) {
        console.error("Failed to load prep context", e);
      } finally {
        setContextLoaded(true);
      }
    };
    fetchContext();
  }, [searchParams]);

  const extractTextFromPdf = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = api.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item) => item.str).join(" ");
        fullText += pageText + " ";
      }
      return fullText;
    } catch (e) {
      console.error(e);
      throw new Error(`Failed to parse PDF: ${e.message}`);
    }
  };

  const processFile = async (file) => {
    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      return;
    }

    setParsingFile(true);
    setError(null);
    try {
      const text = await extractTextFromPdf(file);
      if (text.length < 50) {
        throw new Error(
          "Resume appears empty. Please upload a readable text-based PDF.",
        );
      }
      setConfig((prev) => ({ ...prev, resumeText: text }));
      setResumeFile({ name: file.name, size: file.size });
    } catch (err) {
      setError(err.message || "Failed to read resume.");
    } finally {
      setParsingFile(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const removeResume = () => {
    setResumeFile(null);
    setConfig((prev) => ({ ...prev, resumeText: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const applyTemplate = (templateConfig) => {
    // Preserve JD and Resume if user uploaded them before clicking template
    setConfig((prev) => ({
      ...templateConfig,
      jobDescription: prev.jobDescription,
      resumeText: prev.resumeText,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    setLoading(true);
    setError(null);
    try {
      // 1. Save Resume & JD References if they exist (Dedup)
      let resumeId = undefined;
      let jdId = undefined;
      // We will clear the text from config to save space, but only if we successfully save the reference
      const finalConfig = { ...config };

      if (config.resumeText && config.resumeText.length > 50) {
        resumeId = await saveResume(
          user.uid,
          config.resumeText,
          resumeFile?.name || "Uploaded Resume",
        );
        finalConfig.resumeId = resumeId;
        // Optional: clear text to strictly enforce reference usage, but for safety in transition we might keep it
        // User request: "interview stores only resumeId / jdId"
        delete finalConfig.resumeText;
      }

      if (config.jobDescription && config.jobDescription.length > 50) {
        jdId = await saveJobDescription(user.uid, config.jobDescription);
        finalConfig.jdId = jdId;
        delete finalConfig.jobDescription;
      }

      // 2. Create Interview Session (No redundant userId, No huge messages array)
      // Save to USER-PRIVATE collection
      const docRef = await addDoc(
        collection(db, `users/${user.uid}/interviews`),
        {
          // userId: user.uid, // Redundant
          config: finalConfig,
          createdAt: Date.now(),
          status: "in-progress",
          // messages: [], // Subcollection used now
        },
      );
      router.push(`/session/${docRef.id}`);
    } catch (err) {
      console.error("Error creating session:", err);
      if (err.message.includes("Missing or insufficient permissions")) {
        setError("Database permissions denied.");
      } else {
        setError("Failed to start interview.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-10 text-center animate-fade-in">
        <h1 className="text-3xl font-bold text-slate-900">
          Configure Interview
        </h1>
        <p className="text-slate-500 mt-2">
          {config.jobDescription
            ? "Setup customized based on your analyzed role."
            : contextLoaded
              ? "Personalized based on your career goals."
              : "Choose a template or customize your session settings."}
        </p>
      </div>

      <div className="mb-10 animate-slide-up">
        <div className="flex items-center gap-2 mb-4">
          <i className="fa-solid fa-bolt text-amber-500"></i>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide">
            Quick Start Templates
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => applyTemplate(t.config)}
              className="bg-white border border-slate-200 rounded-2xl p-4 text-left hover:border-indigo-400 hover:shadow-lg transition-all group relative overflow-hidden"
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${t.color} text-xl group-hover:scale-110 transition-transform`}
              >
                <i className={t.icon}></i>
              </div>
              <h3 className="font-bold text-slate-800 text-sm group-hover:text-indigo-700">
                {t.title}
              </h3>
              <p className="text-xs text-slate-400 mt-1 truncate">
                {t.config.role}
              </p>

              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Select
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div
        className="bg-white shadow-xl rounded-2xl overflow-hidden border border-slate-200 animate-slide-up"
        style={{ animationDelay: "0.1s" }}
      >
        <div className="px-8 py-6 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-sliders text-indigo-500"></i>
            Custom Configuration
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-200 flex items-center">
              <i className="fa-solid fa-circle-exclamation mr-2"></i> {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Interview Mode
              </label>
              <div className="grid grid-cols-1 gap-2">
                {Object.values(InterviewMode).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setConfig({ ...config, mode: m })}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      config.mode === m
                        ? "bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500"
                        : "bg-white border-slate-200 hover:border-indigo-300"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                        m === InterviewMode.Coach
                          ? "bg-green-100 text-green-600"
                          : m === InterviewMode.Stress
                            ? "bg-red-100 text-red-600"
                            : "bg-indigo-100 text-indigo-600"
                      }`}
                    >
                      <i
                        className={`fa-solid ${
                          m === InterviewMode.Coach
                            ? "fa-user-graduate"
                            : m === InterviewMode.Stress
                              ? "fa-fire"
                              : "fa-user-tie"
                        }`}
                      ></i>
                    </div>
                    <div>
                      <p
                        className={`text-sm font-bold ${config.mode === m ? "text-indigo-900" : "text-slate-700"}`}
                      >
                        {m}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {m === InterviewMode.Coach &&
                          "Guided, helpful feedback."}
                        {m === InterviewMode.Realistic &&
                          "Neutral, professional tone."}
                        {m === InterviewMode.Stress &&
                          "Fast-paced, minimal hints."}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Target Role
                </label>
                <input
                  type="text"
                  required
                  value={config.role}
                  onChange={(e) =>
                    setConfig({ ...config, role: e.target.value })
                  }
                  className="block w-full rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all p-3 text-sm font-medium"
                  placeholder="e.g. Senior Product Manager"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Type
                  </label>
                  <select
                    value={config.type}
                    onChange={(e) =>
                      setConfig({ ...config, type: e.target.value })
                    }
                    className="block w-full rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none p-3 text-sm font-medium"
                  >
                    {Object.values(InterviewType).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Seniority
                  </label>
                  <select
                    value={config.level}
                    onChange={(e) =>
                      setConfig({ ...config, level: e.target.value })
                    }
                    className="block w-full rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none p-3 text-sm font-medium"
                  >
                    {Object.values(InterviewLevel).map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Key Skills / Tech Stack
            </label>
            <textarea
              required
              rows={3}
              value={config.techStack}
              onChange={(e) =>
                setConfig({ ...config, techStack: e.target.value })
              }
              className="block w-full rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all p-3 text-sm font-medium"
              placeholder="e.g. System Design, Leadership, Distributed Systems..."
            />
          </div>

          {/* Job Description - Full Width */}
          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-bold text-slate-800">
                  Job Description (JD){" "}
                  <span className="text-xs font-normal text-slate-400 ml-1">
                    (Optional)
                  </span>
                </label>
                {config.jobDescription && (
                  <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-bold">
                    Filled
                  </span>
                )}
              </div>
              <div className="relative">
                <textarea
                  rows={6}
                  value={config.jobDescription || ""}
                  onChange={(e) =>
                    setConfig({ ...config, jobDescription: e.target.value })
                  }
                  className="block w-full rounded-2xl border-slate-200 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all p-4 text-sm leading-relaxed text-slate-700 resize-y shadow-sm hover:border-indigo-200"
                  placeholder="Paste the full job description here..."
                />

                <div className="absolute bottom-3 right-3 pointer-events-none">
                  <span className="text-[10px] text-slate-400 font-medium bg-white/80 px-2 py-1 rounded-md backdrop-blur-sm">
                    The AI interviewer will adapt based on this role.
                  </span>
                </div>
              </div>
            </div>

            {/* Resume Upload - Full Width */}
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-2">
                Your Resume{" "}
                <span className="text-xs font-normal text-slate-400 ml-1">
                  (Optional)
                </span>
              </label>

              {!resumeFile ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`group relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer 
                            ${
                              isDragging
                                ? "border-indigo-500 bg-indigo-50 scale-[1.01]"
                                : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50"
                            }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={handleFileInputChange}
                  />

                  {parsingFile ? (
                    <div className="py-4">
                      <i className="fa-solid fa-circle-notch fa-spin text-3xl text-indigo-600 mb-3"></i>
                      <p className="text-sm font-bold text-slate-700">
                        Analyzing Resume...
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Extracting skills and experience
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                        <i className="fa-solid fa-cloud-arrow-up text-2xl text-indigo-500"></i>
                      </div>
                      <h3 className="text-base font-bold text-slate-800 mb-1">
                        Upload Resume (PDF)
                      </h3>
                      <p className="text-sm text-slate-500 mb-4">
                        Drag & drop or click to browse
                      </p>
                      <p className="text-xs text-slate-400 max-w-xs mx-auto">
                        AI will extract your projects and stack to tailor the
                        interview questions.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between animate-fade-in">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-red-500 text-2xl">
                      <i className="fa-solid fa-file-pdf"></i>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">
                        {resumeFile.name}
                      </h3>
                      <p className="text-xs text-slate-500 flex items-center gap-2">
                        <span>{formatFileSize(resumeFile.size)}</span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                        <span className="text-green-600 font-bold flex items-center gap-1">
                          <i className="fa-solid fa-check-circle"></i> AI Ready
                        </span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeResume}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  >
                    <i className="fa-solid fa-trash-can"></i>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-sm font-semibold text-slate-700">
                Question Count
              </label>
              <span className="text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md text-sm">
                {config.questionCount} Questions
              </span>
            </div>
            <input
              type="range"
              min="3"
              max="10"
              value={config.questionCount}
              onChange={(e) =>
                setConfig({
                  ...config,
                  questionCount: parseInt(e.target.value),
                })
              }
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />

            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>Short (3)</span>
              <span>Long (10)</span>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={loading || parsingFile}
              className="inline-flex justify-center items-center py-3.5 px-8 border border-transparent shadow-lg shadow-indigo-200 text-sm font-bold rounded-full text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all hover:-translate-y-0.5"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <i className="fa-solid fa-circle-notch fa-spin"></i>{" "}
                  Initializing...
                </span>
              ) : (
                "Start Interview"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SetupPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
          <i className="fa-solid fa-circle-notch fa-spin text-4xl text-indigo-500 mb-4"></i>
          <p className="text-slate-500 font-medium">Loading configuration...</p>
        </div>
      }
    >
      <SetupContent />
    </React.Suspense>
  );
}
