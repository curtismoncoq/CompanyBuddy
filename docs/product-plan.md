# DecisionDrift product plan

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
- Observe all applications whose text Screenpipe captures, with no imposed editor or document title. Optional application/window filters remain available. TextEdit and a browser with arbitrary titles are the demonstration surfaces; Google Docs authentication is unnecessary.
- Deliver a desktop notification titled with the approved decision's title that opens an explanatory card in DecisionDrift. Keep the body generic and captured work-document details out of the notification. The decision title is intentionally visible wherever macOS presents the alert.
- The explanatory card shows the observed passage, applicable decision, available date constraints, and supporting source passage, with access to the source.
- The app only informs the employee. Do not add an exception approval process, employee feedback workflow, automatic proposal edits, or blocking actions.
- Use external AI for decision extraction and conflict analysis. The user accepts external processing and does not want privacy engineering to be a hackathon workstream. Existing employee-only visibility and exclusion of captured work content from notifications remain in scope.
- Prefer MiniMax as the model provider. The user reports that MiniMax appears to work and has Screenpipe Business access through the hackathon. Do not infer specific Business entitlements or end-to-end Google Docs monitoring from that report.
- Notify only once for the same possible conflict during a monitoring session, even if the conflicting passage remains visible. Do not add resolution tracking or follow-up reminders.
- Use a dedicated local DecisionDrift interface with Screenpipe's integrated task execution and MiniMax as the preferred model. Do not build a separate agent harness.
- The interface handles note import, decision review, approved-file export/import, and monitoring controls. Screenpipe tasks produce analyses; DecisionDrift consumes the results, deduplicates reminders, and owns desktop notifications and explanation display.
- Do not introduce a remote backend or additional user accounts for the hackathon.

## Hackathon scope limits

- Use a simple fixed decision example. Decision replacement, version history, and changing policies are out of scope.
- Do not build exception management or the previously proposed “Not applicable” and snooze workflows.
- Do not introduce additional privacy infrastructure for the demo. Do not expose credentials in the application UI, source files, or shared decision files.

Terminology is defined in [GLOSSARY.md](../GLOSSARY.md).

## Accepted demonstration

1. The owner imports [examples/scenario1.json](../examples/scenario1.json), supplied by the user as `screenpipe:scenario1.json`, from the meeting “Point sur la migration de l'API”.
2. Preserve both decisions and their source passages: keep `/api/v1/users` active until at least November 30, 2026, with no removal or deactivation without renewed team approval; preserve backward compatibility and include a backward-compatibility test for user-route changes. The owner confirms the candidate decisions in DecisionDrift; the source's `valide_par` field does not bypass that step.
3. Preserve the three assigned actions as source context, not universal decision rules or new task-management workflows. The employee imports the approved decision file.
4. For the first conflict demonstration, the developer opens [examples/plan-migration.md](../examples/plan-migration.md) in the configured editor; it states “Je vais désactiver /api/v1/users aujourd’hui pour terminer la migration”.
5. A real Screenpipe capture supports a possible-conflict notification. Clicking it opens the observed passage, the API V1 maintenance decision, and its supporting source passage.
6. Opening [examples/plan-migration-conforme.md](../examples/plan-migration-conforme.md), which states “Je conserve /api/v1/users actif et j’améliore /api/v2/users”, does not trigger a reminder.
7. Leaving the conflicting passage visible does not repeatedly notify during the same monitoring session.

The reminder must come from captured work, not a scripted demonstration trigger.

November 30, 2026 is a minimum maintenance deadline, not an effective-start date or automatic permission to remove V1 afterward. Do not invent missing date metadata. The second decision remains in the imported source; do not claim a missing test or broken compatibility from incomplete screen context. Merely quoting or discussing the prohibition on removal is not evidence of an intent to remove the endpoint.

## Operational checks

