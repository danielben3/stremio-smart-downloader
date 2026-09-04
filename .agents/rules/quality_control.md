---
trigger: always_on
description: Mandatory file quality control and content inspection to prevent silent mock/dummy deliverables.
---

# Output File Quality Control & Verification Rule

1. **Mandatory Content Reading**: Never assume a file is valid just because it exists or has a matching filename. Always inspect the content using `view_file` or a dedicated validation script before declaring completion.
2. **Strict Anti-Dummy Policy**: Never output dummy/placeholder files (e.g. 2 lines of sample text) when external resources are missing. Always report the actual state to the user and suggest real alternatives (e.g. AI translation).
3. **Subtitle Quality Gate**: A valid subtitle must have >= 100 cues for movies, span >70% of the runtime, and be >15 KB.
