# AlgoMock — AI-Powered Interview Simulator

AlgoMock is a **Next.js** web application that simulates real-world technical interviews using Google Gemini's multimodal AI. Candidates practise in a voice-first environment, receive per-question scoring, and get a detailed hiring-decision report at the end of every session.

---

## 🌐 Live Demo

**[https://interviewer-gamma-one.vercel.app/](https://interviewer-gamma-one.vercel.app/)**

---

## ✨ Features

| Feature | Description |
|---|---|
| 🎙️ **Voice-First Interview** | Speak naturally during a live session; Gemini handles real-time speech and responds as an interviewer |
| 🤖 **Adaptive AI Interviewer** | Three modes — Friendly Coach, Realistic Interview, and Stress Mode — each with a distinct questioning style |
| 📄 **Resume Analyzer** | Upload your CV (PDF/image) and get a match score, skills-gap analysis, and interview focus areas |
| 📝 **Job Description Matching** | Paste a JD to tailor the interview and feedback to a specific role |
| 📊 **Detailed Feedback Report** | Scores across Technical Knowledge, Problem Solving, Communication, Behavioural, and CV Alignment |
| 🏆 **Hiring Decision** | Every session ends with a *Strong Hire / Hire / Borderline / No Hire* verdict and narrative rationale |
| 📁 **Session History** | All sessions and resumes are stored in Firestore and viewable from the dashboard |

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Language**: JavaScript (ES2022+, JSDoc-annotated)
- **AI / ML**: Google Gemini (`@google/genai`) — Live multimodal API for voice + text
- **Speech-to-Text Fallback**: [AssemblyAI](https://www.assemblyai.com/) — used in parallel with Gemini to guarantee transcription
- **Backend / Database**: [Firebase](https://firebase.google.com/) — Firestore for sessions/resumes, Firebase Auth for users, Firebase Admin for server-side token verification
- **PDF Processing**: `pdfjs-dist` — client-side PDF text extraction
- **Styling**: Tailwind CSS
- **Testing**: Jest + React Testing Library
- **Linting**: ESLint (`eslint-config-next`)

---

## 🔐 Security Model

Authentication is enforced **server-side**, not just in the UI:

- **Firebase Auth** (email/password + Google sign-in) manages user identity in the browser.
- **Every API route verifies a Firebase ID token** (`Authorization: Bearer <token>`) with the Firebase Admin SDK before doing any work. Client-side route guards are UX only — the API layer and Firestore rules are the real boundary.
- **No provider secrets ever reach the browser**:
  - Gemini Live sessions use single-use **ephemeral tokens** minted by `/api/gemini-live-token`.
  - AssemblyAI streaming uses short-lived realtime tokens minted by `/api/assemblyai-token`.
  - `GEMINI_API_KEY` and `ASSEMBLYAI_API_KEY` are server-only environment variables.
- **Per-user rate limiting** on all API routes (in-memory fixed window; see `lib/server/rate-limit.js` — swap in a shared store like Upstash Redis when running more than one instance).
- **Request validation and body-size caps** on every route.
- **Security headers** (HSTS, nosniff, frame denial, restricted permissions) set globally in `next.config.js`.
- **Firestore security rules** restrict each user's data to that user (`firestore.rules`).

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 20.9.0
- **npm** ≥ 10.0.0
- A **Firebase** project (Firestore + Authentication enabled)
- A **Google Gemini** API key
- An **AssemblyAI** API key

### 1. Clone the repository

```bash
git clone <repository-url>
cd AI-Interviewer
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Then fill in every value — see the comments in [`.env.example`](./.env.example) for where each one comes from. Highlights:

| Variable | Scope | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | server only | Gemini requests + ephemeral Live tokens |
| `ASSEMBLYAI_API_KEY` | server only | Minting temporary realtime transcription tokens |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | server only | Verifying user ID tokens on API routes (raw or base64 JSON). Optional on Google Cloud, where Application Default Credentials are used |
| `NEXT_PUBLIC_FIREBASE_*` | client | Firebase web app config (not secret) |

### 4. Run the development server

The dev server uses HTTPS (required by the browser Microphone API):

```bash
npm run dev
```

Open [https://localhost:3000](https://localhost:3000) in your browser.

> **Note:** On first run, your browser may warn about a self-signed certificate. Accept it to proceed.

---

## 📦 Production Deployment

1. Set every variable from `.env.example` in your hosting provider (e.g. Vercel → Project Settings → Environment Variables). For `FIREBASE_SERVICE_ACCOUNT_KEY`, base64-encode the service-account JSON: `base64 -w0 service-account.json`.
2. Deploy the Firestore rules: `firebase deploy --only firestore:rules`.
3. Add your production domain to **Firebase Auth → Authorized domains**.
4. Build and start:

```bash
npm run build
npm start
```

### Production checklist / known limitations

- The rate limiter is in-memory and therefore **per instance**. Multi-instance or serverless deployments should back `lib/server/rate-limit.js` with a shared store (Upstash Redis, Memorystore).
- No `Content-Security-Policy` header is set yet. Roll one out in report-only mode first — it must allow Firebase/Google identity endpoints, Gemini and AssemblyAI websockets, and the Font Awesome CDN.
- Consider Firebase App Check for an additional abuse-prevention layer on Firestore.

---

## 📁 Project Structure

```
.
├── app/
│   ├── (auth)/              # Login & Signup pages
│   ├── (protected)/
│   │   ├── dashboard/       # Session history overview
│   │   ├── profile/         # User profile & saved resumes
│   │   ├── resume-analyzer/ # CV upload & analysis
│   │   ├── result/[id]/     # Post-interview feedback report
│   │   ├── session/[id]/    # Live interview session (voice)
│   │   └── setup/           # Interview configuration wizard
│   └── api/                 # All routes require a Firebase ID token
│       ├── analyze-resume/    # Resume analysis
│       ├── assemblyai-token/  # Temporary AssemblyAI realtime token
│       ├── extract-text/      # Image text extraction
│       ├── gemini-live-token/ # Single-use ephemeral Gemini Live token
│       └── generate-feedback/ # Post-session feedback generation
├── lib/
│   └── server/              # Server-only: auth, rate limiting, API plumbing
│       ├── api-handler.js   # Auth + rate limit + validation wrapper
│       ├── auth.js          # Firebase ID token verification
│       ├── firebase-admin.js
│       ├── gemini-client.js
│       └── rate-limit.js
├── components/              # Shared React components
├── contexts/                # React context providers
├── services/                # Client-side service helpers
│   ├── apiClient.js         # authedFetch — attaches the user's ID token
│   ├── assemblyai.js        # AssemblyAI streaming client
│   ├── firebase.js          # Firebase initialisation (env-driven)
│   ├── gemini.js            # Gemini API helpers + Live client factory
│   └── userData.js          # Firestore CRUD helpers
├── __tests__/               # Jest unit & integration tests
├── types.js                 # Shared runtime constants + JSDoc typedefs
└── firestore.rules          # Firestore security rules
```

---

## 🧪 Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage report
npm run test:coverage
```

---

## 📜 Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server (HTTPS) |
| `npm run build` | Build production bundle |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run Jest test suite |
| `npm run test:coverage` | Run tests with coverage report |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 🙏 Acknowledgements

This project was developed with partial AI assistance from **[Claude](https://www.anthropic.com/claude)**.

---

## 📄 License

This project was developed as a capstone project. All rights reserved.
