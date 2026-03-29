# IHCM Operating Intelligence Platform
## Brutal V2 Blueprint

Version: 2.0  
Audience: Founder, operators, product, engineering, QA, compliance, implementation  
Date: 2026-03-27

## 1. Executive Position

The current v1 document is a polished chatbot widget spec. It is not a serious operating platform spec.

If IHCM wants to become a 10x nursing home operator and use AI as a force multiplier, the product cannot be:

- a bundle of hard-coded prompts
- a browser-local memory toy
- a shared secret URL
- a UI-first build with governance as a later patch
- a bot that sounds smart but cannot show where its answer came from

V2 must shift from **chat widget** to **operating intelligence system**.

That means:

- secure identity and role-aware access from day one
- server-side memory and auditability from day one
- governed, versioned knowledge sources instead of prompt stuffing
- source-grounded answers for high-stakes workflows
- explicit safety boundaries for clinical, reimbursement, and survey use cases
- learning loops that improve the system over time

If those are absent, the platform will produce confidence without control, which is one of the most dangerous outcomes possible in SNF operations.

## 2. What We Are Actually Building

### Product definition

IHCM needs an internal operating intelligence platform that helps facility, regional, and central teams:

- get fast, role-relevant answers
- generate first-draft operating documents
- retrieve approved playbooks and policies
- compare facilities against goals and historical patterns
- capture institutional learning
- improve recommendations over time using governed feedback and outcomes

### Product thesis

The goal is not "five bots that answer questions."

The goal is:

**A secure internal system that turns IHCM's fragmented operational knowledge into fast, trustworthy, role-aware decision support.**

### Core use cases

The platform must support these workflows before it tries to feel delightful:

1. Clinical operations support
2. MDS and reimbursement guidance
3. Billing and denial workflow support
4. Survey and Plan of Correction drafting
5. Census growth and referral-development playbooks
6. Building-level performance review
7. Regional comparison and prioritization
8. Knowledge capture from successful operator behavior

## 3. Brutal Diagnosis of V1

### 3.1 What v1 got right

- It recognized the value of role-specific workflows.
- It tried to protect the API key.
- It documented UI behavior clearly.
- It created a starting QA discipline.
- It understood that building context changes answers materially.

Those are useful instincts. They are not enough.

### 3.2 What v1 got fundamentally wrong

#### A. It confused prompts with knowledge

Hard-coded system prompts and building context strings are not a knowledge system. They are static text blobs with no provenance, no freshness guarantees, no ownership, and no audit trail.

Result:

- facts drift
- users cannot trust what is current
- nobody knows who approved what
- answers become irreproducible

#### B. It treated memory as a UI feature instead of a platform capability

Browser-local history is not institutional memory. It is personal session residue.

Result:

- no cross-user learning
- no reusable intelligence
- no analytics
- no supervisor review
- no post-mortem on bad outputs
- no retention control

#### C. It treated access like a convenience problem instead of a risk problem

A shared internal URL is not access control. CORS is not authorization. localStorage is not acceptable storage for sensitive operating conversations on shared devices.

Result:

- weak accountability
- poor auditability
- high accidental disclosure risk
- no user-level policy enforcement

#### D. It over-invested in UI polish and under-invested in truth

Bubble styles, tab colors, and CSS behavior are not the hard part. In SNF, the hard part is whether the answer is safe, grounded, current, and appropriate for the user's role.

#### E. It lacked a learning system

There is no governed feedback, answer review, source promotion, or outcome tracking. So the product cannot compound.

#### F. It lacked a risk model

Not all questions are equal.

This platform will touch:

- clinical interpretation
- reimbursement optimization
- appeal strategy
- survey response language
- family communication
- market-growth playbooks

Those require different controls, disclaimers, and approval paths.

## 4. Design Principles for V2

These principles are mandatory. If a build decision conflicts with them, the build decision is wrong.

### 4.1 Platform first, widget second

The UI is an access layer. The product is the knowledge, policy, memory, retrieval, audit, and evaluation layer behind it.

### 4.2 Source-grounded over prompt-grounded

For high-stakes answers, the model must pull from governed sources and show the source basis.

### 4.3 Human accountability never disappears

The system may draft, recommend, summarize, and compare. It does not become the final clinical, reimbursement, or compliance decision-maker.

