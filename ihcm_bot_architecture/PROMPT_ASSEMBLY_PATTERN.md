# Prompt Assembly Pattern

## Goal

Prevent generic answers by assembling context in layers instead of using one giant hardcoded system prompt.

## Core Principle

The bot should answer from:

1. role logic
2. building truth
3. current intelligence
4. workflow contract
5. user-provided facts

That order gives the assistant both consistency and local relevance.

## Runtime Context Stack

Assemble prompts in this order:

1. `global_core`
2. `role_module`
3. `building_profile`
4. `latest_building_snapshot`
5. `latest_building_intelligence_packet`
6. `workflow_template`
7. `conversation_messages`

Do not collapse these into one static string in source code.

## What Each Layer Should Do

### 1. Global core

Purpose:

- define IHCM identity
- define safe-use rules
- define no-PHI and no-fabrication behavior
- define general answer style

### 2. Role module

Purpose:

- tell the model how this role thinks
- define priorities and tradeoffs for the role

### 3. Building profile

Purpose:

- localize the answer to the selected building

Use structured fields, not just one paragraph:

- building identity
- state and payer context
- strategic label
- referral notes
- growth barriers
- growth opportunities
- known risks

### 4. Latest snapshot

Purpose:

- supply current operational numbers

Examples:

- census
- occupancy gap
- skilled mix
- payer pressure
- survey risk
- staffing risk

### 5. Latest intelligence packet

Purpose:

- tell the model what matters most right now

Examples:

- headline
- top risks
- top opportunities
- recommended next actions

### 6. Workflow template

Purpose:

- make outputs reliable for repeatable tasks

It should contain:

- required inputs
- follow-up questions if missing
- required sections
- prohibited shortcuts
- output format contract

### 7. Conversation

Purpose:

- use the user’s actual request and facts as the final local context

## Retrieval Priority

When selecting knowledge, use this order:

1. workflow-required inputs
2. user-supplied facts
3. building profile
4. latest building intelligence
5. role playbook chunks
6. reference docs
7. examples

Examples are valuable, but should not outrank current building facts.

## Recommended API Assembly Pattern

In `api/chat.js` or your future server layer:

1. identify `role`
2. identify `building_id`
3. identify optional `workflow_slug`
4. fetch `global_core`
5. fetch `role_module`
6. fetch `building_profile`
7. fetch latest `snapshot`
8. fetch latest `intelligence_packet`
9. fetch `workflow_template`
10. optionally retrieve top supporting knowledge chunks
11. compose final system prompt
12. send sanitized conversation history

## Suggested System Prompt Contract

Every final assembled prompt should include these rules:

- do not fabricate building facts
- if the building is selected, answer from that building first
- if no building is selected, answer generally and say what would change by building
- ask follow-up questions before drafting when required facts are missing
- label assumptions
- do not include or request resident-identifying information
- keep answers practical, prioritized, and action-oriented

## Best Workflow Design

Do not use one generic draft mode for everything.

Prefer:

- `draft_poc`
- `draft_appeal_letter`
- `draft_care_plan_entry`
- `draft_qapi_pdsa`
- `draft_board_memo`
- `draft_census_growth_plan`

Each should map to a specific workflow template and output contract.

## UI Recommendation

When a building is selected, show:

- building name
- strategic label
- context freshness date
- top 3 priorities

When a workflow is selected, show:

- required inputs
- missing inputs
- output type

This makes the widget feel like an operating assistant, not just a chatbot.
