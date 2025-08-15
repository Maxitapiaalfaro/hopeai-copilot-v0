Executive Plan: Patient Library (independent from main chat) aligned with Google GenAI SDK and HopeAI Orchestrator

1) General Observation
- The current orchestration layer already supports robust intent routing, context optimization, and streaming, which we can extend to support patient-scoped conversations without duplicating logic.
- The most elegant and seamless path is to treat a “patient chat” as a first-class conversation that:
  - Persists patient data client-side (parallel to existing chat history).
  - Builds the first outbound message by combining user instruction + a patient context summary.
  - Reuses the existing /api/send-message endpoint and the single Orchestrator pipeline, injecting patient metadata early so intent routing and context optimization leverage it immediately.
- Verified with context7: The @google/genai SDK supports streaming via generateContentStream and a chat abstraction via ai.chats; given our current architecture consolidates history and orchestration server-side, we should continue using the stateless generate content stream flow from the backend and only craft the first message composition on the client. Confirmed SDK capabilities include function calling with tools and MCP integration when needed for the Researcher specialist.

1) Strengths of the Current Implementation
- Dynamic Orchestrator with intelligent agent selection; minimal backend contract changes needed to add optional patient metadata.
- Advanced context management and sliding window already in place to avoid token bloat when patient summaries are long.
- Entity extraction and intent routing components exist and can be enhanced to consume a patientId for better precision.
- Client-side persistence for conversations exists and can be mirrored for patient records.
- Clear API entry point for message streaming: <mcfile name="route.ts" path="app/api/send-message/route.ts"></mcfile>
- Orchestration core and routing present in:
  - <mcfile name="hopeai-system.ts" path="lib/hopeai-system.ts"></mcfile>
  - <mcfile name="dynamic-orchestrator.ts" path="lib/dynamic-orchestrator.ts"></mcfile>
  - <mcfile name="intelligent-intent-router.ts" path="lib/intelligent-intent-router.ts"></mcfile>
  - <mcfile name="clinical-agent-router.ts" path="lib/clinical-agent-router.ts"></mcfile>
  - <mcfile name="context-optimization-manager.ts" path="lib/context-optimization-manager.ts"></mcfile>
  - <mcfile name="context-window-manager.ts" path="lib/context-window-manager.ts"></mcfile>
  - <mcfile name="entity-extraction-engine.ts" path="lib/entity-extraction-engine.ts"></mcfile>

1) Architectural Gaps and Risks
- No dedicated patient library UI yet, and no client-side schema for PatientRecord and PatientSummary.
- First-message composition strategy (user instruction + patient context summary) is not yet standardized in the client; we must ensure parts are structured in a way the Orchestrator expects.
- Context leakage risk between patient conversations if session state is not isolated by patientId; needs clear scoping.
- Patient data privacy and “non-derivable” flags must be honored during generation; we should add an explicit confidential flag and a back-end guardrail check when patient metadata is present.
- RAG discipline for the Researcher specialist must be preserved; patient context summary should not pollute grounding steps or be mistaken for validated evidence.

1) Strategic Recommendation (SDK-based)
- SDK components to leverage (verified with context7):
  - Streaming: generateContentStream from the server orchestrator to the client for a smooth UX.
  - Contents structure: The SDK accepts Content | Content[] | Part | Part[]; for the first message, the client should craft Parts that include:
    - A “[Patient Context Summary] …” section, compact and token-limited.
    - The “[User Instruction] …” as a separate Part in the same Content.
    This lets the backend receive a single role='user' content with multiple parts while keeping the Orchestrator in control.
  - Function calling configuration (FunctionCallingConfigMode) should continue to be orchestrator-driven, not client-driven; the backend already configures tools for specialists.
  - MCP integration remains backend-side for the Researcher; no need to alter the client for MCP.
- Why this path:
  - Keeps contracts stable and contained (Zone Green/Yellow), avoids fragmenting orchestration logic.
  - Minimizes redundancy: we reuse a single stream endpoint and a single place for context optimization.
  - Delivers a “just works” UX: users pick a patient in the sidebar, type, and the system smartly injects relevant context without switching apps.
- Expected impact:
  - Faster time-to-value: minimal server changes, mostly client additions.
  - Increased routing precision: intent/entity detection can use patientId to bias toward relevant topics.
  - Lower support debt: no second chat stack and no parallel orchestration path.

