# DOPAMODORO Web V2 — Development Prompts

This document is the implementation source-of-truth for continuing the Web V2 build. It is intentionally development-focused. QA, regression testing, production rollout, and merge-to-main are deferred until the owner requests them.

## 0. Master Product Prompt

Build DOPAMODORO Web V2 as a desktop-first productivity operating system derived from the latest Chrome-extension feature set, but redesigned for a spacious web dashboard. The core loop is North Star → Tasks → AI Coach → Focus → Journal/Insights. Do not add a website/app blocklist to Web V2. The Task Manager is a first-class system, not a lightweight todo list. Every task must contain enough structured context that either the user or an authorized agent can understand, organize, and execute it without losing information.

Visual direction: preserve the approved dark navy mockup with restrained neon pink/orange/purple accents, dense but readable desktop information architecture, rounded low-contrast panels, thin borders, clear hierarchy, and responsive fallback. Avoid gimmicky gradients, oversized marketing UI, or a mobile-extension look stretched across desktop.

Data rule: UI, REST API, MCP tools, and AI Coach must all operate on the same task and North Star schema. Never create parallel task stores.

Agent rule: read/create/organize access is controllable by permissions. Delete is opt-in and disabled by default. Agent operations must preserve unspecified fields, especially notes, attachments, links, Definition of Done, and Agent Instructions.

Sync rule: browser and server data must be bidirectional and conflict-aware. A stale browser copy must not silently overwrite a newer agent edit.

## 1. Sidebar / Main Menu Prompt

Implement a persistent desktop sidebar containing exactly these primary destinations:

1. Dashboard
2. Focus
3. Tasks
4. Journal
5. Insights
6. AI Coach
7. Integrations
8. Settings

Do not include Blocklist in Web V2.

Add a compact Today's Momentum card showing focus minutes, session count, and completed-task count. Add Quick Capture for immediately creating a task. Keep a compact workspace/user strip at the bottom. Navigation must switch views without losing task/timer state.

## 2. Dashboard Screen Prompt

Build the dashboard as the command center. Layout:

- North Star panel across the top of the primary column.
- Focus Timer directly beneath it.
- Rich Task Manager table beneath the timer.
- AI Coach rail on the right.
- Developer & Integrations summary under the Coach rail.

The dashboard should answer, without navigating away: What am I trying to achieve? What should I do next? What am I focusing on now? What tasks require attention? Can my agents access the same data?

Task rows must be selectable. Selecting a row should reveal meaningful task context, not just metadata.

## 3. North Star Prompt

North Star is the top-level goal that contextualizes the rest of the system. It must appear prominently at the top of Dashboard.

Fields:

- title
- description / why it matters
- current milestone
- target date
- overall progress 0–100
- weekly milestones array
- update timestamp used for synchronization

Allow editing in a dedicated modal. AI Coach should receive North Star context. MCP should expose read/update tools. Browser/server synchronization must preserve the newest edit.

## 4. Focus Screen / Timer Prompt

Implement a Pomodoro-style focus experience with:

- Focus / Short Break / Long Break modes
- configurable durations
- start / pause / reset
- circular progress visualization
- active/current task shown beside the timer
- today's accumulated focus time
- today's session count
- session logging when a focus block finishes

The same timer component should be usable on Dashboard and the dedicated Focus page. Finishing a focus session should append session history and journal context tied to the active task where possible.

Do not add blocklist behavior to Web V2.

## 5. Task Manager Screen Prompt

The Task Manager is the most important operational feature. Build a full task workspace rather than a basic checklist.

Required task schema:

- id
- title
- description
- project / group
- status: todo | in_progress | blocked | done
- priority: urgent | high | medium | low
- dueDate
- estimateMinutes
- tags[]
- reminder
- notes
- definitionOfDone
- agentInstructions
- subtasks[] with id/title/done
- attachments[] with id/name/type/size/url or stored data/source/addedAt
- links[] with id/label/url
- createdAt
- updatedAt

Task list capabilities:

- All / Today / Upcoming / Completed filters
- search across task content, not only title
- sort by priority, due date, updated time, title
- completion toggle
- status / priority labels
- project and tag visibility
- subtask progress
- attachment/context count
- row selection
- full editor

Every update must preserve fields that were not intentionally changed.

## 6. Task Detail / Editor Prompt

Create a task editor large enough for real project work.

Top area:

- title
- project/group
- full description
- status
- priority
- due date
- estimate
- tags
- reminder

Context area:

- long-form notes
- editable subtasks
- attachment uploader/list
- external links
- Definition of Done
- Agent Instructions

Attachments are part of task context and must remain associated with the task. Do not discard attachment metadata during agent reorganization.

Delete should be visually separated from Save and should remain a destructive action. Agent delete access remains disabled by default.

## 7. Quick Capture Prompt

Quick Capture should accept a short text fragment and immediately create a task with safe defaults. It should not force the user through the full editor. The newly created task remains editable later and must be included in API/MCP synchronization.

## 8. AI Coach Screen Prompt

AI Coach is not a generic chatbot. It is a context-aware planning layer over the user's actual North Star, tasks, deadlines, priorities, subtasks, and recent sessions.

Required capabilities:

- Today's recommended focus order
- Next Best Task
- concise reason for ranking
- Smart Breakdown of the highest-priority task
- contextual suggestions
- coach chat
- ability to move a recommended task into the active Focus slot

Ranking fallback when AI is unavailable:

1. unfinished only
2. urgent before high before medium before low
3. earlier due date before later/no due date

