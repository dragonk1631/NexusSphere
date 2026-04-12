# NexusSphere Development Principles

This document defines the core rules and workflow for the NexusSphere project. These principles are the **Single Source of Truth (SSOT)** for AI assistants and contributors.

## 1. Branching Strategy & Deployment
- **Develop First**: All development, experimentation, and fixes MUST happen in the `develop` branch.
- **Main is Restricted**: ABSOLUTELY NO pushing or merging to the `main` branch without **explicit, direct permission** from the USER (e.g., "Merge to main" or "Deploy to production").
- **Merge Hygiene**: Only merge `develop` into `main` after a full verification of chart integrity and engine stability.

## 2. The Legacy Sanctuary (Sanctuary Principle)
- **Sanctuary Immunity**: The Standard MIDI legacy processing engine (v1d75924 logic) is the project's soul. It must be physically and logically isolated from modern AI density-throttling or lane-trimming algorithms.
- **Purity**: Standard MIDI files must always bypass AI-specific logic to preserve their original "Golden Era" chart quality.

## 3. Library & Data Integrity
- **Perfect Start Guarantee**: Before gameplay, the system must ensure the library integrity. No song should be playable unless its main chart channel is correctly analyzed and validated (v1.3 standard).
- **Proactive Sync**: Maintenance of the `official_songs.json` and its associated beatmap configurations must be automated and proactive to prevent "Zero Note" bugs.

## 4. Documentation & Continuity
- **Dev Blog**: Record daily progress, key decisions, and architecture changes in `docs/dev_blog/YYYY-MM-DD/`.
- **Knowledge Base**: Updates to logic or fixes for regressions must be documented to prevent future assistants from repeating mistakes.

---
**Note to AI Assistant**: Read this document at the start of every session. Failure to follow these rules is UNACCEPTABLE.
