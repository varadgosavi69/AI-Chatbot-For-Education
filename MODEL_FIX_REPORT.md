# Model Fix Report

## Final model

`gemini-3.5-flash`

## Files changed

- `server/src/index.ts` - replaced the deprecated Gemini Flash model string with a shared `GEMINI_MODEL_NAME` constant set to `gemini-3.5-flash`. All Gemini-backed API routes use the same `geminiModel` instance.
- `README.md` - updated the documented AI model to `gemini-3.5-flash`.
- `ARCHITECTURE.md` - updated the architecture diagram model reference to `gemini-3.5-flash`.
- `MODEL_FIX_REPORT.md` - added this report.

## Search terms checked

- Deprecated Gemini Flash model names
- `gemini-3.5-flash`
- `getGenerativeModel`
