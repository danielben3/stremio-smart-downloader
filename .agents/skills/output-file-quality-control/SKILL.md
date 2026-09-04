---
name: output-file-quality-control
description: >-
  Mandatory quality control, content inspection, and integrity verification for all
  generated, downloaded, or processed files (subtitles, videos, media, data, code, artifacts)
  before declaring task completion or reporting success to the user. Use whenever creating,
  modifying, downloading, generating, or verifying output files to ensure zero unverified
  dummy/mock fallbacks and 100% genuine content integrity.
---

# Output File Quality Control & Verification Protocol

This skill enforces strict quality gates on all files created, downloaded, or processed by the agent.
It guarantees that no dummy placeholders, truncated files, or uninspected outputs are presented to the user as complete deliverables.

---

## 🛑 Core Inviolable Rules

1. **NEVER Rely on Mere File Existence or Filename Matching:**
   * Checking that a file exists (`fs.existsSync`, `Get-Item`) or that its filename matches a video release is **NOT** proof of success.
   * You MUST open, read, and inspect the internal content before claiming any deliverable is ready.

2. **Zero Silent Dummy Fallbacks:**
   * If an upstream API, provider, or search returns no data (e.g. no Hebrew subtitles released yet), **NEVER** write a placeholder/dummy file and report success.
   * You MUST explicitly notify the user about the missing resource and present legitimate alternatives (e.g. AI-powered translation from source language, choosing another release, or notifying that it is unavailable).

3. **Mandatory Content Verification (Read Before You Report):**
   * Always view or parse the target file using `view_file` or validation scripts.
   * Verify that the contents reflect a full, genuine production artifact.

---

## 🔍 Specific Quality Gates by File Type

### 1. Subtitles (`.srt`, `.vtt`)
Before confirming a subtitle file is ready:
* **Cue / Block Count:** Must contain **at least 100+ dialogue cues** for full-length movies (or 50+ for short TV episodes). Any subtitle file with fewer than 20 cues is a **critical defect**.
* **Timeline Coverage:** The last timestamp in the subtitle must cover at least **70%–95% of the total movie duration** (e.g., reaching 01:20:00+ for a 90-minute movie), not stopping at 00:00:08.
* **File Size Sanity:** Genuine full movie subtitle files are typically **20 KB – 150 KB**. Files under **2 KB** must be immediately flagged for failure.
* **Automated Validator Script:** Run the bundled validator script:
  ```bash
  node .agents/skills/output-file-quality-control/scripts/validate_subtitle.js <path-to-srt> [min-cues] [min-duration-minutes]
  ```

### 2. Video / Media Files (`.mkv`, `.mp4`, `.avi`)
* **Size Verification:** Compare against expected torrent/source size (e.g. 1.4 GB target must verify ~1.4 GB on disk, not just the file header).
* **Hash / Piece Completion:** Ensure all BitTorrent chunks/pieces are 100% downloaded and verified before reporting readiness.

### 3. Code, API & Configuration Files
* **No Unresolved Placeholders:** Search for `TODO`, `MOCK`, `DUMMY`, `undefined`, or hardcoded simulation blocks.
* **Syntax & Execution Sanity:** Verify code compiles or runs cleanly without runtime crashes.

---

## 📋 Pre-Flight Checklist Before Responding to User

Before sending your final response to the user claiming a file or task is complete, verify this checklist:

- [ ] **1. Inspected:** Have I explicitly opened and read the content of the generated/downloaded file?
- [ ] **2. Size & Volume Check:** Does the size and record count align with a full production deliverable?
- [ ] **3. No Mock/Dummy Content:** Is the content genuine rather than a hardcoded test template?
- [ ] **4. Transparent Status:** If any part of the deliverable failed or is missing, have I clearly informed the user instead of masking it?

---

## 🚀 Corrective Action Runbook

If a verification gate fails:
1. **Identify the exact cause:** Missing upstream translation, network timeout, corrupt chunk, or API 403.
2. **Do NOT mask the error:** Discard the invalid file or mark it with `.invalid`.
3. **Execute remediation:**
   * For missing subtitles: Download the verified English/source subtitle and execute automated AI translation to the target language, or prompt the user.
   * For broken downloads: Reconnect to DHT/trackers or switch to an alternate healthy release.
4. **Re-run the quality check** until 100% verified.