### 4.4 Role-aware by policy, not by vibe

The platform must know whether the user is an MDS nurse, DON, facility admin, regional leader, or central billing user and shape:

- allowed views
- available tools
- default workflows
- risk controls
- escalation rules

### 4.5 Memory must compound

The system should get better because IHCM uses it. Good answers, approved artifacts, resolved issues, and successful playbooks should become reusable assets.

### 4.6 Truth must beat fluency

If the system lacks enough information, it should say so, ask for required inputs, or offer a structured draft with assumptions clearly labeled.

### 4.7 Governance is part of product quality

Owner, approval date, refresh cadence, source type, retention policy, and change history are not paperwork. They are part of answer quality.

## 5. Scope of V2

### 5.1 In scope

- secure internal web app
- centralized server-side conversation storage
- role-based access control
- governed knowledge base
- retrieval-augmented answer generation
- draft generation with source grounding
- structured workflow templates for high-value use cases
- facility profile and performance context
- feedback and answer review loop
- analytics and audit logs
- evaluation suite with real operational scenarios

### 5.2 Explicitly out of scope for first production release

- broad autonomous agent actions in external systems
- real-time write-back to EHR or billing platforms
- uncontrolled long-running agents
- "AI can do everything" positioning
- external user access
- generic open-ended internet research inside the product

## 6. Product Architecture

### 6.1 System overview

The platform should have six layers:

1. Identity and access layer
2. Workflow and UI layer
3. Orchestration and policy layer
4. Knowledge and retrieval layer
5. Memory and analytics layer
6. Model and tool execution layer

### 6.2 Reference architecture

#### Frontend

- Internal web app
- Dashboard home, not just floating widget
- Chat workspace plus structured workflow forms
- Source panel showing citations and retrieved artifacts
- Draft preview with approval/export controls
- Building and region context selector with clear freshness metadata

#### Backend

- Auth provider
- API service layer
- Orchestrator service
- Retrieval service
- Evaluation service
- Audit/event pipeline

#### Data plane

- relational application database
- vector index for retrieval
- object storage for approved source documents
- event log for usage and feedback

#### Model layer

- primary LLM for answer synthesis and drafting
- optional secondary model for evaluation and guardrails
- deterministic rule engine for policy checks and workflow validation

## 7. Data and Knowledge Architecture

### 7.1 Knowledge is a product, not a blob

Create a governed knowledge base with explicit source classes:

- corporate playbooks
- building profiles
- state-specific reimbursement rules
- payer-specific process guidance
- survey history and POC templates
- referral-source intelligence
- operator-created best practices
- approved FAQs

Each knowledge item must have:

- `source_id`
- `title`
- `source_type`
- `owner`
- `approver`
- `effective_date`
- `review_due_date`
- `region`
- `state`
- `building_id` if applicable
- `tags`
- `status` (`draft`, `approved`, `archived`)
- `citation_text`
- `full_content`
- `embedding`
- `version`

### 7.2 Building profiles must be structured

Do not store building intelligence as freeform prompt text only.

Every building should have a structured profile including:

- building name
- CMS provider number
- market/state
- licensed beds
- current census
- target census
- skilled mix target
- key payer mix
- referral-source priorities
- current strategic priority
- current risk flags
- operating owner
- last refreshed date
- confidence level for each metric

Then generate a concise context summary from those fields at runtime.

### 7.3 Historical learning objects

The system must be able to store and retrieve:

- prior user questions
- approved answers
- edited drafts
- accepted playbooks
- building-specific lessons
- resolved denial patterns
- successful census interventions
- rejected or corrected outputs

Do not blindly feed raw history back to the model. Promote useful history into reviewed knowledge objects.

### 7.4 Knowledge freshness rules

Every source class needs refresh rules:

- building metrics: weekly or daily depending on feed maturity
- payer rules: upon change and scheduled monthly validation
- survey playbooks: after each major event and quarterly review
- operator best practices: reviewed before promotion to approved status

If a source is stale past threshold:

- the system flags it
- retrieved answers show freshness warning
- high-stakes workflows may block final drafting until review

## 8. Identity, Security, and Compliance Controls

### 8.1 Minimum acceptable baseline

Production cannot launch without:

- authenticated users
- unique user identity
- role assignment
- audit logs
- encrypted server-side storage
- rate limiting
- session timeout
- environment separation
- secrets management

### 8.2 User roles

Start with:

- Facility MDS
- DON / clinical leader
- Facility administrator
- Billing / RCM
- Regional operator
- Corporate admin
- Knowledge manager / reviewer

### 8.3 Data handling rules

The platform must define:

- what PHI may be entered
- whether PHI should be minimized or prohibited in specific workflows
- how long conversations are retained
- who can review conversation logs
- what gets redacted in analytics
- what gets exported and where

### 8.4 Auditability requirements

Every answer event should log:

- user id
- role
- timestamp
- workflow type
- building/region context
- sources retrieved
- model used
- system policy version
- answer id
- feedback status
- whether the draft was edited, exported, or approved

### 8.5 Safety controls by workflow

High-risk workflows require stricter controls:

- MDS reimbursement guidance
- denial/appeal guidance
- POC drafting
- clinical policy interpretation

For these:

- always display source basis
- require assumptions section
- show "review before use" banner
- log outputs for quality review
- provide structured intake before drafting

## 9. Product Experience

### 9.1 Replace five bots with one platform and role-specific workspaces

Do not build five separate personalities as the main UX.

Build:

- a shared platform shell
- role-aware home view
- workflow launcher
- chat and draft workspace
- source/citation drawer
- building performance context panel

Role-specific entry points are fine. Role-specific prompt silos are not.

### 9.2 Main screens

#### A. Home dashboard

Shows:

- recent workflows
- favorite tools
- building selector
- alerts on stale knowledge
- recommended follow-ups

#### B. Ask workspace

For fast Q&A with:

- response
- cited sources
- assumptions
- confidence/risk indicator
- follow-up suggestions

#### C. Draft workspace

For document generation with:

- structured intake form
- selected source basis
- generated draft
- editable output
- approval status
- export options

#### D. Building intelligence view

Shows:

- latest building profile
- recent trend notes
- strategic priorities
- relevant playbooks
- open issues

#### E. Knowledge admin view

For approved internal managers to:

- upload sources
- edit metadata
- approve/promote content
- review flagged answers
- monitor stale content

### 9.3 Structured workflows beat blank chat

For high-value tasks, do not start with "How can I help?"

Use guided workflows such as:

- Draft Plan of Correction
- Draft denial appeal
- Build 30/60/90 census growth plan
- Analyze building performance gap
- Prepare referral-source outreach plan
- Summarize survey risk pattern
- Compare two facilities and recommend focus

Each workflow should gather required inputs before generation.

## 10. Orchestration Model

### 10.1 Runtime flow

1. User selects workflow or enters question
2. System identifies role, building context, and risk level
3. Intake validator checks for required inputs
4. Retrieval service fetches approved relevant knowledge
5. Policy layer determines allowed response mode
6. LLM generates answer or draft using retrieved context
7. Output formatter adds citations, assumptions, warnings, and next steps
8. Event logger records the transaction
9. User feedback and edits are captured
10. Candidate learning objects are queued for review

### 10.2 Risk tiers

Every request should be classified:

- Tier 1: low-risk informational
- Tier 2: operational recommendation
- Tier 3: reimbursement/compliance sensitive
- Tier 4: high-risk clinical/compliance document drafting

Higher tiers require:

- stronger source grounding
- more structured inputs
- more visible caveats
- review-oriented UX

### 10.3 Response contract

The system should not return naked prose for important workflows.

Standard response sections:

- answer
- why this recommendation
- sources used
- assumptions
- missing information
- next best action

For drafts:

- draft document
- source basis
- assumptions to validate
- required reviewer

## 11. Knowledge Capture and Learning Loop

### 11.1 Feedback is mandatory

Every answer should support:

- useful / not useful
- correct / questionable
- saved for reuse
- needs review

### 11.2 Learning pipeline

When a user edits a generated draft or marks an answer as useful:

1. capture original output
2. capture final edited version
3. capture workflow metadata
4. capture outcome if known
5. send candidate to review queue

Nothing becomes reusable knowledge automatically without review.

### 11.3 Review queue

Knowledge managers should be able to review:

- high-performing answers
- corrected drafts
- repeated unanswered questions
- stale source dependencies
- unsafe or hallucinated outputs

