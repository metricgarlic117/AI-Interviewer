"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/services/firebase";
import {
  createLiveClient,
  generateInterviewFeedback,
  generateInterviewerPersona,
} from "@/services/gemini";
import { AssemblyAISession } from "@/services/assemblyai";
import {
  processInterviewFeedback,
  getResume,
  getJobDescription,
  saveMessage,
  getSessionMessages,
} from "@/services/userData";
import { InterviewMode, ErrorCode, ErrorSeverity } from "@/types";
import { Modality } from "@google/genai";
import { useError } from "@/contexts/ErrorContext";

// Removed props interface - using params directly from Next.js

// --- Audio Helper Functions ---
function encode(bytes) {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function downsampleBuffer(buffer, inputRate, outputRate = 16000) {
  if (outputRate === inputRate) return buffer;
  const sampleRateRatio = inputRate / outputRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0,
      count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

async function decodeAudioData(data, ctx, sampleRate, numChannels) {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data) {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    int16[i] = s < 0 ? s * 32768 : s * 32767;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: "audio/pcm;rate=16000",
  };
}

export default function SessionPage({ params }) {
  const resolvedParams = React.use(params);
  const sessionId = resolvedParams.id;
  const router = useRouter();
  const { showError } = useError();
  const id = sessionId;

  // State
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [realtimeTranscript, setRealtimeTranscript] = useState(null);
  const [isMicOn, setIsMicOn] = useState(false);
  const [visualizerLevel, setVisualizerLevel] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isPushToTalkActive, setIsPushToTalkActive] = useState(false);

  // Audio & Session Refs
  const nextStartTimeRef = useRef(0);
  const inputAudioContextRef = useRef(null);
  const outputAudioContextRef = useRef(null);
  const sourcesRef = useRef(new Set());
  const sessionPromiseRef = useRef(null);
  const currentInputTranscriptionRef = useRef("");
  const currentOutputTranscriptionRef = useRef("");
  const sessionDataRef = useRef(null);
  const messagesRef = useRef([]);
  const scriptProcessorRef = useRef(null);
  const lastSpeechTimeRef = useRef(Date.now());
  const silenceTimerRef = useRef(null);
  const personaGeneratedRef = useRef(false);
  const shouldBeConnectedRef = useRef(false);
  const retryCountRef = useRef(0);
  const mediaStreamRef = useRef(null);
  const messagesEndRef = useRef(null);
  const isSpacebarHeldRef = useRef(false);

  // AssemblyAI fallback transcription refs
  const assemblyAISessionRef = useRef(null);
  const assemblyAITranscriptRef = useRef(""); // accumulates fallback text per turn
  const geminiGotInputTranscriptRef = useRef(false); // tracks if Gemini delivered input transcript this turn

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, realtimeTranscript]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Silence Monitor (Defensive)
  useEffect(() => {
    if (connected) {
      lastSpeechTimeRef.current = Date.now();
      silenceTimerRef.current = setInterval(() => {
        const timeSinceSpeech = Date.now() - lastSpeechTimeRef.current;
        if (timeSinceSpeech > 180000) {
          // 3 mins silence
          if (sessionPromiseRef.current) {
            sessionPromiseRef.current
              .then((session) => {
                session
                  .sendRealtimeInput({
                    clientContent: {
                      turns: [
                        {
                          role: "user",
                          parts: [
                            {
                              text: "I haven't said anything for 3 minutes. Please prompt me.",
                            },
                          ],
                        },
                      ],
                      turnComplete: true,
                    },
                  })
                  .catch((e) => console.error("Failed to send nudge:", e));
              })
              .catch(() => {});
            lastSpeechTimeRef.current = Date.now();
          }
        }
      }, 5000); // Check every 5s
    }
    return () => {
      if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
    };
  }, [connected]);

  // Push-to-Talk Keyboard Listeners
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.code === "Space" &&
        !e.repeat &&
        connected &&
        !isSpacebarHeldRef.current
      ) {
        e.preventDefault();
        isSpacebarHeldRef.current = true;
        setIsPushToTalkActive(true);
        setIsRecording(true);
        // Reset fallback state at the start of each PTT press
        assemblyAITranscriptRef.current = "";
        geminiGotInputTranscriptRef.current = false;
        console.log("[PTT] Started recording");
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === "Space" && isSpacebarHeldRef.current) {
        e.preventDefault();
        isSpacebarHeldRef.current = false;
        setIsPushToTalkActive(false);
        setIsRecording(false);
        console.log("[PTT] Stopped recording");

        // FORCE IMMEDIATE RESPONSE
        // We send a client content message with "turnComplete: true"
        // This tells Gemini "I am done talking, answer me now"
        if (sessionPromiseRef.current) {
          sessionPromiseRef.current
            .then((session) => {
              session
                .sendRealtimeInput({
                  clientContent: {
                    turns: [], // No new text, just signal completion
                    turnComplete: true,
                  },
                })
                .catch((e) =>
                  console.error("Failed to force turn completion:", e),
                );
            })
            .catch(() => {});
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [connected, id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectSession(true);
    };
  }, []);

  // --- Core Session Logic ---

  const initSession = async () => {
    if (!id) return;
    const user = auth.currentUser;
    if (!user) {
      router.push("/login");
      return;
    }

    try {
      const docRef = doc(db, `users/${user.uid}/interviews`, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };

        // Resolve Resume/JD References if text is missing
        if (data.config.resumeId && !data.config.resumeText) {
          try {
            const r = await getResume(user.uid, data.config.resumeId);
            if (r) data.config.resumeText = r.text;
          } catch (e) {
            console.error("Failed to load resume content", e);
          }
        }

        if (data.config.jdId && !data.config.jobDescription) {
          try {
            const jd = await getJobDescription(user.uid, data.config.jdId);
            if (jd) data.config.jobDescription = jd;
          } catch (e) {
            console.error("Failed to load JD content", e);
          }
        }

        // Generate Persona (Safe Call)
        if (
          data.config.jobDescription &&
          !data.interviewerPersona &&
          !personaGeneratedRef.current
        ) {
          personaGeneratedRef.current = true;
          setLoading(true);
          try {
            const persona = await generateInterviewerPersona(data.config);
            data.interviewerPersona = persona;
            await updateDoc(docRef, { interviewerPersona: persona });
          } catch (e) {
            console.error("Failed to generate persona (non-fatal)", e);
            // Continue without custom persona
          }
        }

        setSession(data);
        sessionDataRef.current = data;

        if (data.status === "completed") {
          router.push(`/result/${id}`);
          return;
        }

        // Load Messages (Subcollection + Legacy)
        const subCollMessages = await getSessionMessages(user.uid, id);
        const legacyMessages = data.messages || [];
        // Deduplicate based on timestamp if necessary, or just prefer subcollection if populated
        const allMessages = [...legacyMessages, ...subCollMessages].sort(
          (a, b) => a.timestamp - b.timestamp,
        );
        setMessages(allMessages);
      } else {
        showError({
          code: ErrorCode.SESSION_STALE,
          message: "Session not found.",
          severity: ErrorSeverity.ERROR,
        });
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Error initializing session:", error);
      showError({
        code: ErrorCode.UNKNOWN_ERROR,
        message: "Failed to load session details.",
        severity: ErrorSeverity.FATAL,
        retryAction: initSession,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initSession();
  }, [id]);

  const disconnectSession = (fullCleanup = false) => {
    if (fullCleanup) shouldBeConnectedRef.current = false;

    // Defensive Audio Cleanup
    try {
      if (
        inputAudioContextRef.current &&
        inputAudioContextRef.current.state !== "closed"
      ) {
        inputAudioContextRef.current
          .close()
          .catch((e) => console.warn("Input AC close fail", e));
      }
      inputAudioContextRef.current = null;
    } catch (e) {}

    try {
      if (
        outputAudioContextRef.current &&
        outputAudioContextRef.current.state !== "closed"
      ) {
        outputAudioContextRef.current
          .close()
          .catch((e) => console.warn("Output AC close fail", e));
      }
      outputAudioContextRef.current = null;
    } catch (e) {}

    sourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch (e) {}
    });
    sourcesRef.current.clear();

    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.disconnect();
      } catch (e) {}
      scriptProcessorRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      mediaStreamRef.current = null;
    }

    // Disconnect AssemblyAI fallback session
    if (assemblyAISessionRef.current) {
      try {
        assemblyAISessionRef.current.disconnect();
      } catch (e) {}
      assemblyAISessionRef.current = null;
    }
    assemblyAITranscriptRef.current = "";
    geminiGotInputTranscriptRef.current = false;

    if (fullCleanup) {
      setConnected(false);
      setIsMicOn(false);
      setIsReconnecting(false);
      setRealtimeTranscript(null);
    }

    if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
  };

  const connectToGemini = async () => {
    if (!sessionDataRef.current) return;
    shouldBeConnectedRef.current = true;
    const config = sessionDataRef.current.config;
    const persona = sessionDataRef.current.interviewerPersona;

    // Construct Prompts (Same as before)
    let interviewModeInstruction = "";
    if (config.mode === InterviewMode.Coach) {
      interviewModeInstruction = `MODE: Friendly Coach. If user struggles, offer small hints. Validate thinking. Tone: Warm.`;
    } else if (config.mode === InterviewMode.Stress) {
      interviewModeInstruction = `MODE: Stress Mode. Challenge assumptions. Ask tough follow-ups. Tone: Direct, skeptical.`;
    } else {
      interviewModeInstruction = `MODE: Realistic Interviewer. No hints. Evaluate critically. Tone: Professional.`;
    }

    let resumeContext = "";
    if (config.resumeText && config.resumeText.length > 50) {
      resumeContext = `CANDIDATE RESUME: """${config.resumeText.substring(0, 8000)}"""\nPROTOCOL: Reference specific projects. Adapt complexity to experience.`;
    }

    let jobContext = "";
    if (config.jobDescription && config.jobDescription.length > 50) {
      jobContext = `JOB DESCRIPTION: """${config.jobDescription.substring(0, 5000)}"""\nINSTRUCTION: Match difficulty to this JD.`;
    }

    // Use custom persona string if available, otherwise build default system instruction
    // Use the Adaptive Agent persona generated by the service
    // We fallback to a simple prompt only if something failed (unlikely)
    const systemInstruction =
      persona ||
      `
        IDENTITY: Interviewer for ${config.role}.
        MODE: ${config.mode}.
        RULES: Ask ${config.questionCount} questions. Adapt to answers.
        END: Say "Thank you for your time. That concludes our interview."
      `;

    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;
      const inputCtx = new AudioContextClass({ latencyHint: "interactive" });
      const outputCtx = new AudioContextClass({ latencyHint: "interactive" });

      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;

      // Auto-Resume Audio Contexts (Browser Security)
      const resumeAudio = async () => {
        if (inputCtx.state === "suspended") await inputCtx.resume();
        if (outputCtx.state === "suspended") await outputCtx.resume();
      };
      await resumeAudio();

      // --- BROWSER API CHECKS ---
      console.log("Checking Media API:", {
        secure: window.isSecureContext,
        hostname: window.location.hostname,
        mediaDevices: !!navigator.mediaDevices,
        getUserMedia: !!navigator.mediaDevices?.getUserMedia,
      });

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const isSecure = window.isSecureContext;
        const msg = isSecure
          ? "Audio API unavailable. Check browser privacy settings (shields)."
          : `Microphone blocked. You are on an insecure connection (${window.location.hostname}). Please use 'http://localhost:3000' in the address bar.`;

        showError({
          code: ErrorCode.MIC_DEVICE_NOT_FOUND,
          message: msg,
          severity: ErrorSeverity.FATAL,
        });
        setConnected(false);
        shouldBeConnectedRef.current = false;
        return;
      }

      // --- HARDENED MIC ACCESS ---
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            autoGainControl: true,
            noiseSuppression: true,
          },
        });
      } catch (err) {
        console.error("Mic Access Error:", err);
        let code = ErrorCode.MIC_PERMISSION_DENIED;
        let msg =
          "Microphone access denied. Please check your browser settings.";

        if (
          err.name === "NotFoundError" ||
          err.name === "DevicesNotFoundError"
        ) {
          code = ErrorCode.MIC_DEVICE_NOT_FOUND;
          msg = "No microphone found. Please connect a device.";
        }

        showError({ code, message: msg, severity: ErrorSeverity.FATAL });
        setConnected(false);
        shouldBeConnectedRef.current = false;
        return;
      }

      mediaStreamRef.current = stream;
      setIsMicOn(true);

      // --- GEMINI CONNECTION ---
      // The live client authenticates with a single-use ephemeral token
      // minted server-side, so the permanent API key never reaches the browser.
      sessionPromiseRef.current = createLiveClient().then((liveClient) =>
        liveClient.live.connect({
          model: "gemini-2.5-flash-native-audio-preview-09-2025",
          config: {
            systemInstruction: systemInstruction,
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
            },
            inputAudioTranscription: {}, // Re-enabled for push-to-talk
            outputAudioTranscription: {},
          },
          callbacks: {
            onopen: async () => {
              setConnected(true);
              setIsReconnecting(false);
              retryCountRef.current = 0;

              if (!inputAudioContextRef.current) return;

              try {
                // Defensive: Ensure AudioContext is running
                if (inputAudioContextRef.current.state === "suspended") {
                  try {
                    await inputAudioContextRef.current.resume();
                  } catch (e) {
                    console.warn(
                      "Failed to resume input AudioContext in onopen:",
                      e,
                    );
                  }
                }

                if (inputAudioContextRef.current.state === "closed") {
                  throw new Error("Input AudioContext is closed");
                }

                // Defensive: Check stream tracks
                if (!stream.active && stream.getAudioTracks().length === 0) {
                  throw new Error(
                    "MediaStream is inactive or has no audio tracks",
                  );
                }

                const source =
                  inputAudioContextRef.current.createMediaStreamSource(stream);
                // OPTIMIZATION: Increased buffer size from 1024 to 4096 to reduce main thread load (lag)
                const processor =
                  inputAudioContextRef.current.createScriptProcessor(
                    4096,
                    1,
                    1,
                  );
                scriptProcessorRef.current = processor;

                processor.onaudioprocess = (e) => {
                  // Guard against zombie processes
                  if (!shouldBeConnectedRef.current) return;

                  const inputData = e.inputBuffer.getChannelData(0);
                  const currentSampleRate =
                    inputAudioContextRef.current?.sampleRate || 16000;
                  const downsampledData = downsampleBuffer(
                    inputData,
                    currentSampleRate,
                    16000,
                  );

                  // VAD for visualizer
                  let sum = 0;
                  for (let i = 0; i < downsampledData.length; i++) {
                    sum += downsampledData[i] * downsampledData[i];
                  }
                  const rms = Math.sqrt(sum / downsampledData.length);
                  setVisualizerLevel(Math.min(1, rms * 5));

                  if (rms > 0.02) {
                    lastSpeechTimeRef.current = Date.now();
                  }

                  // PUSH-TO-TALK: Only send audio to Gemini when spacebar is held
                  if (isSpacebarHeldRef.current) {
                    const pcmBlob = createBlob(downsampledData);
                    if (sessionPromiseRef.current) {
                      sessionPromiseRef.current
                        .then((session) => {
                          session
                            .sendRealtimeInput({ media: pcmBlob })
                            .catch((e) => console.warn("Send audio fail", e));
                        })
                        .catch(() => {});
                    }
                    // Also stream to AssemblyAI fallback if connected
                    if (assemblyAISessionRef.current?.isActive()) {
                      assemblyAISessionRef.current.sendAudio(downsampledData);
                    }
                  }
                };

                source.connect(processor);
                processor.connect(inputAudioContextRef.current.destination);
              } catch (err) {
                console.error("Audio Context Initialization Failed:", err);
                showError({
                  code: ErrorCode.AUDIO_CONTEXT_FAILED,
                  message: `Audio processing failed: ${err.message || "Unknown error"}`,
                  severity: ErrorSeverity.ERROR,
                  originalError: err,
                });
              }

              // Start AssemblyAI as secondary fallback transcription (non-fatal)
              try {
                const asmSession = new AssemblyAISession({
                  onTranscript: (result) => {
                    if (result.isFinal && result.text) {
                      assemblyAITranscriptRef.current += result.text + " ";
                    }
                  },
                  onError: (err) =>
                    console.warn("[AssemblyAI Fallback] Error:", err),
                  onClose: () => console.log("[AssemblyAI Fallback] Closed"),
                  sampleRate: 16000,
                });
                await asmSession.connect();
                assemblyAISessionRef.current = asmSession;
                console.log(
                  "[AssemblyAI Fallback] Connected and ready as secondary transcription provider",
                );
              } catch (e) {
                console.warn(
                  "[AssemblyAI Fallback] Failed to connect (non-fatal — Gemini will handle transcription):",
                  e,
                );
              }
            },
            onmessage: async (message) => {
              const outputCtx = outputAudioContextRef.current;
              if (!outputCtx) return;

              // Handle Audio Output
              const base64Audio =
                message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              if (base64Audio) {
                try {
                  if (outputCtx.state === "suspended") await outputCtx.resume();

                  // SCHEDULING FIX: Add lookahead to prevent "stuttering" start
                  const nextTime = Math.max(
                    outputCtx.currentTime + 0.02,
                    nextStartTimeRef.current,
                  );
                  nextStartTimeRef.current = nextTime;

                  const audioBuffer = await decodeAudioData(
                    decode(base64Audio),
                    outputCtx,
                    24000,
                    1,
                  );

                  const source = outputCtx.createBufferSource();
                  source.buffer = audioBuffer;
                  source.connect(outputCtx.destination);
                  source.onended = () => {
                    sourcesRef.current.delete(source);
                  };
                  source.start(nextStartTimeRef.current);
                  nextStartTimeRef.current += audioBuffer.duration;
                  sourcesRef.current.add(source);
                } catch (e) {
                  console.warn("Audio decode fail", e);
                }
              }

              // Handle AI Output Transcription (from Gemini)
              if (message.serverContent?.outputTranscription) {
                let text = message.serverContent.outputTranscription.text;
                if (text) {
                  text = text.replace(/[^\x00-\x7F]/g, "");
                  if (text) {
                    currentOutputTranscriptionRef.current += text;
                    setRealtimeTranscript({
                      role: "model",
                      text: currentOutputTranscriptionRef.current,
                    });
                  }
                }
              }

              // Handle User Input Transcription (from Gemini - only when spacebar held)
              if (message.serverContent?.inputTranscription) {
                let text = message.serverContent.inputTranscription.text;
                if (text) {
                  text = text.replace(/[^\x00-\x7F]/g, "");
                  if (text) {
                    geminiGotInputTranscriptRef.current = true; // Gemini provided a transcript
                    currentInputTranscriptionRef.current += text;
                    setRealtimeTranscript({
                      role: "user",
                      text: currentInputTranscriptionRef.current,
                    });
                    lastSpeechTimeRef.current = Date.now();
                  }
                }
              }

              // Handle Turn Completion
              if (message.serverContent?.turnComplete) {
                const geminiUserText =
                  currentInputTranscriptionRef.current.trim();
                const asmUserText = assemblyAITranscriptRef.current.trim();
                // Use Gemini transcript as primary; fall back to AssemblyAI if Gemini was silent
                const userText =
                  geminiUserText ||
                  (!geminiGotInputTranscriptRef.current && asmUserText
                    ? asmUserText
                    : "");
                if (!geminiUserText && asmUserText)
                  console.log(
                    "[AssemblyAI Fallback] Using fallback transcript:",
                    asmUserText,
                  );
                const modelText = currentOutputTranscriptionRef.current.trim();
                if (userText || modelText) {
                  const newMsgs = [];
                  if (userText)
                    newMsgs.push({
                      role: "user",
                      text: userText,
                      timestamp: Date.now(),
                    });
                  if (modelText)
                    newMsgs.push({
                      role: "model",
                      text: modelText,
                      timestamp: Date.now(),
                    });

                  setMessages((prev) => {
                    const updated = [...prev, ...newMsgs];
                    if (id && auth.currentUser) {
                      // Background Save (Subcollection)
                      newMsgs.forEach((msg) =>
                        saveMessage(auth.currentUser.uid, id, msg),
                      );
                    }
                    return updated;
                  });

                  // Check for End Condition
                  const lowerText = modelText.toLowerCase();
                  if (
                    lowerText.includes("that concludes our interview") ||
                    lowerText.includes("that concludes the interview")
                  ) {
                    setTimeout(() => finishInterviewRef.current(), 3000);
                  }

                  currentInputTranscriptionRef.current = "";
                  currentOutputTranscriptionRef.current = "";
                  setRealtimeTranscript(null);
                }
              }
            },
            onclose: (e) => {
              console.log("Gemini Connection Closed", e);
              if (shouldBeConnectedRef.current) {
                handleConnectionLoss();
              } else {
                setConnected(false);
                setIsMicOn(false);
              }
            },
            onerror: (e) => {
              console.error("Gemini Session Error", e);
              // Often 'onerror' is followed by 'onclose', so we let onclose handle the retry logic
              // but we show a toaster
              showError({
                code: ErrorCode.GEMINI_API_ERROR,
                message: "Connection interruption detected.",
                severity: ErrorSeverity.WARNING,
              });
            },
          },
        }),
      );
    } catch (err) {
      console.error("Failed to start voice session:", err);
      showError({
        code: ErrorCode.UNKNOWN_ERROR,
        message: "Failed to initialize voice session.",
        severity: ErrorSeverity.ERROR,
        retryAction: () => startVoiceSession(),
      });
      setConnected(false);
    }
  };

  const handleConnectionLoss = () => {
    if (!shouldBeConnectedRef.current) return;

    if (retryCountRef.current < 3) {
      retryCountRef.current += 1;
      setIsReconnecting(true);
      showError({
        code: ErrorCode.GEMINI_CONNECTION_CLOSED,
        message: `Connection lost. Reconnecting (${retryCountRef.current}/3)...`,
        severity: ErrorSeverity.INFO,
      });

      disconnectSession(false);
      // Exponential Backoff
      setTimeout(() => {
        connectToGemini();
      }, 1000 * retryCountRef.current);
    } else {
      disconnectSession(true);
      showError({
        code: ErrorCode.NETWORK_OFFLINE,
        message: "Connection failed after multiple attempts.",
        severity: ErrorSeverity.ERROR,
        retryAction: () => startVoiceSession(),
      });
    }
  };

  const startVoiceSession = () => {
    retryCountRef.current = 0;
    disconnectSession(false);
    connectToGemini();
  };

  // Memoized finish handler for use inside effects/callbacks
  const finishInterview = useCallback(async () => {
    disconnectSession(true);
    if (!sessionDataRef.current || !id) return;
    const user = auth.currentUser;
    if (!user) return;

    setAnalyzing(true);

    try {
      // Use messages from ref to ensure we have latest state even if React state lags
      const msgsToAnalyze = messagesRef.current;

      if (msgsToAnalyze.length === 0) {
        showError({
          code: ErrorCode.UNKNOWN_ERROR,
          message: "No conversation recorded. Cannot generate feedback.",
          severity: ErrorSeverity.WARNING,
        });
        router.push("/dashboard");
        return;
      }

      const feedback = await generateInterviewFeedback(
        msgsToAnalyze,
        sessionDataRef.current.config,
        sessionDataRef.current.config.resumeText,
        sessionDataRef.current.config.jobDescription,
      );

      const docRef = doc(db, `users/${user.uid}/interviews`, id);
      await updateDoc(docRef, {
        status: "completed",
        feedback: feedback,
        // messages: msgsToAnalyze // No longer storing full transcript in doc
      });

      await processInterviewFeedback(
        user.uid,
        id,
        feedback,
        sessionDataRef.current.config.role,
      );
      router.push(`/result/${id}`);
    } catch (error) {
      console.error(error);
      showError({
        code: ErrorCode.GEMINI_API_ERROR,
        message: "Feedback analysis failed, but your transcript is saved.",
        severity: ErrorSeverity.ERROR,
      });
      router.push("/dashboard");
    } finally {
      setAnalyzing(false);
    }
  }, [id, showError]);

  const finishInterviewRef = useRef(finishInterview);
  useEffect(() => {
    finishInterviewRef.current = finishInterview;
  });

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-slate-400">
        <i className="fa-solid fa-circle-notch fa-spin text-2xl mb-2 text-indigo-500"></i>
        <p>Initializing Session...</p>
      </div>
    );
  }

  if (analyzing) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-md">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-indigo-100 rounded-full"></div>
          <div className="absolute top-0 left-0 w-20 h-20 border-4 border-t-indigo-600 rounded-full animate-spin"></div>
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mt-6">
          Analyzing Performance
        </h2>
        <p className="text-slate-500 mt-2">
          Generating detailed feedback report...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-5xl mx-auto px-4 py-6">
      {/* Session Header */}
      <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 shadow-sm">
            <i className="fa-solid fa-headphones"></i>
          </div>
          <div>
            {/* Persona is now stored as system prompt internally, not displayed */}
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              AI Interviewer
              <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                Interviewer
              </span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              {session?.config.role} Position
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Status Indicators */}
          <div
            className={`hidden sm:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${
              session?.config.mode === InterviewMode.Coach
                ? "bg-green-50 text-green-700 border-green-200"
                : session?.config.mode === InterviewMode.Stress
                  ? "bg-red-50 text-red-700 border-red-200"
                  : "bg-slate-100 text-slate-700 border-slate-200"
            }`}
          >
            {session?.config.mode || "Realistic"}
          </div>

          {connected ? (
            <div className="flex items-center gap-2 px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-bold border border-red-100 animate-pulse">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              LIVE
            </div>
          ) : isReconnecting ? (
            <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-bold border border-amber-100">
              <i className="fa-solid fa-circle-notch fa-spin"></i> Reconnecting
            </div>
          ) : null}

          <button
            onClick={finishInterview}
            className="px-4 py-2 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg text-sm font-bold transition-colors"
          >
            End Call
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Main Visualizer Area */}
        <div className="flex-1 bg-gradient-to-br from-slate-900 to-indigo-950 rounded-3xl shadow-2xl relative overflow-hidden flex flex-col items-center justify-center p-8">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>

          {connected || isReconnecting ? (
            <div className="relative z-10 flex flex-col items-center">
              {/* The Orb */}
              <div className="relative w-40 h-40 mb-10">
                <div
                  className={`absolute inset-0 bg-indigo-500 rounded-full blur-3xl opacity-30 ${connected ? "animate-pulse-slow" : ""}`}
                ></div>
                <div className="relative w-full h-full bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full shadow-[0_0_60px_rgba(99,102,241,0.6)] flex items-center justify-center">
                  <div className="w-36 h-36 bg-slate-900 rounded-full flex items-center justify-center border border-white/10 relative overflow-hidden">
                    {isReconnecting ? (
                      <i className="fa-solid fa-signal text-white/50 animate-pulse text-3xl"></i>
                    ) : (
                      <div className="flex items-center gap-1 h-12">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className="w-1.5 bg-indigo-400 rounded-full transition-all duration-75"
                            style={{
                              height: `${20 + Math.random() * (visualizerLevel * 80)}%`,
                            }}
                          ></div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Live Transcript Overlay */}
              <div className="max-w-xl text-center min-h-[80px]">
                {realtimeTranscript ? (
                  <p className="text-lg font-medium text-white/90 animate-fade-in leading-relaxed">
                    <span className="opacity-50 text-sm uppercase block mb-2 tracking-widest">
                      {realtimeTranscript.role === "user"
                        ? "You"
                        : "AI Interviewer"}
                    </span>
                    "{realtimeTranscript.text}"
                  </p>
                ) : (
                  <p className="text-white/30 text-sm font-mono">
                    {isReconnecting
                      ? "Reestablishing connection..."
                      : "Listening..."}
                  </p>
                )}
              </div>

              {/* Push-to-Talk Indicator */}
              <div className="mt-8">
                {isPushToTalkActive ? (
                  <div className="flex items-center gap-3 px-6 py-3 bg-red-500/20 border-2 border-red-500/50 rounded-full backdrop-blur-sm animate-pulse">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
                    <span className="text-white font-bold text-sm">
                      🎤 Recording...
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-6 py-3 bg-white/10 border-2 border-white/20 rounded-full backdrop-blur-sm">
                    <kbd className="px-2 py-1 bg-white/20 rounded text-xs font-mono font-bold text-white">
                      SPACE
                    </kbd>
                    <span className="text-white/70 font-medium text-sm">
                      Hold to speak
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center z-10">
              <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-sm border border-white/10">
                <i className="fa-solid fa-microphone-lines text-4xl text-white/50"></i>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Ready to Start?
              </h3>
              <p className="text-indigo-200 mb-8 max-w-sm mx-auto">
                Click below to connect to the AI interviewer. Please ensure you
                are in a quiet environment.
              </p>
              <button
                onClick={startVoiceSession}
                className="px-8 py-4 bg-white text-indigo-900 rounded-full font-bold text-lg shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:scale-105 transition-transform"
              >
                Start Session
              </button>
            </div>
          )}
        </div>

        {/* Side Chat Transcript */}
        <div className="hidden lg:flex w-96 bg-white rounded-3xl border border-slate-200 flex-col shadow-lg overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">
              Transcript
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300">
                <i className="fa-regular fa-comments text-3xl mb-2"></i>
                <p className="text-xs">Conversation will appear here</p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[90%] p-3 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white rounded-tr-sm"
                        : "bg-slate-100 text-slate-800 rounded-tl-sm"
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 px-1">
                    {msg.role === "user" ? "You" : "AI"}
                  </span>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