- Real Screenpipe capture, MiniMax analysis and Markdown/pasted-note extraction have been exercised. General monitoring uses empty optional filters, not a TextEdit or `plan-migration` special case.
- The README documents local signed-app setup, manual approved-file handoff and native notification permissions. A real macOS conflict notification was delivered while CompanyBuddy's window was closed; clicking the OS notification opened and focused its exact evidence card.
- Final cross-app smoke used real Google Chrome for Testing and TextEdit captures under arbitrary titles with both filters empty. Both produced grounded conflicts and presented macOS notifications; each native click selected its own evidence, including the second alert while another alert was selected. A fresh capture of the same conflicting document did not add a third alert. Replacing its text with a conforming plan returned `clear`; an intentionally unmatched optional title filter returned `no_data`, both without extra alerts. Analysis runs in this check took approximately 32–36 seconds, not an instantaneous or guaranteed latency.

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

At that stage, the initial extension-loading blocker was resolved, but real Google Docs coverage and native delivery had not yet been checked. Google Docs is no longer a required demonstration surface.

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
- The desktop UI was exercised for file import, explicit approval, native Save-dialog export, approved-file import, persistence after restart, real pasted-note extraction, live monitoring, source/capture opening and stopping. The final native click check navigated from hidden Settings to Activity and focused the correct evidence.
- Ten permanent behavioral regression tests pass, alongside `npm run typecheck` and `npm run package:mac`. Tests cover portable source evidence, atomic import rejection, persistence, notification reentrancy/deduplication and session races. A review caught legacy IPv6 settings becoming unloadable; loopback IPv6 now remains supported in settings and the runtime, with restoration and real API transport smoke coverage.

## Minimal desktop interface