Approved items can then be promoted into:

- FAQ entries
- workflow templates
- building playbooks
- payer guidance
- example outputs

## 12. Data Model

### 12.1 Core entities

Minimum entities:

- `users`
- `roles`
- `user_roles`
- `buildings`
- `regions`
- `building_metrics`
- `knowledge_sources`
- `knowledge_versions`
- `source_chunks`
- `conversations`
- `messages`
- `workflows`
- `workflow_runs`
- `draft_outputs`
- `feedback_events`
- `audit_events`
- `review_queue`
- `promoted_artifacts`

### 12.2 Important relationships

- A building has many metrics over time.
- A knowledge source has many versions.
- A workflow run has many messages and one or more outputs.
- An output can receive edits, feedback, and review decisions.
- A promoted artifact must link back to the originating workflow run and source basis.

### 12.3 Retention rules

Define retention up front for:

- user conversations
- generated drafts
- source uploads
- logs
- feedback

No "we will figure it out later."

## 13. Retrieval and Answer Quality

### 13.1 Retrieval strategy

Retrieve from:

- approved corporate sources
- approved building sources
- approved state/payer sources
- approved historical artifacts

Weighting should prefer:

- current approved material
- context-matched building/state
- higher quality reviewed artifacts

### 13.2 What not to retrieve

Do not retrieve:

- stale archived guidance unless explicitly requested
- unreviewed user chatter as authoritative source
- unrelated building context
- low-confidence artifacts for high-risk workflows

### 13.3 Source presentation

Users should see:

- source titles
- source dates
- source owner
- short supporting excerpts

That is how trust gets built.

### 13.4 When the system should refuse certainty

If needed data is missing or stale, the system should say:

- what is missing
- what assumptions it made if it proceeds
- whether review is strongly recommended

This is a feature, not weakness.

## 14. Workflow Specifications

### 14.1 Plan of Correction workflow

Required inputs:

- citation tag
- deficiency summary
- immediate jeopardy status if any
- current mitigation steps
- building
- date

Output:

- structured POC draft
- immediate action section
- root cause section
- systemic correction section
- monitoring plan
- responsible owner section
- assumptions/warnings section

Rules:

- must cite approved survey/quality sources when available
- must not present final legal/compliance certainty
- must log for review

### 14.2 Denial and appeal workflow

Required inputs:

- payer
- denial code/reason
- service dates
- authorization details
- supporting documentation status

Output:

- recommended next step
- appeal pathway
- evidence checklist
- draft appeal letter if requested

Rules:

- must distinguish rule-based facts from recommended tactics
- must surface state/payer-specific source basis

### 14.3 Census growth workflow

Required inputs:

- current census
- target census
- timeframe
- key referral constraints
- building context

Output:

- 30/60/90 plan
- priority referral actions
- discharge planner targets
- internal operating bottlenecks
- measurable weekly scorecard

Rules:

- should use building history and peer comparisons where available

### 14.4 Building comparison workflow

Output:

- comparative snapshot
- biggest gap
- urgency ranking
- why now
- next three operator actions

Rules:

- all metrics must show freshness date
- any missing metrics must be called out

## 15. Evaluation and QA

### 15.1 The new standard

A serious platform cannot be greenlit on UI checks plus ten canned prompts.

V2 evaluation must include:

- unit tests
- integration tests
- permissions tests
- retrieval quality tests
- prompt/policy regression tests
- workflow completion tests
- hallucination tests
- stale-data tests
- ambiguous-input tests
- red-team safety tests
- human acceptance tests by role

### 15.2 Eval dataset

Build an evaluation set with:

- at least 100 realistic SNF questions
- at least 30 high-risk workflow cases
- conflicting-data scenarios
- missing-data scenarios
- building-specific edge cases
- reimbursement edge cases
- survey/document drafting edge cases

### 15.3 Required scoring dimensions

For each eval, score:

- factual accuracy
- source grounding
- context relevance
- actionability
- safety
- appropriate uncertainty
- formatting compliance

### 15.4 Blockers

Production launch must halt if any of the following fail:

- unauthorized access possible
- retrieval returns wrong or stale source without warning
- high-risk workflow can produce uncited confident output
- audit logs are incomplete
- role restrictions are bypassable
- deleted or archived knowledge still drives answers

