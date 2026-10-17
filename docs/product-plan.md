# CompanyBuddy product plan

This document records confirmed product decisions from the planning interview. Unresolved choices are not implementation requirements.

## Confirmed scope

- Build the company-decisions assistant. IT support is a possible future expansion, not part of this build.
- Anchor the hackathon demo on a developer drafting an API migration plan that contradicts the team's decision to keep `/api/v1/users` active. This replaces the previously accepted sales/onboarding demonstration.
- Accept Markdown uploads or pasted notes, plus the structured JSON reference scenario in [examples/scenario1.json](../examples/scenario1.json). Direct Slack and Granola integrations are not prerequisites.
- Extract candidate decisions. A designated person must confirm a candidate before it becomes an approved decision.
- Preserve the source document identity and relevant passage. Approved decisions have a scope and any stated date constraints; missing effective-start dates must not be invented.
- Keep employee activity and reminders private to that employee. Do not provide a manager-facing activity feed or compliance score.
- Give the employee control over observation, including the ability to pause it.
- Detect concrete possible conflicts rather than judge general alignment with company strategy. Require an applicable approved decision, relevant observed evidence, and an explanation linking them.
- Prefer missing an ambiguous case to repeatedly interrupting legitimate work.
- A decision owner reviews extracted candidates, corrects their wording, scope, and date constraints, then shares an approved decision file for the employee to import.
- Use a local editor displaying `plan-migration.md` as the initial work surface. TextEdit is available on the development machine; app name and window-title filters remain configurable. This replaces Google Docs and avoids browser authentication.
- Deliver a generic desktop notification that opens an explanatory card in CompanyBuddy. Keep sensitive work-document details out of the notification.
- The explanatory card shows the observed passage, applicable decision, available date constraints, and supporting source passage, with access to the source.
- The app only informs the employee. Do not add an exception approval process, employee feedback workflow, automatic proposal edits, or blocking actions.
- Use external AI for decision extraction and conflict analysis. The user accepts external processing and does not want privacy engineering to be a hackathon workstream. Existing employee-only visibility and generic notification requirements remain in scope.
- Prefer MiniMax as the model provider. The user reports that MiniMax appears to work and has Screenpipe Business access through the hackathon. Do not infer specific Business entitlements or end-to-end Google Docs monitoring from that report.
- Notify only once for the same possible conflict during a monitoring session, even if the conflicting passage remains visible. Do not add resolution tracking or follow-up reminders.
- Use a dedicated local CompanyBuddy interface with Screenpipe's integrated task execution and MiniMax as the preferred model. Do not build a separate agent harness.
- The interface handles note import, decision review, approved-file export/import, and monitoring controls. Screenpipe tasks produce analyses; CompanyBuddy consumes the results, deduplicates reminders, and owns desktop notifications and explanation display.
- Do not introduce a remote backend or additional user accounts for the hackathon.

## Hackathon scope limits

- Use a simple fixed decision example. Decision replacement, version history, and changing policies are out of scope.
- Do not build exception management or the previously proposed “Not applicable” and snooze workflows.
- Do not introduce additional privacy infrastructure for the demo. Do not expose credentials in the application UI, source files, or shared decision files.

Terminology is defined in [GLOSSARY.md](../GLOSSARY.md).

## Accepted demonstration

1. The owner imports [examples/scenario1.json](../examples/scenario1.json), supplied by the user as `screenpipe:scenario1.json`, from the meeting “Point sur la migration de l'API”.
2. Preserve both decisions and their source passages: keep `/api/v1/users` active until at least November 30, 2026, with no removal or deactivation without renewed team approval; preserve backward compatibility and include a backward-compatibility test for user-route changes. The owner confirms the candidate decisions in CompanyBuddy; the source's `valide_par` field does not bypass that step.
3. Preserve the three assigned actions as source context, not universal decision rules or new task-management workflows. The employee imports the approved decision file.
4. For the first conflict demonstration, the developer opens [examples/plan-migration.md](../examples/plan-migration.md) in the configured editor; it states “Je vais désactiver /api/v1/users aujourd’hui pour terminer la migration”.
5. A real Screenpipe capture supports a possible-conflict notification. Clicking it opens the observed passage, the API V1 maintenance decision, and its supporting source passage.
6. Opening [examples/plan-migration-conforme.md](../examples/plan-migration-conforme.md), which states “Je conserve /api/v1/users actif et j’améliore /api/v2/users”, does not trigger a reminder.
7. Leaving the conflicting passage visible does not repeatedly notify during the same monitoring session.

The reminder must come from captured work, not a scripted demonstration trigger.

November 30, 2026 is a minimum maintenance deadline, not an effective-start date or automatic permission to remove V1 afterward. Do not invent missing date metadata. The second decision remains in the imported source; do not claim a missing test or broken compatibility from incomplete screen context. Merely quoting or discussing the prohibition on removal is not evidence of an intent to remove the endpoint.

## Operational checks

- Local-editor capture, configured app/window filtering, real MiniMax task analysis and Markdown extraction have been exercised.
- The README documents another person's setup and the manual approved-file handoff. Native notification activation remains a user-assisted check.

## Technical observations

