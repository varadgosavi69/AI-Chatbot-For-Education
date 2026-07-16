# QuickDoubt - AI Educational Chatbot (Hackathon MVP)

### Description
QuickDoubt is an instant-response educational AI chatbot designed to help students get clear, step-by-step explanations for their questions across subjects like Mathematics, Physics, Chemistry, Computer Science, and Biology. Built as a solo-hackathon MVP, it acts as a patient, expert tutor, generating tailored examples and breakdown steps at a student's level using the Claude API. With subject-specific chat histories saved locally in the browser, an inline retry mechanism for error resilience, a 30-second request timeout, and a modern, responsive layout, QuickDoubt ensures that students have a seamless, distraction-free companion to clear up learning doubts instantly.

### Tech Stack
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **LLM API**: Anthropic Claude API (model: `claude-sonnet-4-5-20250514`)
- **Persistence**: `localStorage` (per-subject chat history)

### Getting Started
Ensure you have [Node.js](https://nodejs.org/) installed.

#### 1. Setup Backend Server
Navigate to the `server/` directory:
```bash
cd server
npm install
```
Create a `.env` file in the `server` directory and add your Anthropic API Key:
```env
PORT=3001
ANTHROPIC_API_KEY=your_actual_anthropic_api_key_here
```
Start the backend server in development mode:
```bash
npm run dev
```
The server will run on `http://localhost:3001`.

#### 2. Setup Frontend Client
Navigate to the `client/` directory:
```bash
cd ../client
npm install
```
Start the frontend development server:
```bash
npm run dev
```
The frontend will run on `http://localhost:5173`. Open this URL in your browser to interact with the app.
