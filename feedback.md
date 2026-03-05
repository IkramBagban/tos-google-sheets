# TelemetryOS Developer Feedback

## Instructions

**When to fill this out:**
- **Stage 1 (Mockup):**Complete sections as you go.
- **Stage 2 (Final):** Finalize all sections when submitting your production version.

**How to use:**
1. Copy this template to your github repo. `applications/[app-name]/feedback.md`
2. Fill in the YAML fields below progressively during development
3. Finalize before Stage 2 submission (estimated: 5 minutes)

**Privacy:** Your feedback is used internally to improve TelemetryOS. Specific examples may be anonymized and shared with the product team.

---

```yaml
# Application Overview
app_name: "google-sheets"
developer: "Ikram Bagban"
stage_1_date: "2026-03-05"        # YYYY-MM-DD
stage_1_hours: 2        #(stage 1 only)
stage_2_date: ""        # YYYY-MM-DD
stage_2_hours: 0        #(stage 2 only)
total_hours: 0        #total (stage 1 + stage 2)
complexity: "simple"          # simple | moderate | complex

# Overall Ratings (1-5, where 1 = Poor, 5 = Excellent)
platform_rating: 4
sdk_rating: 4

# Blocking Issues — list any issues that prevented progress or required workarounds
blocking_issues:
  - category: docs
    description: "Build docs listed `pnpm install -g telemetryos/cli`, which failed. Correct package is `@telemetryos/cli`; this blocked setup until checked in browser docs."

# SDK & API Design
sdk_worked_well:
  - "createUseInstanceStoreState for Settings ↔ Render sync"
sdk_frustrating: []     # Confusing or difficult SDK usage
sdk_missing: []         # Methods/features you needed but weren't available

# Documentation
docs_helpful:
  - "https://docs.telemetryos.com/docs/settings-components"
  - "https://docs.telemetryos.com/docs/store-hooks"
docs_missing:
  - "Clarify globally across docs that CLI package is `@telemetryos/cli` (not `telemetryos/cli`)."
  - "Add docs for a generic `tos init` AI setup flow: ask preferred environment first (e.g., Claude Code, Codex, etc), then scaffold matching skills/instructions/settings."
  - "Add clear template-selection guidance for `tos init` (difference between `Vite + React + TypeScript` vs `Vite + React + TypeScript + Web`, and when to use each)."

# AI Tools & Workflow
ai_tools:
  - "copilot & codex"            # claude-code | copilot | cursor | chatgpt | other
ai_time_savings: "significant"     # minimal | moderate | significant | substantial
ai_helped_with: "Requirement compliance checks, edge-case auditing, and iterative TypeScript-safe refactors."
ai_hindered: 

# Top 3 Improvements — what would most improve TelemetryOS development?
top_improvements:
  - "In `tos init`, before asking `Include Claude Code skills and settings?`, add a provider selection prompt (Claude Code/Codex etc) and scaffold matching setup files."
  - "In build docs, explain template differences (`Vite + React + TypeScript` vs `Vite + React + TypeScript + Web`) and provide a quick decision guide for which one to pick."

# Additional Comments (optional)
comments: "Stage 1 implementation and standards alignment are complete in code"
```
