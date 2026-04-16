import { createHash } from 'node:crypto';

import {
  getFileExtension,
  getMimeTypeForExtension,
  sanitizeFileName,
} from './documentUpload.js';

const KNOWLEDGE_UPLOAD_BUCKET = 'knowledge-uploads';

export async function storeKnowledgeAsset({
  supabase,
  authUser,
  sourceId,
  fileBuffer,
  fileName,
  mimeType = null,
  extractedText = '',
  parserUsed = null,
}) {
  const ext = getFileExtension(fileName, mimeType);
  const normalizedMimeType = mimeType || getMimeTypeForExtension(ext);
  const safeName = sanitizeFileName(fileName);
  const storagePath = `${sourceId}/${Date.now()}-${safeName}`;
  const sha256 = createHash('sha256').update(fileBuffer).digest('hex');

  const { error: uploadError } = await supabase.storage
    .from(KNOWLEDGE_UPLOAD_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: normalizedMimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to store uploaded file: ${uploadError.message}`);
  }

  const { data, error } = await supabase
    .from('knowledge_assets')
    .insert({
      source_id: sourceId,
      storage_bucket: KNOWLEDGE_UPLOAD_BUCKET,
      storage_path: storagePath,
      original_filename: fileName,
      mime_type: normalizedMimeType,
      file_ext: ext || null,
      size_bytes: fileBuffer.length,
      sha256,
      extracted_text: extractedText || null,
      extraction_status: extractedText ? 'completed' : 'failed',
      parser_used: parserUsed,
      created_by: authUser.id,
    })
    .select('asset_id, storage_path')
    .single();

  if (error) {
    throw new Error(`Failed to save knowledge asset metadata: ${error.message}`);
  }

  return data;
}
