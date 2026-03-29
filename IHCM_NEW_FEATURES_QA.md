# IHCM AI Bot — New Features QA Guide

**Date:** 2026-03-29 (late session)
**Latest commit:** ac12a4c (Add SWOT analysis upload)
**Test account:** testuser@indhcm.com (super_admin, all 7 roles)

---

## New Features Since Last QA Pass

### 1. Marketing Bot Role (NEW)
- **Tab:** Marketing (purple)
- **Purpose:** Census growth strategy, referral development, community outreach, SWOT analysis
- **System prompt:** Focuses on occupancy gaps, payer mix improvement, referral sources, competitive positioning
- **3 workflows:**
  - SWOT Analysis — generates Strengths/Weaknesses/Opportunities/Threats from building data
  - 90-Day Census Growth Plan — structured plan with month-by-month actions, referral targets, KPIs
  - Referral Development Plan — targeted referral source strategy with outreach actions

### 2. Therapy Bot Role (NEW)
- **Tab:** Therapy (green)
- **Purpose:** Section GG analysis, HIPPS code breakdown, CMI optimization, therapy progress/appeals
- **System prompt:** Includes full GG 6-level scoring reference, HIPPS code structure, quality measure connections (SO42, ADL, mobility)
- **4 workflows:**
  - HIPPS Code Analysis — break down 5 components, identify weakest, targeted education
  - Section GG Scoring Review — validate scores against functional description, flag overcoding/undercoding
  - CMI Optimization Report — find patients near tier thresholds, documentation targets
  - Therapy Progress / Appeal Support — 7-day comparison, measurable gains, appeal language

### 3. SWOT Upload (NEW)
- **Endpoint:** POST /api/ingest-swot
- **UI:** "Upload SWOT" button visible when Marketing, Admin, or Regional tab is active
- **Accepts:** PDF (.pdf), Word (.docx), or text files (.txt)
- **Behavior:**
  - Auto-detects building(s) from content using name matching
  - Splits multi-building documents into per-building knowledge sources
  - Stores as `corporate_playbook` with tags `[swot, marketing, strategy]`
  - Auto-approved (owner-provided content)
  - Building-scoped so the marketing bot references the right SWOT per building
- **DOCX parsing:** Uses jszip to extract text from Word documents

### 4. Parser Quality Improvements
- **Facility name:** Multi-pattern extraction + provider number → building name fallback map
- **F-tag validation:** Only F150-F999 accepted (removes F000 form noise)
- **Deduplication:** Keeps longest content version per F-tag
- **Severity extraction:** 5 patterns including proximity to Isolated/Pattern/Widespread
- **Form-text filtering:** Strips CMS boilerplate from deficient_practice and findings
- **Parse quality score:** Returns `parse_quality: good|partial|poor` with user-facing warning

### 5. Prompt Improvements
- **Chat mode:** "Lead with your best answer first using building context" — reduced unnecessary follow-up questions
- **Draft mode:** Explicit anti-placeholder instructions — "Use actual building name, CMS ID, date from context instead of [Insert Facility Name]"
- **Workflow mode:** Same anti-placeholder rules — "Produce 90% complete draft over asking clarifying questions"

### 6. Knowledge Approval Display
- Knowledge list now shows version number and "approved" label
- GET endpoint returns `current_version` and `approver_user_id`

---

## Test Plan for New Features

### Marketing Role
| Test | Expected | Pass/Fail |
|------|----------|-----------|
| Switch to Marketing tab | Purple tab appears, marketing starters shown | |
| Ask "What is the best census growth strategy for this building?" with Crossett selected | Building-specific answer using Crossett payer mix (79% Medicaid), MD referral gap, Stonegate coordination | |
| Ask "Who should I be building referral relationships with?" with Erie selected | References Erie's managed care position (20%), in-house dialysis, marketing team | |
| Open Draft Mode → select "SWOT Analysis" workflow | Form appears with Building Name input | |
| Submit SWOT workflow for Marymount | Structured SWOT output using real Marymount data (2-star, 234 beds, managed care 16%, reputation issues) | |
| Submit "90-Day Census Growth Plan" workflow for Crossett | Month-by-month plan with specific referral targets, Stonegate coordination, senior center marketing | |
| Submit "Referral Development Plan" for Glenwood | Strategy addressing cherry-pick referrals, NP relationships, centralized admissions | |

