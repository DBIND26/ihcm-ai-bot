# Knowledge Base Structure

## Goal

Build the widget so it answers with:

- role-specific judgment
- building-specific context
- current operational intelligence
- safe drafting behavior

The knowledge base should not be one pile of documents. It should be split into four layers.

## The Four Knowledge Layers

### 1. Core IHCM truth

This is stable organization-wide context.

Examples:

- company goals
- operating philosophy
- safe-use rules
- role expectations
- standard drafting rules

### 2. Role playbooks

This is how each role thinks and what strong execution looks like.

Roles:

- regional
- administrator
- don
- mds
- billing

### 3. Building profiles

This is the static and semi-static truth for each building.

Examples:

- building identity
- strategic posture
- referral relationships
- market context
- recurring barriers

### 4. Operational intelligence

This is what changed recently and what matters now.

Examples:

- census pressure
- survey risk
- reimbursement issues
- staffing concerns
- turnaround urgency
- top 3 priorities this week

## Recommended Folder Tree

```text
knowledge_base/
  01_core_ihcm/
    001_ihcm_operating_context.md
    002_ihcm_safe_use_policy.md
    003_ihcm_response_standards.md
    004_ihcm_growth_strategy_2026.md
    005_ihcm_quality_and_compliance_principles.md

  02_role_playbooks/
    regional/
      001_regional_role_playbook.md
      002_regional_building_comparison_framework.md
      003_regional_turnaround_framework.md
    administrator/
      001_administrator_role_playbook.md
      002_administrator_census_growth_framework.md
      003_administrator_referral_development_framework.md
    don/
      001_don_role_playbook.md
      002_don_plan_of_correction_framework.md
      003_don_staff_education_framework.md
      004_don_qapi_framework.md
    mds/
      001_mds_role_playbook.md
      002_mds_pdpm_framework.md
      003_mds_section_gg_framework.md
      004_mds_skilled_documentation_framework.md
    billing/
      001_billing_role_playbook.md
      002_billing_denial_management_framework.md
      003_billing_appeals_framework.md
      004_billing_managed_care_auth_framework.md

  03_workflow_templates/
    001_plan_of_correction_template.md
    002_staff_education_plan_template.md
    003_appeal_letter_template.md
    004_care_plan_entry_template.md
    005_qapi_pdsa_template.md
    006_census_growth_plan_template.md
    007_referral_action_plan_template.md
    008_board_memo_template.md
    009_building_comparison_brief_template.md
    010_skilled_documentation_check_template.md

  04_building_profiles/
    001_building_profile_schema.md
    arkadelphia/
      001_building_profile.md
      002_referral_relationship_map.md
      003_market_and_growth_barriers.md
    stonegate/
      001_building_profile.md
      002_referral_relationship_map.md
      003_market_and_growth_barriers.md
    glenwood/
      001_building_profile.md
      002_referral_relationship_map.md
      003_market_and_growth_barriers.md
    thewoods/
      001_building_profile.md
      002_referral_relationship_map.md
      003_market_and_growth_barriers.md
    crossett/
      001_building_profile.md
      002_referral_relationship_map.md
      003_market_and_growth_barriers.md
    marymount/
      001_building_profile.md
      002_referral_relationship_map.md
      003_market_and_growth_barriers.md
    erie/
      001_building_profile.md
      002_referral_relationship_map.md
      003_market_and_growth_barriers.md

  05_reference_guides/
    state_payer/
      001_arkansas_medicaid_ltc_guide.md
      002_ohio_medicaid_mycare_passport_guide.md
      003_pennsylvania_promise_guide.md
    reimbursement/
      001_common_denial_codes_guide.md
      002_835_remittance_guide.md
      003_managed_care_appeals_guide.md
    mds_clinical/
      001_pdpm_quick_reference.md
      002_section_gg_quick_reference.md
      003_nta_coding_guide.md
      004_ard_timing_guide.md
      005_skilled_documentation_standards.md
    compliance/
      001_common_f_tags_guide.md
      002_plan_of_correction_principles.md
      003_qapi_basics_guide.md
    growth/
      001_referral_growth_playbook.md
      002_discharge_planner_outreach_guide.md
      003_turnaround_building_playbook.md
      004_model_building_best_practices.md

  06_examples/
    pocs/
      001_f689_plan_of_correction_example.md
      002_f689_staff_education_example.md
    appeals/
      001_medicare_noncoverage_appeal_example.md
      002_managed_care_auth_cut_appeal_example.md
    care_plans/
      001_care_plan_entry_example_fall_risk.md
      002_care_plan_entry_example_adl_decline.md
    regional/
      001_turnaround_memo_example.md
      002_ohio_vent_unit_board_memo_example.md
    admin/
      001_60_day_census_recovery_plan_example.md
      002_referral_repair_plan_example.md

  07_intelligence/
    schemas/
      001_building_snapshot_schema.md
      002_building_intelligence_packet_schema.md
    generated/
      arkadelphia/
      stonegate/
      glenwood/
      thewoods/
      crossett/
      marymount/
      erie/
```

## Which Parts Should Be Static vs Dynamic

### Static or slow-moving

- core IHCM docs
- role playbooks
- workflow templates
- building profiles
- reference guides
- example outputs

### Dynamic or frequently updated

- census snapshot
- skilled mix status
- payer pressure
- referral changes
- survey watch items
- top risks and opportunities
- recommended next actions

Dynamic data belongs in the intelligence layer, not in the permanent role prompts.

## Required Metadata For Every Document

Every knowledge document should have:

- `title`
- `doc_type`
- `audience`
- `role_scope`
- `building_scope`
- `state_scope`
- `status`
- `owner`
- `last_updated_at`
- `approved_by`
- `tags`

## Best Practice For Building-Specific Design

Do not make seven copies of the entire bot.

Instead:

- one role engine per role
- one structured building profile per building
- one current intelligence packet per building
- one workflow template per task type

That architecture scales much better and stays easier to maintain.
