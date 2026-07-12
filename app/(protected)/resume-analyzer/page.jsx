"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import * as pdfjsLib from "pdfjs-dist";
import { analyzeResume, extractTextFromImage } from "@/services/gemini";
import { InterviewLevel } from "@/types";
import {
  saveFullResumeAnalysis,
  saveResume,
  saveJobDescription,
} from "@/services/userData";
import { auth } from "@/services/firebase";

// Handle PDF.js import quirks (ESM vs CJS/Namespace)
const pdfjs = pdfjsLib;
const api = pdfjs.default || pdfjs;

// Configure PDF.js worker
if (api.GlobalWorkerOptions) {
  api.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`;
}

export default function ResumeAnalyzerPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState("upload");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Data State
  const [resumeText, setResumeText] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [jdText, setJdText] = useState("");
  const [analysisResult, setAnalysisResult] = useState(null);

  // JD Input Mode
  const [jdTab, setJdTab] = useState("text");

  // --- Helpers ---
  const extractTextFromPdf = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      // Use the resolved api object to getDocument
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

  const handleResumeUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const text = await extractTextFromPdf(file);
      if (text.length < 50) {
        throw new Error(
          "Resume appears empty or is an image-based PDF. Please use a text-based PDF.",
        );
      }
      setResumeText(text);
      setResumeFileName(file.name);
      setCurrentStep("jd");
    } catch (err) {
      setError(err.message || "Failed to read resume.");
    } finally {
      setLoading(false);
    }
  };

  const handleJdFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    try {
      let text = "";
      if (file.type === "application/pdf") {
        text = await extractTextFromPdf(file);
      } else if (file.type.startsWith("image/")) {
        // Convert to base64 for Gemini Vision
        const reader = new FileReader();
        text = await new Promise((resolve, reject) => {
          reader.onload = async () => {
            const base64 = reader.result.split(",")[1];
            try {
              const extracted = await extractTextFromImage(base64, file.type);
              resolve(extracted);
            } catch (e) {
              reject(e);
            }
          };
          reader.readAsDataURL(file);
        });
      } else {
        throw new Error("Unsupported file type. Use PDF or Image.");
      }

      setJdText(text);
      setJdTab("text"); // Switch to text view so user can verify/edit
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    const user = auth.currentUser;
    if (!user) {
      router.push("/login");
      return;
    }

    setLoading(true);
    setCurrentStep("analysis");
    try {
      // 1. Analyze with Gemini
      const result = await analyzeResume(resumeText, jdText);
      setAnalysisResult(result);

      // 2. Save resume and JD to get IDs (OPTIMIZED - No duplicate storage)
      const resumeId = await saveResume(user.uid, resumeText, resumeFileName);
      const jdId =
        jdText.length > 50
          ? await saveJobDescription(user.uid, jdText)
          : undefined;

      // 3. Persist Analysis with ONLY REFERENCES (no duplicate text)
      await saveFullResumeAnalysis(
        user.uid,
        resumeId,
        resumeFileName,
        jdId,
        result,
      );

      setCurrentStep("results");
    } catch (err) {
      console.error(err);
      setError("Analysis failed. Please try again.");
      setCurrentStep("validation");
    } finally {
      setLoading(false);
    }
  };

  const startMockInterview = () => {
    if (!analysisResult) return;

    // 1. Determine Level
    let level = InterviewLevel.Junior;
    const sen = analysisResult.seniorityAlignment.toLowerCase();
    if (sen.includes("senior") || sen.includes("lead"))
      level = InterviewLevel.Senior;
    else if (sen.includes("intern")) level = InterviewLevel.Intern;

    // 2. Extract Role (Naive First Line of JD)
    const role = jdText.split("\n")[0].substring(0, 50) || "Software Engineer";

    // 3. Build Tech Stack from Focus Areas + Missing Skills
    const techStack = [
      ...analysisResult.interviewFocusAreas.slice(0, 3),
      ...analysisResult.skillsGap.missingSkills.slice(0, 2),
    ].join(", ");

    // 4. Navigate with Pre-filled State
    router.push(
      `/setup?fromAnalysis=true&role=${encodeURIComponent(role)}&level=${level}&techStack=${encodeURIComponent(techStack)}&jd=${encodeURIComponent(jdText)}&resume=${encodeURIComponent(resumeText)}`,
    );
  };

  // --- Render Steps ---

  const renderProgress = () => {
    const steps = ["Upload Resume", "Job Description", "Review", "Results"];
    const activeIdx = ["upload", "jd", "validation", "results"].indexOf(
      currentStep,
    );

    // Map 'analysis' to index 2 (Review) visually or just hide it
    const visualIdx = currentStep === "analysis" ? 2 : activeIdx;

    return (
      <div className="relative mb-8 mx-4">
        {/* Progress Track Container - Centered between first and last steps */}
        {/* Left/Right offset is 12.5% because each of 4 cols is 25%, so center is at 12.5% */}
        <div className="absolute top-5 left-[12.5%] right-[12.5%] h-1 bg-slate-200 rounded-full z-0">
          {/* Active Progress Fill */}
          <div
            className="h-full bg-indigo-600 rounded-full transition-all duration-500"
            style={{ width: `${(visualIdx / (steps.length - 1)) * 100}%` }}
          ></div>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-4 w-full relative">
          {steps.map((label, idx) => (
            <div
              key={idx}
              className="flex flex-col items-center gap-2 relative z-10"
            >
              {/* Circle with proper background to sit above the line */}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 border-4 ${
                  idx <= visualIdx
                    ? "bg-indigo-600 text-white border-white shadow-lg shadow-indigo-200"
                    : "bg-white text-slate-500 border-slate-200"
                }`}
              >
                {idx < visualIdx ? (
                  <i className="fa-solid fa-check"></i>
                ) : (
                  idx + 1
                )}
              </div>
              <span
                className={`text-xs font-medium text-center ${idx <= visualIdx ? "text-indigo-600" : "text-slate-400"}`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (currentStep === "analysis") {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center bg-slate-50">
        <div className="w-24 h-24 relative mb-8">
          <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-t-indigo-600 rounded-full animate-spin"></div>
          <i className="fa-solid fa-wand-magic-sparkles absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-500 text-2xl animate-pulse"></i>
        </div>
        <h2 className="text-2xl font-bold text-slate-800 animate-pulse">
          Analyzing Resume Fit...
        </h2>
        <p className="text-slate-500 mt-2">
          Comparing skills, seniority, and keywords against the job description.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-slate-900">
          AI Resume Analyzer
        </h1>
        <p className="text-slate-500 mt-2">
          Optimize your resume for the specific role you want.
        </p>
      </div>

      {renderProgress()}

      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden min-h-[400px] flex flex-col relative">
        {error && (
          <div className="absolute top-4 left-4 right-4 z-10 bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-100 flex items-center shadow-sm animate-fade-in">
            <i className="fa-solid fa-circle-exclamation mr-2"></i> {error}
            <button
              onClick={() => setError(null)}
              className="ml-auto hover:text-red-800"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        )}

        {/* --- STEP 1: RESUME UPLOAD --- */}
        {currentStep === "upload" && (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center animate-slide-up">
            <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 text-indigo-600 text-3xl shadow-inner">
              <i className="fa-solid fa-file-pdf"></i>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              Upload Your Resume
            </h2>
            <p className="text-slate-500 mb-8 max-w-sm">
              We accept PDF files. We'll scan it to extract your skills and
              experience.
            </p>

            <label className="group relative inline-flex flex-col items-center justify-center w-full max-w-lg h-48 border-2 border-slate-300 border-dashed rounded-2xl cursor-pointer hover:bg-slate-50 hover:border-indigo-400 transition-all">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {loading ? (
                  <i className="fa-solid fa-circle-notch fa-spin text-2xl text-indigo-500"></i>
                ) : (
                  <>
                    <i className="fa-solid fa-cloud-arrow-up text-3xl text-slate-400 group-hover:text-indigo-500 mb-3 transition-colors"></i>
                    <p className="text-sm text-slate-500 font-medium">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      PDF only (max 5MB)
                    </p>
                  </>
                )}
              </div>
              <input
                type="file"
                className="hidden"
                accept="application/pdf"
                onChange={handleResumeUpload}
                disabled={loading}
              />
            </label>
          </div>
        )}

        {/* --- STEP 2: JD INPUT --- */}
        {currentStep === "jd" && (
          <div className="flex-1 flex flex-col p-8 animate-slide-up">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                Job Description
              </h2>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => setJdTab("text")}
                  className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${jdTab === "text" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                >
                  Paste Text
                </button>
                <button
                  onClick={() => setJdTab("file")}
                  className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${jdTab === "file" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                >
                  Upload File/Image
                </button>
              </div>
            </div>

            {jdTab === "text" ? (
              <textarea
                className="flex-1 w-full p-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none font-mono text-sm"
                placeholder="Paste the full job description here..."
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl hover:bg-slate-50 transition-all">
                {loading ? (
                  <div className="text-center">
                    <i className="fa-solid fa-circle-notch fa-spin text-2xl text-indigo-600 mb-3"></i>
                    <p className="text-slate-500 font-medium">
                      Extracting text...
                    </p>
                  </div>
                ) : (
                  <label className="cursor-pointer text-center p-10 w-full h-full flex flex-col items-center justify-center">
                    <i className="fa-solid fa-image text-3xl text-slate-400 mb-3"></i>
                    <p className="text-sm font-bold text-slate-700">
                      Upload PDF or Screenshot
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      We'll extract the text automatically.
                    </p>
                    <input
                      type="file"
                      className="hidden"
                      accept="application/pdf, image/*"
                      onChange={handleJdFileUpload}
                    />
                  </label>
                )}
              </div>
            )}

            <div className="flex justify-between mt-6">
              <button
                onClick={() => setCurrentStep("upload")}
                className="text-slate-500 hover:text-slate-800 text-sm font-bold px-4"
              >
                Back
              </button>
              <button
                disabled={!jdText.trim() || jdText.length < 50}
                onClick={() => setCurrentStep("validation")}
                className="bg-indigo-600 text-white px-6 py-2.5 rounded-full font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-200 disabled:opacity-50 transition-all"
              >
                Next Step
              </button>
            </div>
          </div>
        )}

        {/* --- STEP 3: VALIDATION --- */}
        {currentStep === "validation" && (
          <div className="flex-1 flex flex-col p-8 animate-slide-up">
            <h2 className="text-xl font-bold text-slate-900 mb-6">
              Review Data
            </h2>

            <div className="space-y-4 mb-8">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 flex-shrink-0">
                  <i className="fa-solid fa-check"></i>
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-800 text-sm">
                    Resume Parsed
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {resumeText.substring(0, 150)}...
                  </p>
                  <div className="mt-2 text-xs font-bold text-indigo-600 bg-indigo-50 inline-block px-2 py-1 rounded">
                    {resumeFileName}
                  </div>
                </div>
                <button
                  onClick={() => setCurrentStep("upload")}
                  className="text-xs text-slate-400 hover:text-indigo-600 underline"
                >
                  Edit
                </button>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 flex-shrink-0">
                  <i className="fa-solid fa-check"></i>
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-800 text-sm">
                    Job Description Ready
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {jdText.substring(0, 150)}...
                  </p>
                  <div className="mt-2 text-xs font-bold text-slate-500">
                    {jdText.length} characters detected
                  </div>
                </div>
                <button
                  onClick={() => setCurrentStep("jd")}
                  className="text-xs text-slate-400 hover:text-indigo-600 underline"
                >
                  Edit
                </button>
              </div>
            </div>

            <div className="mt-auto flex justify-between items-center">
              <button
                onClick={() => setCurrentStep("jd")}
                className="text-slate-500 hover:text-slate-800 text-sm font-bold px-4"
              >
                Back
              </button>
              <button
                onClick={runAnalysis}
                className="bg-indigo-600 text-white px-8 py-3 rounded-full font-bold text-base hover:bg-indigo-700 shadow-xl shadow-indigo-200 hover:-translate-y-1 transition-all flex items-center gap-2"
              >
                <i className="fa-solid fa-wand-magic-sparkles"></i> Analyze Now
              </button>
            </div>
          </div>
        )}

        {/* --- STEP 4: RESULTS --- */}
        {currentStep === "results" && analysisResult && (
          <div className="flex-1 flex flex-col p-8 animate-slide-up overflow-y-auto max-h-[600px] scrollbar-hide">
            {/* Score Header */}
            <div className="flex flex-col md:flex-row gap-6 mb-8 items-center bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-6 text-white shadow-lg">
              <div className="relative">
                <svg
                  className="w-24 h-24 transform -rotate-90"
                  viewBox="0 0 96 96"
                >
                  <circle
                    cx="48"
                    cy="48"
                    r="36"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-indigo-900/30"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="36"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={226.2}
                    strokeDashoffset={
                      226.2 - (226.2 * analysisResult.matchScore) / 100
                    }
                    strokeLinecap="round"
                    className="text-white transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold">
                  {analysisResult.matchScore}%
                </div>
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-xl font-bold mb-2">Match Analysis</h2>
                <p className="text-indigo-100 text-sm leading-relaxed">
                  {analysisResult.roleFitSummary}
                </p>
                <div className="mt-3 inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-bold backdrop-blur-sm">
                  {analysisResult.seniorityAlignment}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Skills Gap */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <i className="fa-solid fa-layer-group text-indigo-500"></i>{" "}
                  Skills Analysis
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold text-green-600 uppercase mb-2">
                      Matched Skills
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.skillsGap.matchingSkills.map((s, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-md border border-green-100"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-red-500 uppercase mb-2">
                      Missing / Keywords to Add
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.skillsGap.missingSkills.map((s, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-red-50 text-red-600 text-xs rounded-md border border-red-100"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Improvements */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <i className="fa-solid fa-pen-nib text-amber-500"></i> Resume
                  Improvements
                </h3>
                <ul className="space-y-3">
                  {analysisResult.improvementSuggestions.map((s, i) => (
                    <li key={i} className="flex gap-3 text-sm text-slate-600">
                      <i className="fa-solid fa-angle-right text-amber-500 mt-1"></i>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Interview Prep */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 mb-8">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <i className="fa-solid fa-comments text-indigo-500"></i> Likely
                Interview Topics
              </h3>
              <div className="flex flex-wrap gap-3">
                {analysisResult.interviewFocusAreas.map((topic, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 font-medium shadow-sm"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>

            {/* CTAs */}
            <div className="mt-auto flex flex-col sm:flex-row gap-4 justify-center pt-6 border-t border-slate-100">
              <button
                onClick={startMockInterview}
                className="px-8 py-3 bg-indigo-600 text-white rounded-full font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-microphone-lines"></i> Practice
                Interview for this Role
              </button>
              <button
                onClick={() => setCurrentStep("upload")}
                className="px-8 py-3 bg-white text-slate-700 border border-slate-200 rounded-full font-bold hover:bg-slate-50 transition-all"
              >
                Analyze Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