1) Implementation Plan (Phased, safe evolution)

Phase 0 — SDK Verification (completed via context7)
- Confirm streaming, contents structure, function calling, tools, MCP support. Verified with context7.

Phase 1 — Client Data Model (Zone Green)
- Define PatientRecord for client-side storage (IndexedDB), modeled similarly to existing chat persistence:
  - id (string), displayName, demographics (optional), conditions/tags, notes, attachments meta (file refs), createdAt/updatedAt, summaryCache (compact textual summary), confidentiality flags.
- Build a PatientSummaryBuilder (client) to produce a compact, token-limited summary string from the PatientRecord (e.g., 800–1200 tokens).
- Persist in a dedicated “patients-store” (mirroring existing client context persistence patterns).

Phase 2 — Patient Library UI in Sidebar (Zone Green)
- Sidebar section “Patients”:
  - Create patient, list/search/filter, open patient.
  - “Start conversation” action opens a chat bound to patientId.
- Main view: minimal, elegant grid/list with search; avoid heavy modality switching—keep the main chat layout and just scope the session to a selected patient.

Phase 3 — Patient Chat (Client Composition) (Zone Green)
- New hook usePatientChatSession(patientId):
  - Retrieves PatientRecord from IndexedDB.
  - Builds patientContextSummary with PatientSummaryBuilder.
  - When the first user message is sent, compose Parts:
    - Part A: “[Patient Context Summary]\n<compact summary>”
    - Part B: “[User Instruction]\n<user message>”
  - Add an optional sessionMeta.patient to the payload:
    - { id, summaryHash (for change detection), version }
- Send to existing /api/send-message and rely on the current streaming UI to render the response.

Phase 4 — Orchestrator Enhancements (Minimal, Zone Yellow if needed)
- In <mcfile name="hopeai-system.ts" path="lib/hopeai-system.ts"></mcfile>:
  - If sessionMeta.patient is present, attach a patient_reference to the enrichedContext used by routers and context optimizers.
  - Ensure context-optimization-manager treats patient summary as “sticky” context for the session, but limits its token footprint.
- In <mcfile name="intelligent-intent-router.ts" path="lib/intelligent-intent-router.ts"></mcfile> and <mcfile name="entity-extraction-engine.ts" path="lib/entity-extraction-engine.ts"></mcfile>:
  - If patientId is present, bias entity extraction to prefer terms linked to the patient’s conditions/tags and avoid unrelated detours.
- In <mcfile name="clinical-agent-router.ts" path="lib/clinical-agent-router.ts"></mcfile>:
  - Maintain existing guardrails; if confidentiality flags exist, apply stronger filters to avoid accidental PII reproduction in non-essential replies.

Phase 5 — Observability and Guardrails (Zone Green)
- Metrics: tag Sentry spans with anonymized patient hash; add metrics for “patient-scoped conversations,” latency, and context retention.
- Privacy: mark patient sections of context as confidential where required; add Orchestrator check to avoid revealing unnecessary PII.
- Error pathways: degraded fallback behavior remains unchanged; if patient context fails to load, proceed with the default chat while notifying the user minimally.

Phase 6 — RAG Discipline for Researcher (Zone Green, no contract changes)
- Keep the strict RAG pipeline unchanged:
  - Retrieve first, inject retrieved evidence into prompt, generate based on retrieved content only.
- Ensure patient summary is treated as background context, never as an external “source” for factual claims; citations must originate from retrieval.
- Add source validation checks already used by the Researcher to prevent hallucinations.

6) Contracts and Specifications

Client payload for the first message (proposal, optional metadata)
- messageParts: The Parts array of the first user message:
  - Part 1: “[Patient Context Summary] …”
  - Part 2: “[User Instruction] …”
- sessionMeta (optional):
  - patient: { id: string; summaryHash: string; version: number }
Rationale:
- Keeps backend contract backward compatible (optional field).
- Enables the Orchestrator to link session context to patientId and optimize appropriately.

PatientRecord (client-side only, IndexedDB)
- id, displayName
- demographics?: { ageRange, gender, … }
- tags?: string[]
- notes?: string (clinician notes)
- attachments?: { id, name, type, uri/hash }[]
- summaryCache?: { text: string; version: number; updatedAt: ISOString }
- confidentiality?: { pii: boolean; redactionRules?: string[] }
- createdAt, updatedAt