### Therapy Role
| Test | Expected | Pass/Fail |
|------|----------|-----------|
| Switch to Therapy tab | Green tab appears, therapy starters shown | |
| Ask "How should I score Section GG for a patient who needs hands-on assist with eating?" | References 6-level scale, recommends 03 (partial/moderate assistance), explains impact on PDPM | |
| Ask "Analyze this HIPPS code and tell me where the weak point is" (provide a sample code) | Breaks down 5 components, identifies weakest, suggests documentation targets | |
| Open Draft Mode → select "HIPPS Code Analysis" workflow | Form with HIPPS Code + Patient Summary inputs | |
| Submit HIPPS Analysis with code "4LJ20" and patient summary | Structured breakdown of all 5 components with revenue opportunity | |
| Submit "Section GG Scoring Review" with patient description | Per-item score recommendations with justification and quality measure impact | |
| Submit "CMI Optimization Report" | Component analysis with tier proximity and documentation targets | |
| Submit "Therapy Progress / Appeal Support" with functional data | Week-by-week comparison, measurable gains, appeal language | |

### SWOT Upload
| Test | Expected | Pass/Fail |
|------|----------|-----------|
| Switch to Marketing/Admin/Regional tab | "Upload SWOT" button visible in controls row | |
| Upload a PDF SWOT for one building | Button shows "SWOT saved (1 building)", content stored in knowledge_sources | |
| Upload a Word (.docx) SWOT | Parses successfully, same result | |
| Upload a multi-building SWOT document | Button shows "SWOT saved (N buildings)", separate entries per building | |
| After SWOT upload, ask Marketing bot about that building | Bot references SWOT content in its answer | |
| Verify in SQL: `SELECT title, status, tags FROM knowledge_sources WHERE tags @> '{"swot"}'` | Shows uploaded SWOTs as approved with correct facility_id | |
| Upload SWOT tab NOT visible when DON/MDS/Billing tab active | Button hidden for non-marketing roles | |

### Parser Quality
| Test | Expected | Pass/Fail |
|------|----------|-----------|
| Upload a CMS 2567 PDF | Facility name is actual building name (not "OR SUPPLIERSTREET ADDRESS") | |
| Check citations | No F000 entries in results | |
| Check severity | Fewer null scope_severity values than before | |
| Check deficient_practice text | No CMS form boilerplate (FORM CMS-2567, PREFIX TAG, etc.) | |
| API returns `parse_quality` field | Value is "good", "partial", or "poor" | |
| If partial/poor, `parse_warning` is present | Warning text advises user to verify | |

### Prompt Quality
| Test | Expected | Pass/Fail |
|------|----------|-----------|
| Ask a building-specific question in chat mode | Bot answers first using building context, doesn't ask for info it already has | |
| Request a draft document with a building selected | Draft uses actual building name and CMS ID, not [Insert Facility Name] | |
| Request a workflow draft with building context available | Document is 90%+ complete, minimal placeholders | |

### Knowledge Approval (Admin)
| Test | Expected | Pass/Fail |
|------|----------|-----------|
| Open Add Playbook, submit a draft | Appears in list as DRAFT with yellow badge | |
| Click Approve (as super_admin) | Changes to APPROVED with green badge, version increments | |
| Verify `knowledge_versions` row created | `SELECT * FROM knowledge_versions ORDER BY created_at DESC LIMIT 1` shows the approval | |
| Non-admin user tries to approve | Returns 403 "Only administrators can approve" | |
| Ask bot a question related to approved content | Bot references the approved knowledge source | |

---

## API Endpoints (New/Changed)

### POST /api/ingest-swot (NEW)
- **Auth:** JWT required
- **Input:** Multipart form (file + optional building_id) or JSON (content + building_id)
- **Accepts:** PDF, DOCX, DOC, TXT
- **Output:** `{ success: true, results: [{ building, title, status, source_id }] }`
- **Auto-detects buildings from text content**
- **Auto-approved as corporate_playbook**

### Knowledge retrieval (CHANGED)
- Marketing role now pulls: corporate_playbook, referral_intelligence, operator_practice
- Therapy role now pulls: corporate_playbook, payer_guidance, state_reimbursement, operator_practice

---

## Users (8 total + 1 test)

| Name | Email | Roles |
|------|-------|-------|
| Dov Braun | DBraun@indhcm.com | all 7 |
| Azra Nukicic | anukicic@indhcm.com | don, mds, admin, regional, marketing, therapy |
| Jeff Edwards | JEdwards@indhcm.com | don, mds, admin, regional, marketing, therapy |
| Lisa Kotora | lkotora@indhcm.com | regional, mds, therapy |
| Lauren Greenwood | lgreenwood@indhcm.com | mds, regional, don, therapy |
| Steven Isaac | SIsaac@indhcm.com | regional, admin, marketing |
| T Brown | tbrown@indhcm.com | mds, regional, don, therapy |
| Natasha Cowan | NCowan@indhcm.com | admin, regional, marketing, therapy |
| Kayla Blackburn | KBlackburn@indhcm.com | mds, don, regional, therapy |
| Test User | testuser@indhcm.com | all 7 (super_admin) |
