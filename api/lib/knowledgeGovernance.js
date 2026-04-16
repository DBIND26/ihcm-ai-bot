const REVIEWER_APP_ROLES = new Set(['super_admin', 'corporate_admin', 'knowledge_manager']);
const SUBMITTER_BOT_ROLES = new Set(['marketing', 'admin', 'regional']);

function startOfToday() {
  return new Date().toISOString().split('T')[0];
}

function addDays(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
}

function normalizeTags(tags = []) {
  return [...new Set(
    (Array.isArray(tags) ? tags : [])
      .map((tag) => String(tag || '').trim())
      .filter(Boolean)
  )];
}

function getReviewWindowDays(sourceType) {
  switch (sourceType) {
    case 'survey_template':
      return 90;
    case 'state_reimbursement':
    case 'payer_guidance':
      return 120;
    default:
      return 180;
  }
}

function buildIdentityQuery(query, facilityId, stateCode) {
  if (facilityId) query = query.eq('facility_id', facilityId);
  else query = query.is('facility_id', null);

  if (stateCode) query = query.eq('state_code', stateCode);
  else query = query.is('state_code', null);

  return query;
}

function mapKnowledgeStatusToReviewStatus(status) {
  switch (status) {
    case 'approved':
      return 'approved';
    case 'in_review':
      return 'in_review';
    case 'archived':
      return 'rejected';
    case 'draft':
    default:
      return 'pending';
  }
}

export function canSubmitKnowledge(profile = {}) {
  if (!profile?.app_role) return false;
  if (profile.app_role !== 'read_only') return true;

  return (profile.allowed_bot_roles || []).some((role) => SUBMITTER_BOT_ROLES.has(role));
}

export function canReviewKnowledge(profile = {}) {
  return REVIEWER_APP_ROLES.has(profile?.app_role);
}

export async function resolveKnowledgeScope({
  supabaseUser,
  buildingId = null,
  facilityId = null,
  stateCode = null,
}) {
  let query = supabaseUser
    .from('facilities')
    .select('facility_id, facility_code, facility_name, state_code')
    .limit(1);

  if (buildingId) {
    query = query.eq('facility_code', buildingId);
  } else if (facilityId) {
    query = query.eq('facility_id', facilityId);
  } else {
    return {
      facilityId: null,
      facilityCode: null,
      facilityName: null,
      stateCode: stateCode || null,
    };
  }

  const { data: facility, error } = await query.maybeSingle();
  if (error || !facility) {
    throw new Error('Selected building is unavailable or outside your access scope');
  }

  if (stateCode && stateCode !== facility.state_code) {
    throw new Error('state_code does not match the selected building');
  }

  return {
    facilityId: facility.facility_id,
    facilityCode: facility.facility_code,
    facilityName: facility.facility_name,
    stateCode: facility.state_code,
  };
}

export async function queueKnowledgeReview({
  supabase,
  sourceId,
  submittedBy,
  note,
  priority = 'normal',
}) {
  const activeStatuses = ['pending', 'in_review', 'deferred'];
  const { data: existingQueue } = await supabase
    .from('review_queue')
    .select('review_id')
    .eq('knowledge_source_id', sourceId)
    .in('status', activeStatuses)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = {
    item_type: 'knowledge_source',
    knowledge_source_id: sourceId,
    submitted_by: submittedBy,
    reviewer_id: null,
    status: 'pending',
    priority,
    notes: note,
    reviewed_at: null,
  };

  if (existingQueue?.review_id) {
    const { error } = await supabase
      .from('review_queue')
      .update(payload)
      .eq('review_id', existingQueue.review_id);

    if (error) throw new Error(`Failed to update review queue: ${error.message}`);
    return existingQueue.review_id;
  }

  const { data, error } = await supabase
    .from('review_queue')
    .insert(payload)
    .select('review_id')
    .single();

  if (error) {
    // uq_review_queue_active_knowledge_source can race with a concurrent submit;
    // retry as an update against whichever active row was just inserted.
    if (error.code === '23505') {
      const { data: raced } = await supabase
        .from('review_queue')
        .select('review_id')
        .eq('knowledge_source_id', sourceId)
        .in('status', activeStatuses)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (raced?.review_id) {
        const { error: updateError } = await supabase
          .from('review_queue')
          .update(payload)
          .eq('review_id', raced.review_id);
        if (updateError) throw new Error(`Failed to update review queue after race: ${updateError.message}`);
        return raced.review_id;
      }
    }
    throw new Error(`Failed to create review queue item: ${error.message}`);
  }
  return data.review_id;
}

