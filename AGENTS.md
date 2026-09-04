# Project Memory & Agent Directives

## 1. Mandatory File Content & Quality Verification (No Silent Mocks)
- **Always Read & Validate Outputs:** Before reporting success or declaring any deliverable ready (subtitles, videos, media, data, code), the agent MUST read and inspect the file's inner content using `view_file` or a dedicated validator script (e.g. `.agents/skills/output-file-quality-control/scripts/validate_subtitle.js`).
- **Never Rely on Mere Existence:** Verifying that a file exists on disk or that its name matches a pattern is strictly insufficient.
- **No Dummy / Mock Fallbacks as Final Deliverables:** If an upstream service or translation is unavailable, NEVER silently output a placeholder/dummy file (e.g. 2 lines of sample text). Explicitly inform the user of the exact state and suggest real alternatives (such as AI translation from source subtitles).
- **Quality Gates for Subtitles:** A valid movie subtitle must contain at least 100+ dialogue cues, span >70% of the movie runtime, and have a realistic file size (>15 KB).

## 2. Terminal Commands & Safety Protocol
- Always explain the purpose of any terminal or system command in Hebrew to the user before invoking `run_command`.
- Clearly state what the command does, why it is needed, and that it is safe to run.

## 3. Hebrew RTL Formatting
- Wrap all Hebrew responses, plans, and markdown artifacts in `<div dir="rtl" style="direction: rtl; text-align: right;">`.

## 4. Skills Reference
- **output-file-quality-control:** Located in `.agents/skills/output-file-quality-control/SKILL.md`. Always reference and execute this skill when generating, modifying, or downloading deliverables.
