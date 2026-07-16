# QuickDoubt

QuickDoubt is a student-facing AI study assistant that combines a doubt-clearing chat tutor with a PDF notes explainer. It helps learners ask subject-specific questions and turn uploaded lecture notes into simplified explanations plus four auto-generated visuals.

---

## Features

- Subject chat tutor for topic-specific questions
- Per-subject chat history persisted across browser sessions
- PDF → explanation flow for uploaded notes
- Auto mind map, flowchart, summary table, and pie chart generation
- Friendly error handling and retry support

---

## Tech Stack

- Frontend: React, TypeScript, Vite
- Backend: Node.js, Express, TypeScript
- AI: Anthropic Claude (`claude-sonnet-4-5`)
- PDF parsing: `pdf-parse`
- Charts: Recharts
- Markdown rendering: `react-markdown`

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/varadgosavi69/AI-Chatbot-For-Education.git
cd AI-Chatbot-For-Education
```

### 2. Install dependencies

```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

### 3. Configure environment variables

```bash
cd server
cp .env.example .env
```

Then edit `server/.env` and set your Anthropic API key.

> In production, set `VITE_API_BASE_URL` on the frontend host (Vercel) and `FRONTEND_URL` on the backend host (Render). The frontend should point to the deployed Render backend URL, and the backend should allow the deployed Vercel URL.

### 4. Run the backend

```bash
cd server
npm run dev
```

### 5. Run the frontend

```bash
cd client
npm run dev
```

Open `http://localhost:5173` after both servers are running.

---

## Project Structure

```
AI-Chatbot-For-Education/
├── client/                  # React frontend
│   ├── src/
│   ├── public/
│   └── vite.config.ts
├── server/                  # Express backend
│   ├── src/
│   ├── .env.example
│   └── tsconfig.json
└── README.md
```
