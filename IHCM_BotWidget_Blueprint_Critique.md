# IHCM AI Bot Widget Blueprint Review

## Overall Assessment

This is a strong v1 blueprint. It is unusually clear for a handoff doc, the QA matrix is concrete, and the product scope is focused enough to ship.

The biggest issue is not UI polish or code structure. It is safety and operational control. The current blueprint is good at specifying what the widget does, but it is still under-specified in the areas that matter most for a tool used by regional leaders, administrators, DONs, and MDS teams:

- PHI and privacy handling
- trust and misuse controls
- output reliability for regulated workflows
- role-specific workflow depth beyond open-ended chat
- governance for building context freshness and answer quality

If you want the best possible widget for real field use, those should be upgraded before broad rollout.

## What Is Strong

- The file inventory is crisp and reviewable.
- The request lifecycle is explicit and easy to verify.
- The bot, building, and draft mode behaviors are defined concretely.
- The QA suite is better than average and covers security, functional behavior, memory, and domain quality.
- The product avoids premature complexity like live integrations and server-side persistence.

## Highest-Priority Findings

### 1. Privacy risk is too high for a clinical and operational audience

The blueprint explicitly allows no authentication and browser-local persistence across sessions. That is convenient, but it is risky for a workforce that may include shared workstations, PHI-adjacent drafting, and sensitive reimbursement or survey content.

Why this matters:

- administrators, DONs, and MDS staff will naturally paste sensitive real-world details into the widget
- localStorage persists indefinitely unless manually cleared
- URL-based sharing is not real access control
- CORS is not authentication

What to change:

- add authentication before wider rollout, even if lightweight
- add a visible "Do not include resident identifiers" warning above the input
- add auto-expiration for local history
- add a one-click "private session" mode using session-only memory
- add idle timeout and automatic local history purge on shared devices

### 2. CORS is being treated like a security boundary, but it is not one

The security section is strong on API key secrecy, but the blueprint overweights CORS and underweights abuse prevention. An unauthenticated public endpoint can still be hit outside the browser.

Why this matters:

- anyone with the URL can attempt direct requests
- CORS blocks browsers, not non-browser clients
- an internal link can still leak

What to change:

- require authentication or a signed session token for `/api/chat`
- add server-side rate limiting
- add request size limits and abuse throttling by IP or session
- add origin and referer checks as secondary controls, not primary ones

### 3. The blueprint does not define safe-use boundaries tightly enough

The widget will draft Plans of Correction, appeal letters, care plan entries, and board memos. Those are high-consequence outputs. The spec needs stronger guardrails around what the bots must do when context is incomplete or risky.

Why this matters:

- a convincing wrong draft is more dangerous than a short answer
- the current quality tests mostly check for relevance, not failure behavior
- staff need the bot to ask for missing facts instead of improvising

What to change:

- add a required response rule: if facts are missing, the bot must ask targeted follow-up questions before drafting
- require "review before use" language on regulated outputs
- define red-flag topics that require escalation language
- add refusal and uncertainty patterns to every system prompt

### 4. The design is still too chat-first for real workflow reliability

Open-ended chat is flexible, but your highest-value use cases are structured:

- POCs
- appeal letters
- care plan documentation
- census growth plans
- board memos

Those are better when the user is guided through required inputs first.

What to change:

- add per-bot guided forms for the top 3 workflows
- use templates with required fields before generation
- allow chat after the intake, not instead of the intake

### 5. Building context will drift quickly if it lives only in code

The building model is thoughtful, but it is static. Census, payer nuance, referral issues, turnaround status, and leadership notes will change.

Why this matters:

- stale context will make the bots less trusted
- users will not know whether a response used current or old assumptions

What to change:

- add `last_updated` and `owner` metadata for each building context
- display a "context updated" timestamp in the UI
- define who owns context refreshes and how often
- move building context to a managed config source as soon as possible

## Medium-Priority Findings

### 6. Draft mode is under-specified for document quality

Increasing `max_tokens` is not enough by itself. Draft quality depends on structure, required sections, and output validation.

What to change:

- define output schemas for each document type
- require section headers and checklist fields
- distinguish draft types instead of one generic draft suffix

### 7. The quality tests are too output-specific and may be flaky

Several pass criteria depend on the model mentioning specific phrasing. That is useful for spot checks, but brittle for ongoing QA.

What to change:

- score outputs with a rubric instead of exact wording
- separate factual correctness from style
- add negative tests where the correct behavior is "ask for more detail"

### 8. There is no explicit hallucination control strategy

The building selector grounds the model, but the blueprint does not define how the bot should behave when asked beyond its known context.

What to change:

- require the bot to label assumptions clearly
- require "I do not know" behavior when data is not provided
- add tests for invented payer rules, invented census data, and invented citations

### 9. Observability is too thin

Vercel logs are not enough for a production-support tool used by multiple regions and disciplines.

What to change:

- add structured server logs with request IDs
- track response latency, error rate, and draft mode usage
- store metadata only if you want to stay out of server-side content retention

### 10. Accessibility is missing from the QA blueprint

The document is strong on visual QA but light on accessibility and keyboard behavior.

What to change:

- add focus order tests
- add screen-reader labels for tabs, toggle, building selector, and copy button
- verify color contrast for all bot colors and the amber draft state

## Product Recommendations By Role

### Regional team

- prioritize comparative views, turnaround prompts, and executive summary outputs
- add a "compare two buildings" helper flow

### Administrators

- prioritize census playbooks, referral plans, survey prep, and board-ready memos
- add structured prompts for 30/60/90-day census plans

### DONs

- prioritize POCs, staff education drafts, incident follow-up plans, and QAPI support
- add compliance-sensitive templates with required fields

### MDS

- prioritize PDPM, Section GG, NTA timing, skilled documentation, and audit support
- add guided clinical documentation prompts that force missing data checks

## Best v1.1 Upgrades

If you only make a few changes before rollout, make these:

1. Add lightweight auth and a private-session mode.
2. Add a visible no-PHI warning and local-history expiration.
3. Add server-side rate limiting and better abuse controls.
4. Add required follow-up-question behavior before drafting high-risk documents.
5. Add building context ownership plus freshness timestamps.
6. Add at least one structured workflow per core role.

## Best Phase 2 Upgrades

- managed building context admin panel
- feedback and outcome tracking
- server-side session storage with proper retention controls
- guided document builders
- streaming responses
- optional source-linked knowledge base

## Bottom Line

The blueprint is good enough to build a solid internal demo and a controlled pilot.

It is not yet the best possible operational tool for regional leaders, administrators, DONs, and MDS teams because the safety model, reliability model, and workflow design are still lighter than the use cases require.

If you tighten privacy, move key workflows from pure chat to guided drafting, and add explicit failure-mode behavior, this can become a very strong product.
