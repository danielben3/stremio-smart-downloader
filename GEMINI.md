# Workspace Guidelines & Quality Control Rules

## 1. Mandatory File Content & Quality Verification (No Silent Mocks)
- **Always Read & Validate Outputs:** Before reporting success or declaring a file ready (subtitles, videos, data, code), you MUST read and inspect the file's inner content using `view_file` or a dedicated validator script.
- **Never Rely on Mere Existence:** Verifying that a file exists on disk or that its name matches a pattern is strictly insufficient.
- **No Dummy / Mock Fallbacks as Final Deliverables:** If an upstream service or translation is unavailable, NEVER silently output a placeholder/dummy file (e.g. 2 lines of sample text). Explicitly inform the user of the exact state and suggest real alternatives (such as AI translation from source subtitles).
- **Quality Gates for Subtitles:** A valid movie subtitle must contain at least 100+ dialogue cues, span >70% of the movie runtime, and have a realistic file size (>15 KB).

## 2. Terminal Commands & Safety
- Always explain the purpose of any terminal or system command in Hebrew to the user before invoking `run_command`.

## 3. Hebrew RTL Formatting
- Wrap all Hebrew responses and markdown artifacts in `<div dir="rtl" style="direction: rtl; text-align: right;">`.
