# AlgoMock — AI-Powered Interview Simulator

AlgoMock is a **Next.js** web application that simulates real-world technical interviews using Google Gemini's multimodal AI. Candidates practise in a voice-first environment, receive per-question scoring, and get a detailed hiring-decision report at the end of every session.

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
- **Language**: TypeScript
- **AI / ML**: Google Gemini (`@google/genai`) — Live multimodal API for voice + text
- **Speech-to-Text Fallback**: [AssemblyAI](https://www.assemblyai.com/) — used in parallel with Gemini to guarantee transcription
- **Backend / Database**: [Firebase](https://firebase.google.com/) — Firestore for sessions/resumes, Firebase Auth for users
- **PDF Processing**: `pdfjs-dist` — client-side PDF text extraction
- **Styling**: Tailwind CSS
- **Testing**: Jest + React Testing Library

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
cd "final project by MTN"
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root:

```env
# Google Gemini
GEMINI_API_KEY=your_gemini_api_key

# AssemblyAI
ASSEMBLYAI_API_KEY=your_assemblyai_api_key

# Firebase (client-side)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 4. Run the development server

The dev server uses HTTPS (required by the browser Microphone API):

```bash
npm run dev
```

Open [https://localhost:3000](https://localhost:3000) in your browser.

> **Note:** On first run, your browser may warn about a self-signed certificate. Accept it to proceed.

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
│   └── api/
│       ├── analyze-resume/  # Resume analysis endpoint
│       ├── assemblyai-token/ # AssemblyAI temp token endpoint
│       ├── extract-text/    # PDF / image text extraction
│       └── generate-feedback/ # Post-session feedback generation
├── components/              # Shared React components
├── contexts/                # React context providers
├── services/
│   ├── assemblyai.ts        # AssemblyAI streaming client
│   ├── firebase.ts          # Firebase initialisation
│   ├── gemini.ts            # Gemini API helpers
│   └── userData.ts          # Firestore CRUD helpers
├── __tests__/               # Jest unit & integration tests
└── types.ts                 # Shared TypeScript types
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

## 🔐 Firestore Security Rules

Security rules are defined in [`firestore.rules`](./firestore.rules). Deploy them with the Firebase CLI:

```bash
firebase deploy --only firestore:rules
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

## 📄 License

This project was developed as a capstone project. All rights reserved.