export async function syncKnowledgeReviewDecision({
  supabase,
  sourceId,
  reviewerId,
  sourceStatus,
  note = null,
}) {
  const mappedStatus = mapKnowledgeStatusToReviewStatus(sourceStatus);
  const reviewedAt = ['approved', 'rejected'].includes(mappedStatus)
    ? new Date().toISOString()
    : null;

  const { data: queueItem } = await supabase
    .from('review_queue')
    .select('review_id')
    .eq('knowledge_source_id', sourceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = {
    item_type: 'knowledge_source',
    knowledge_source_id: sourceId,
    reviewer_id: reviewerId,
    status: mappedStatus,
    notes: note,
    reviewed_at: reviewedAt,
  };

  if (queueItem?.review_id) {
    const { error } = await supabase
      .from('review_queue')
      .update(payload)
      .eq('review_id', queueItem.review_id);
    if (error) throw new Error(`Failed to update review queue decision: ${error.message}`);
    return queueItem.review_id;
  }

  const { data, error } = await supabase
    .from('review_queue')
    .insert({
      ...payload,
      submitted_by: reviewerId,
      priority: 'normal',
    })
    .select('review_id')
    .single();

  if (error) throw new Error(`Failed to backfill review queue decision: ${error.message}`);
  return data.review_id;
}

export class ApprovedSourceOverwriteError extends Error {
  constructor(sourceId) {
    super('A knowledge source with this title, type, and scope is already approved. Contact a knowledge manager to submit an update, or change the title for a parallel draft.');
    this.name = 'ApprovedSourceOverwriteError';
    this.code = 'APPROVED_SOURCE_OVERWRITE';
    this.sourceId = sourceId;
  }
}

export async function upsertKnowledgeDraft({
  supabase,
  authUser,
  title,
  sourceType,
  facilityId = null,
  stateCode = null,
  region = null,
  tags = [],
  fullContent,
  citationText,
  contentHash,
  reviewNote,
  isReviewer = false,
}) {
  let identityQuery = supabase
    .from('knowledge_sources')
    .select('source_id, status, current_version, content_hash, approver_user_id, owner_user_id')
    .eq('title', title)
    .eq('source_type', sourceType);

  identityQuery = buildIdentityQuery(identityQuery, facilityId, stateCode);

  const { data: existing, error: lookupError } = await identityQuery.limit(1).maybeSingle();
  if (lookupError) throw new Error(`Failed to check existing knowledge source: ${lookupError.message}`);

  const draftPayload = {
    title,
    source_type: sourceType,
    owner_user_id: authUser.id,
    facility_id: facilityId,
    state_code: stateCode,
    region: region || null,
    tags: normalizeTags(tags),
    status: 'draft',
    effective_date: startOfToday(),
    review_due_date: addDays(getReviewWindowDays(sourceType)),
    citation_text: citationText,
    full_content: fullContent,
    content_hash: contentHash,
    approver_user_id: null,
    approved_at: null,
  };

  if (existing?.content_hash && existing.content_hash === contentHash) {
    // Already-approved unchanged content: do not re-queue; it's still live.
    if (existing.status === 'approved') {
      return {
        source: {
          source_id: existing.source_id,
          title,
          source_type: sourceType,
          status: existing.status,
        },
        changeType: 'already_exists',
        reviewQueued: false,
      };
    }

    await queueKnowledgeReview({
      supabase,
      sourceId: existing.source_id,
      submittedBy: authUser.id,
      note: reviewNote,
    });

    return {
      source: {
        source_id: existing.source_id,
        title,
        source_type: sourceType,
        status: existing.status,
      },
      changeType: 'already_exists',
      reviewQueued: true,
    };
  }

  if (existing?.source_id) {
    // Block non-reviewers from silently demoting a live approved source written
    // by someone else. Owners may keep editing their own drafts/approved docs.
    if (
      existing.status === 'approved'
      && !isReviewer
      && existing.owner_user_id !== authUser.id
    ) {
      throw new ApprovedSourceOverwriteError(existing.source_id);
    }

    const { data, error } = await supabase
      .from('knowledge_sources')
      .update(draftPayload)
      .eq('source_id', existing.source_id)
      .select('source_id, title, source_type, status, current_version')
      .single();

    if (error) throw new Error(`Failed to update knowledge source draft: ${error.message}`);

    await queueKnowledgeReview({
      supabase,
      sourceId: existing.source_id,
      submittedBy: authUser.id,
      note: reviewNote,
    });

    return {
      source: data,
      changeType: 'updated',
      reviewQueued: true,
    };
  }

  const { data, error } = await supabase
    .from('knowledge_sources')
    .insert(draftPayload)
    .select('source_id, title, source_type, status, current_version')
    .single();

  if (error) throw new Error(`Failed to create knowledge source draft: ${error.message}`);

  await queueKnowledgeReview({
    supabase,
    sourceId: data.source_id,
    submittedBy: authUser.id,
    note: reviewNote,
  });

  return {
    source: data,
    changeType: 'created',
    reviewQueued: true,
  };
}
