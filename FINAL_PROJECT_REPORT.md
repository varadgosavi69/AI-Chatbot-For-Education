# Final Project Report

## Features completed
- Implemented a true PDF RAG pipeline with chunking, embedding generation, vector-style retrieval, and grounded answer selection.
- Added fallback messaging so unsupported or missing PDF answers return: "Information not found in the uploaded PDF."
- Expanded the student dashboard with study streak, subject insights, weekly activity, total questions, time spent, recent sessions, and progress visuals.
- Improved the notes experience with richer PDF preview loading, markdown export, PDF export, and better empty/error states.
- Polished the overall interface with micro-interactions, mobile spacing improvements, accessibility focus states, and toast feedback.
- Added regression tests for the new retrieval module and verified both client and server builds.

## Remaining limitations
- The retrieval layer uses a lightweight in-memory embedding heuristic rather than a production vector database or external embedding API.
- PDF exports are browser-print based and may vary slightly by system/browser print settings.
- The dashboard metrics are session-based and reset with a fresh browser session unless persisted later.

## Files changed
- client/src/App.tsx
- client/src/index.css
- server/src/index.ts
- server/src/rag.ts
- server/tests/rag.test.ts
- server/package.json

## Architecture updates
- The PDF notes flow now performs chunking and retrieval before calling Gemini, making answers grounded in retrieved context instead of the entire raw document.
- The frontend now provides richer feedback states and exported notes workflows while the backend remains responsible for the retrieval and answer generation path.

## Testing summary
- Server regression tests: passed (2/2)
- Server build: passed
- Client build: passed