First-message composition
- The client must assemble Parts so that the Orchestrator receives the patient context summary and user instruction as distinct but contiguous user Parts.
- Verified with context7: Passing Part[] or string[] results in a single Content with role='user' on the server side; this is ideal for our case. If we ever need function call parts, we would switch to explicit Content[]—not required for the first message here.

7) Orchestrator Injection Points and Context Management
- enrichedContext creation should include patient_reference when sessionMeta.patient is present so the following components can use it:
  - <mcfile name="intelligent-intent-router.ts" path="lib/intelligent-intent-router.ts"></mcfile>
  - <mcfile name="clinical-agent-router.ts" path="lib/clinical-agent-router.ts"></mcfile>
  - <mcfile name="context-optimization-manager.ts" path="lib/context-optimization-manager.ts"></mcfile>
- Sliding window should treat patient summary as pinned context at the start of the session and gradually compress it if the conversation grows.
- Avoid cross-patient leakage by scoping sessionId + patientId and clearing local streaming state when switching patients.

8) Grounding and RAG (Researcher Specialist)
- Retrieve → Augment → Generate must remain strictly enforced by the Researcher pipeline.
- Patient context summary is a “session backdrop” and must not be interpreted as citation-worthy external evidence.
- Ensure citation mapping continues to reference only retrieved sources; prevent model from “borrowing” patient text as a source.

9) Observability, Privacy, and Safety
- Add anonymized patient hash to metrics; ensure no raw PII leaves the client or logs.
- Sentry spans: record first-message composition latency, payload size, and downstream model latency; this supports future optimizations for large patient summaries.
- If confidentiality flags are set, add a back-end guardrail that trims or redacts patient details from responses unless explicitly needed to answer the query.

10) Acceptance Criteria and Rollout
- UX
  - Users can manage patients from the sidebar: create, search, select, start a conversation.
  - Starting a patient-scoped chat automatically seeds the first message with the patient summary + user instruction.
  - Conversation behaves like the current chat (streaming, agent indicators, markdown rendering).
- Reliability
  - No cross-patient context leakage; switching patients creates a fresh session scope.
  - Context token usage stays within bounds via sliding window and (optional) summary compression.
- RAG and Guardrails
  - Researcher continues to cite only retrieved sources.
  - No PII exposure unless clinically necessary and intended by user instruction.
- Observability
  - Metrics visible for patient-scoped sessions (latency, message volume, agent routing).
- Zones and Risk
  - Majority Green (client and UI). Limited Yellow in Orchestrator if we add patient_reference handling to enrichedContext.

SDK Guidance (verified with context7)
- Streaming interactions: implement via server orchestration using generateContentStream; keep client as a thin initiator for the first composed message and as a streaming consumer.
- Contents composition: use Part[] in the first user message to include [Patient Context Summary] and [User Instruction] distinctly while preserving a single user Content for the model.
- Function calling and tools: continue orchestrating at the back end; set FunctionCallingConfigMode in server where the agent policies and tool registries live.
- MCP: keep MCP integration in the backend for the Researcher specialist; the client does not need to be aware of MCP.
- Multimodal attachments: if/when needed later, use SDK utilities to attach URIs or base64 parts, but start with text-only summaries for minimal surface area and privacy.

Concrete next steps (no code, architectural handoff)
- Frontend
  - Define PatientRecord and PatientSummaryBuilder structures.
  - Implement IndexedDB store for patients mirroring chat history.
  - Add sidebar Patient Library UI and the “Start conversation” action per patient.
  - Implement the first-message composition (summary + user instruction) and pass optional sessionMeta.patient.
- Backend
  - In hopeai-system.ts, on presence of sessionMeta.patient, attach patient_reference in enrichedContext and flag context optimizer to pin the summary.
  - In intelligent-intent-router.ts/entity-extraction-engine.ts, consume patientId to slightly bias extraction and intent classification.
  - Add optional metrics and guardrails for confidentiality.

This plan achieves a clean, elegant, and seamless implementation: minimal server changes, a small set of client-side additions, and a first-message composition that unlocks patient-contextualized conversations while preserving our orchestrator’s strengths and best practices of the @google/genai SDK. Verified with context7, the current recommended practices for streaming, function calling, tool orchestration, and content structuring align with this design.
        