# DecisionDrift implementation contract

## Goal

Deliver a working local desktop app for the approved API V1 scenario. Screenpipe provides real screen history and task execution; the configured MiniMax preset performs extraction/analysis. No separate agent harness, remote backend, accounts, IT helper, exception workflow, automated edits, or synthetic fallback.

## Agreed demonstration

Use examples/scenario1.json as the reference source. Preserve both decisions and three assigned actions. Only confirmed decisions are eligible for analysis. A statement intending to disable /api/v1/users conflicts with its approved maintenance decision; retaining V1 while improving V2 does not. Quoting a prohibition or an old example does not by itself establish conflicting intent. November 30 is a minimum maintenance deadline, not automatic expiry or an invented effective date. Observe every application whose text Screenpipe captures; application/window filters are optional and empty by default. TextEdit and a browser with an arbitrary window title are demonstration surfaces, not product restrictions.

## Shared interface

src/shared/contracts.ts is the integration contract. Only the integration owner edits it. The renderer accesses the app exclusively through window.decisionDrift. Node, Screenpipe credentials, and filesystem access stay out of the renderer. Sources, decisions, settings, and alert history persist locally; monitoring sessions do not resume on app launch. DecisionDrift continues working while its window is hidden. Stop suppresses late results and prevents new analyses; it does not stop the user's independent Screenpipe recorder.

## Complete vertical slices

1. Import JSON source or Markdown/pasted notes → extract candidates → review/edit/approve → persist → export only approved decisions with source evidence → import on another installation, preserving explicit approval. Source names in valide_par are evidence, not app approval. Invalid imports must not mutate the existing book.
2. Configure the local Screenpipe connection and preset, optionally restrict the application/window title → retrieve recent real frames (all captured applications by default, excluding DecisionDrift) → run a manual Screenpipe analysis task using that preset → read/validate a machine-readable result with exact evidence. Distinguish no capture, clear, conflict, and execution/API errors. No concurrent analysis runs or stale result reuse.
3. Start a monitoring session → immediate check and bounded subsequent checks → emit one generic native notification per decision/document conflict per session → click opens the evidence card with observed text, decision/source quote, app/time, source document, and original capture. Stop/restart has explicit session semantics. No notifier side effects inside the model task.
4. Another person follows the README to install, configure Screenpipe/preset, import an approved file, and repeat the local editor demonstration.

## Verification seams

Exercise public application commands for approval/import/export/session transitions, real extraction/analysis with Screenpipe, and the actual signed desktop interface. Permanent regression tests cover portable evidence, atomic rejection, persistence and session/concurrency behavior. Real capture, model execution, native notification delivery and native click activation require separate smoke verification; mocked application tests do not prove these integrations. Do not write source-text, forwarding, defaults, or mock-echo tests.

## Slice ownership

- Domain module: decision parsing, confirmation, export/import validation. Files: src/domain/decisions.ts.
- Runtime module: discover connection, real Screenpipe frames and task execution, structured source extraction and conflict analysis. Files: src/runtime/screenpipe.ts.
- Renderer module: complete French desktop UI using the shared contract. Files: src/renderer/* and index.html.
- Integration owner: package/build configuration, Electron main/preload, persistence, monitoring/session lifecycle, native notifications, documentation, final smoke and integration fixes.

## Operational constraints

Prefer explicit errors over fallbacks. Never print credentials. Read the Screenpipe local token through its installed CLI rather than copying it into project files. Preserve existing tasks and presets; own all DecisionDrift task names and clean only those resources. Pinned pi-subagents 0.70.1 is already working with embedded Pi 0.84.1; do not update it again.

## Interface

Three French views: Activité, Décisions, Réglages. Primary controls and results stay visible; provenance, dates, session diagnostics, advanced settings and pasted-note input use progressive disclosure. Follow Screenpipe's restrained monochrome typography, thin borders and compact layout, adapted to the requested dark translucent macOS vibrancy. Reserve the lime accent for active analysis. Native notifications retain the stable com.companybuddy.desktop bundle identity across the DecisionDrift rename; an explicit settings action tests delivery without inventing a conflict.