## 16. Metrics That Actually Matter

Do not optimize around "number of chats."

Track:

- weekly active users by role
- workflow completion rate
- answer usefulness rate
- citation click-through rate
- percent of outputs edited before use
- percent of outputs promoted to reusable knowledge
- time saved per workflow
- repeated unanswered question clusters
- stale source incidence
- unsafe output rate
- outcome-linked performance where measurable

### North-star metric

**Percent of high-value operator workflows completed with a useful, source-grounded output in under 5 minutes.**

## 17. Delivery Plan

### Phase 0: Foundation design

Deliverables:

- risk model
- data model
- source taxonomy
- workflow inventory
- security and retention policy
- acceptance metrics

Exit criteria:

- leadership alignment on what the product is and is not

### Phase 1: Trustworthy core platform

Build:

- auth
- RBAC
- backend API
- server-side storage
- source ingestion
- retrieval
- ask workspace
- cited answers
- basic feedback
- audit logging

Do not build:

- fancy personalities
- excessive theming
- gimmick UI flourishes

Exit criteria:

- trustworthy Q&A with citations for low and medium-risk workflows

### Phase 2: Structured high-value workflows

Build:

- POC drafting
- denial/appeal workflow
- census plan workflow
- building comparison workflow
- draft editing and export
- review queue

Exit criteria:

- at least three critical workflows materially better than status quo

### Phase 3: Learning engine

Build:

- artifact promotion
- best-answer reuse
- outcome feedback loops
- stale knowledge monitoring
- advanced analytics

Exit criteria:

- measurable compounding improvement from usage

### Phase 4: System integration

Build carefully:

- source feeds from operational systems
- scorecard refresh jobs
- more automated context assembly

Exit criteria:

- higher freshness without losing governance

## 18. Recommended Technical Stack

The exact vendors can change. The shape should not.

### Application

- React or Next.js frontend
- typed backend service
- relational database
- object storage
- vector retrieval layer

### Supporting systems

- auth provider with RBAC
- analytics/event pipeline
- job runner for ingestion and refresh
- observability/logging

### Important note

Pick boring, reliable infrastructure over cleverness. The differentiator is the operating intelligence model, not the frontend animation library.

## 19. Team and Ownership Model

This product needs named owners, not just builders.

### Required owners

- product owner
- engineering owner
- security/compliance reviewer
- knowledge manager
- clinical domain reviewer
- RCM/billing reviewer
- regional operations reviewer

### Why this matters

If ownership is vague, source quality decays, review queues clog, and the product turns into a hallucination amplifier with nice branding.

## 20. Non-Negotiable Go/No-Go Gate

The platform does not launch broadly unless all are true:

1. Auth and RBAC are live.
2. All high-risk workflows show source basis and assumptions.
3. Server-side logging and audit trails are complete.
4. Data retention and review access are defined.
5. Building context is generated from structured current data, not only hand-written prompt text.
6. Feedback and review queue exist.
7. Evaluation passes on realistic role-based scenarios.
8. There is a named owner for each critical knowledge domain.

If any one of these is false, broad rollout is premature.

## 21. What To Keep from V1

Do not throw away everything.

Keep:

- focus on concrete operator workflows
- role sensitivity
- desire for fast answers and drafts
- bias toward implementation detail
- early QA mindset

But move those into a platform that deserves user trust.

## 22. Immediate Next Moves

### Next document to produce

Turn this blueprint into three follow-on specs:

1. Product requirements document
2. Technical architecture spec
3. Workflow and evaluation spec

### First build sequence

1. Define roles, workflows, and risk tiers
2. Design core data model and knowledge taxonomy
3. Stand up auth, storage, and audit layer
4. Implement source ingestion and retrieval
5. Launch cited ask workspace
6. Add structured draft workflows
7. Add review queue and learning pipeline

### What to stop doing immediately

- stop treating prompt-writing as the main intelligence strategy
- stop treating localStorage as memory
- stop treating CORS as security
- stop treating "sounds good" as quality
- stop assuming UI polish equals readiness

## 23. Final Standard

The right question is not:

"Can we ship a useful bot widget fast?"

The right question is:

"Can we build a system that our best operators trust enough to use in the middle of high-consequence work, and that gets better because they use it?"

That is the standard for V2.