The remote AI endpoint receives structured workspace context. It must never invent deadlines, completion status, attachments, notes, or task facts. Prefer one concrete next action over vague productivity advice.

## 9. Journal Prompt

Journal should combine:

- completed focus-session entries
- task context associated with sessions
- manually logged work
- daily reflection text

Keep the timeline readable and chronological. Journal is for memory and reflection, not another task list.

## 10. Insights Prompt

Insights should summarize real stored data only.

Initial metrics:

- total focus minutes
- session count
- completed tasks
- streak
- focus-by-day visualization
- open / in-progress / blocked / completed task flow

Never fabricate productivity numbers. Empty data should show empty/zero states naturally.

## 11. Integrations Screen Prompt

Build an Integrations screen focused on DOPAMODORO's own API/MCP connection.

Fields/actions:

- API Base URL
- optional bearer/agent token
- Save connection
- Sync now
- displayed MCP endpoint
- list of exposed MCP tools
- permission controls

Permissions:

- read tasks: on by default
- create tasks: on by default
- organize tasks: on by default
- delete tasks: off by default

Explain capabilities through UI labels, not long documentation inside the app.

## 12. REST API Prompt

Use the dedicated `dopamodoro-api` service as the server-side task platform.

Endpoints:

- GET /api/tasks
- POST /api/tasks
- GET /api/tasks/:id
- PATCH /api/tasks/:id
- DELETE /api/tasks/:id
- GET /api/north-star
- PUT /api/north-star
- POST /api/sync
- POST /api/coach
- GET/POST /api/mcp

Task GET/list should return structured fields intact. PATCH must preserve omitted fields. Organization operations respect workspace permissions. DELETE requires explicit delete permission.

Use optional bearer authorization via `DOPAMODORO_AGENT_TOKEN` and CORS origin configuration.

## 13. MCP Prompt

Expose the same server-side records via an MCP-compatible HTTP JSON-RPC endpoint. Do not create a separate MCP database.

Required tools:

- task_list
- task_get
- task_create
- task_update
- task_organize
- task_delete
- north_star_get
- north_star_update

`task_organize` accepts multiple `{id, patch}` changes and is intended for agents reorganizing projects, dates, priorities, tags, statuses, subtasks, or structured context in one operation.

Tool behavior rules:

- preserve all unspecified task fields
- return explicit task-not-found errors
- obey permissions
- do not silently delete
- return rich task context to agents
- North Star updates must carry an update timestamp so browser sync cannot overwrite a newer agent edit

## 14. Browser ↔ Server Sync Prompt

When an API Base URL is configured:

- sync once on app startup
- queue a silent sync after local state changes
- allow manual Sync Now
- merge tasks by `id`
- compare task `updatedAt`
- newest task version wins
- preserve server-only tasks created by agents
- preserve local-only tasks and upload them
- synchronize North Star with a dedicated update timestamp

Do not implement naive last-request-wins replacement of the entire task array.

## 15. Persistence Prompt

Server persistence should use Upstash Redis REST when configured:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Workspace records use a namespaced workspace key. Development may fall back to in-memory server state when persistence variables are absent, but production should configure persistent storage.

## 16. Settings Prompt

Settings initially include:

- default Focus minutes
- Short Break minutes
- Long Break minutes
- number of sessions before long break
- auto-start breaks
- sounds
- Coach nudges

Saving timer durations should immediately update future timer sessions without destroying task/session data.

## 17. Responsive Web Prompt

Desktop is primary. On narrower layouts:

- collapse right rail beneath main content
- convert multi-column forms to one column
- keep task tables horizontally scrollable instead of hiding important columns
- preserve readable modal editing
- allow sidebar navigation to become a compact grid

Do not reduce the product to the old extension-sized layout.

## 18. Empty / Loading / Error State Prompt

Every major screen should eventually include states for:

- no tasks
- no sessions
- no North Star
- no Coach recommendation
- API not configured
- remote sync unavailable
- unauthorized agent token
- persistence unavailable

Current development may use lightweight text/toast states. A later QA/UI-hardening pass should verify every state.

## 19. Security / Agent Safety Prompt

Agent access must be explicit and scoped.

- Optional API token protects REST and MCP.
- Delete permission defaults off.
- Read/Create/Organize are separate permissions.
- Never expose server secrets to browser source.
- Agents must preserve information they did not intentionally edit.
- A task's `agentInstructions` field is execution context, not authorization to bypass workspace permissions.

## 20. Chrome Extension Parity Prompt

When continuing feature parity work, compare the newest extension package against Web V2 feature-by-feature. Port useful productivity behavior into the web information architecture rather than copying the popup layout literally. The web version should retain timer/task/journal/insight/coach behavior while using the richer desktop Task Manager and North Star hierarchy.

Blocklist is an explicit exception: do not port it to Web V2 unless the owner reverses this decision.

## 21. Development Check-In Protocol

After implementing each feature group, provide a concise check-in containing:

- feature name
- what was implemented
- branch/repo changed
- what feature is next

Do not claim a feature passed QA unless QA was actually requested and performed.

## 22. Deferred QA Prompt

QA is intentionally deferred. When the owner later requests QA, create a separate plan covering interaction regression, responsive states, task CRUD preservation, attachment behavior, timer state, AI fallback, REST authorization, persistence, MCP initialize/tools/list/tools/call, conflict synchronization, and browser/server/agent concurrency. Do not mix that QA task into the current development commits.