- Three views: Activity, Decisions, Settings, labeled in French. Import uses one dialog; provenance, actions, approval metadata and diagnostics use progressive disclosure. Unsaved input survives navigation.
- Visual reference: [Screenpipe website](https://screenpipe.com/), its [official design document](https://github.com/screenpipe/screenpipe/blob/main/docs/DESIGN.md) and [current dark desktop screenshot](https://raw.githubusercontent.com/screenpipe/screenpipe/main/.github/pr-assets/agent-disclosure/chat-main-after-dark.png). Restrained monochrome, compact navigation, thin borders and an active-analysis lime accent, adapted to the user's dark glass preference without copying the Screenpipe brand.
- macOS uses native under-window vibrancy and translucent surfaces. The installed desktop was visually inspected through an actual Screenpipe screenshot; the interface was also exercised at its 900 × 640 minimum size without horizontal overflow.
- Native delivery uses locally signed `release/CompanyBuddy.app`, stable bundle identifier `com.companybuddy.desktop`, retained notification objects and explicit delivery-error handling. Settings provides a real notification test without creating a fake conflict. The local ad hoc signature is not Apple notarization.

## Finder-launched Screenpipe execution

- After moving the app to Applications, `pipe run` failed before model execution with `env: node: No such file or directory`. The installed process had Finder's `/usr/bin:/bin:/usr/sbin:/sbin` PATH; the available Node installation was outside it. This was a launcher dependency failure, not a MiniMax preset or notification-permission error.
- The signed bundle now includes `Resources/node-bin/node`, a relocatable launcher for Electron's embedded Node runtime. Only Screenpipe subprocesses receive that private PATH; only the launcher enables Node mode. The GUI environment, login shell, global PATH and Screenpipe presets remain unchanged.
- Regression smoke exercised JavaScript through the installed launcher with Finder's minimal PATH and closed stdin, then launched the installed app under that same minimal environment. A real Screenpipe/MiniMax analysis completed successfully and wrote `{"conflicts":[]}`. The existing approved decision and four saved alerts remained intact. One installed run took approximately 78 seconds; this is not a latency guarantee.

## macOS shared-display notification suppression

- The installed app had valid notification authorization and its current signature matched the source registered by macOS. A direct notification test bypassed model execution and conflict deduplication.
- Native logs showed the request being accepted, then silenced with `interruptionSuppression: silence; resolutionReason: display shared; activeModeUUID: (null)`. Delivery events and Notification Centre activation did not prove an on-screen banner.
- With the user's approval, enabled the global macOS “Allow notifications when mirroring or sharing the display” option for the demo. This affects other permitted apps too and should be disabled afterwards if those notifications must remain private during presentations.
- After activation, observed a real test notification and then a native conflict alert generated from a fresh TextEdit capture of `plan-migration.md`. Clicking that actual alert opened CompanyBuddy and selected the matching new evidence rather than the previously selected older alert. Monitoring was returned to pause. No notification implementation or preset changes were needed.

## DecisionDrift rename

- Renamed the product, npm metadata, app bundle/executable, menu, window, notification text, sidebar monogram, preload API, IPC channels, TypeScript symbols and Screenpipe task names to DecisionDrift. Historical observations above retain the name and paths used at the time.
- Kept the existing storage directory `CompanyBuddy`, bundle identifier `com.companybuddy.desktop` and portable format marker `companybuddy.approved.v1` as stable identities. No data migration, internal API aliases or export-format fork is required.
- Typechecking, all ten existing tests, production packaging and installed-bundle signature verification passed. The renamed installed interface loaded the original decision, source, settings and seven alerts unchanged; monitoring remained paused. Checked the new preload API, removed old API, Activity/Decisions/Settings views, visible native DecisionDrift test notification and native click activation. The private Node launcher ran under Finder's minimal PATH after the executable rename; both native and Electron-title self-capture exclusions rejected the renamed app.
- No custom icon artwork has been supplied. A 1 024 × 1 024 PNG converted to `.icns` is sufficient for this Electron bundle; Icon Composer is optional, not a runtime or build prerequisite. The existing Electron icon remains until artwork is supplied.

## Custom macOS icon

- Copied the supplied 1 024 × 1 024 transparent PNG into `assets/icon.png`, leaving the Downloads original untouched. macOS packaging generates all ten standard iconset representations, builds `DecisionDrift.icns`, sets `CFBundleIconFile` and signs the completed bundle. No Icon Composer dependency or Finder-only icon override.
- Built the production bundle and verified the installed signature and icon metadata. macOS IconServices resolved the supplied artwork. Notification Center initially kept the Electron icon despite refreshing app registration and relaunching DecisionDrift; restarting only its presentation process refreshed that cache. A newly presented native test notification visibly displayed the supplied icon.
- The original decision, source, settings and seven saved alerts remained unchanged; notification tests did not create conflict history. Monitoring remained paused.

## Dock icon proportions

- The supplied pre-rounded iOS artwork filled its 1 024-pixel canvas and appeared visibly larger than neighboring macOS icons. Keep the source untouched; generate a macOS-specific master with the artwork centered at 824 × 824 on a transparent 1 024 × 1 024 bitmap, then derive every iconset size from that same master.
- The native Cocoa renderer uses an explicit bitmap graphics context, independent of display backing scale. The installed `.icns` decoded to 1 024 × 1 024 with fully transparent margins and an opaque body. Production packaging and installed signature verification passed.
- Refreshed only this app's registration and relaunched the Dock to discard its old oversized bitmap. Actual Dock capture showed DecisionDrift aligned in visible size with neighboring Launchpad and System Settings icons. No Dock size, magnification, app identity or notification-permission settings were changed.

## Decision title in conflict notifications

- At the user's request, use each conflict alert's `decisionTitle` as its native notification title rather than the app's display name. Keep the generic body, approved decision wording, session deduplication and click-to-evidence callback unchanged. The independent notification-test button remains a generic delivery check.
- Typechecking, all ten existing tests, production packaging and installed signature verification passed. A fresh TextEdit capture and real Screenpipe/MiniMax analysis produced a new alert titled “Maintien de l'API V1”; the actual macOS banner visibly showed that title.
- With an older alert selected and Settings displayed, clicking the native alert opened Activity, delivered the exact new alert ID and focused its evidence card. Sources, decisions and settings remained unchanged; the legitimate verification alert was added to history and monitoring was returned to pause.