- The local Screenpipe health endpoint responded on October 17, 2026. Version: 0.4.52. Screen capture reports `frame_status: ok`; overall health is degraded due to audio-model initialization timeouts. This does not prove Google Docs text coverage.
- Screenpipe documents ChatGPT Plus/Pro sign-in for its own chat and scheduled tasks, without an API key. This is not evidence of a general model endpoint callable by a separate CompanyBuddy process: https://docs.screenpipe.com/chatgpt
- MiniMax documents subscription keys and OpenAI-compatible and Anthropic-compatible endpoints for other AI tools: https://platform.minimax.io/docs/m-plan/other-tools. The user reports that MiniMax appears to work. Local configuration inspection confirmed a `minimax` preset using provider `custom`, model `MiniMax-M3`, endpoint `https://api.minimax.io/v1`, and a configured key; no key was printed.

## Initial integration attempt

- Installed a separate, manual-only temporary task and explicitly assigned the `minimax` preset using the installed Screenpipe CLI.
- Running the task failed before model execution: `Failed to load extension .../pi-subagents/index.js` with `_piAi.toToolDeclaration is not a function`. The complete Google Docs → task → analysis path is therefore not validated. This failure does not establish a MiniMax credential or model problem.
- An existing task also had this extension-loading failure recorded. No existing task, extension, provider setting, or credential was changed.
- Local authenticated Screenpipe search responded successfully and returned real captured terminal frames. Terminal captures are not accepted as evidence of Google Docs coverage.
- The browser relay was unavailable (target discovery timed out). A separately opened visible browser reached Google sign-in rather than an editable document, and was then closed. An accessible Google Docs test document is still required.
- Removed the temporary task after the failed run. No ongoing CompanyBuddy surveillance was enabled.

The initial extension-loading blocker was subsequently resolved as described below. Real Google Docs coverage and notification latency remain unverified.

## Compatibility correction and successful task run

- With the user's authorization, pinned `pi-subagents` to `0.70.1`, the latest published version whose declared `pi-ai` range accepts the embedded `0.84.1` runtime. The previously installed `0.79.0` requires `pi-ai >=0.86.1`.
- Changed only `~/.screenpipe/pi-config/settings.json` (package registration), `~/.screenpipe/pi-config/npm/package.json`, and the corresponding generated dependency installation/lockfile. Screenpipe's app binary and embedded Pi runtime were not upgraded; the extension remains enabled.
- Installed a temporary manual task, selected preset `minimax`, and ran it through the installed Screenpipe CLI. The task completed successfully in a reported 28 seconds using provider `custom` and model `MiniMax-M3`.
- The model actually wrote `proof-result.json`. Programmatic checks confirmed valid JSON, a conflict for the free-onboarding synthetic proposal, no conflict for the EUR 500 synthetic proposal, and quoted phrases matching the supplied inputs.
- These were explicitly synthetic fixtures, not captured Google Docs text. The observed run duration is a single smoke result, not a guaranteed monitoring or notification latency.
- The positive explanation also invented an approval hierarchy not present in the decision. Classification passed; production prompts/results must keep explanations grounded in the supplied evidence rather than reuse this explanation verbatim.
- Removed the temporary compatibility task after inspecting its result. No ongoing CompanyBuddy task or surveillance was left enabled.

## Implemented application and verification

- Electron/React/TypeScript application implemented with a context-isolated preload, local atomic persistence, decision review and portable approved-file import/export, explicit session controls, native notifications and source/capture evidence cards. See [implementation-spec.md](implementation-spec.md) and [README.md](../README.md).
- The user manually saved the exported approved JSON to `~/Documents/companybuddy-decisions.json`. Importing that exact file through the new application's employee interface succeeded: one approved API V1 decision, approver Alex, original `scenario1.json` source, no resumed session or test alert history.
- Real TextEdit capture → Screenpipe task → MiniMax → grounded API V1 conflict succeeded in approximately 27 seconds in one isolated run. A real conforming document produced `clear`; a nonexistent matching window produced the distinct `no_data` state. A real Markdown extraction retained the decision's source quote and excluded the assigned action.
- Node-launched CLI tasks initially stalled with their input pipe left open. Explicitly closing subprocess stdin allowed execution to complete. Model-normalized typographic apostrophes are mapped back to the original exact evidence text; other invented quotations remain rejected.
- Analysis now uses only the newest matching capture, not old windows in the same lookback. A real capture check confirmed that an older conflicting document no longer overrides the newer conforming document. Screenpipe text may include visible background windows, so the demo uses one migration document at a time.
- Standards/spec review found a state-write race, startup cancellation gap, early capture cutoff and a required CLI override field. These were corrected with serialized complete transactions, post-persistence deduplication, startup generation cancellation, initial recent lookback and optional CLI discovery. Real discovery/Stop and persistence/restart smoke checks passed.
- Actual Electron UI was exercised for file import, explicit approval, persistence after restart, live monitoring, evidence display and stopping without late alerts. Repeated checks did not add duplicate alerts for the same decision/window/session. Native banner activation is pending the user's manual check.
- `npm run typecheck` and `npm run build` passed. Verification used disposable behavioral scripts and the real application/runtime, not permanent tests at an unconfirmed seam.
