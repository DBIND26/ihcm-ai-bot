import JSZip from 'jszip';
import pdf from 'pdf-parse/lib/pdf-parse.js';

export const MAX_DOCUMENT_UPLOAD_BYTES = 20 * 1024 * 1024;

const SUPPORTED_MIME_BY_EXT = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
};

function decodeXmlEntities(value = '') {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#10;/g, '\n')
    .replace(/&#13;/g, '\r');
}

function stripXmlMarkup(xml = '') {
  return decodeXmlEntities(
    xml
      .replace(/<w:p[^>]*>/g, '\n')
      .replace(/<w:br[^>]*>/g, '\n')
      .replace(/<w:tab[^>]*>/g, '\t')
      .replace(/<\/?[^>]+>/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
  ).trim();
}

function extractAllTaggedText(xml = '', tagPattern) {
  const matches = [];
  let match;
  while ((match = tagPattern.exec(xml)) !== null) {
    matches.push(decodeXmlEntities(match[1] || ''));
  }
  return matches;
}

function getSafeSheetLabel(fileName) {
  const match = fileName.match(/sheet(\d+)\.xml$/i);
  return match ? `Sheet ${match[1]}` : fileName;
}

function parseSharedStrings(sharedStringsXml = '') {
  const strings = [];
  const itemPattern = /<si\b[\s\S]*?>([\s\S]*?)<\/si>/gi;
  let itemMatch;

  while ((itemMatch = itemPattern.exec(sharedStringsXml)) !== null) {
    const textParts = extractAllTaggedText(itemMatch[1], /<t[^>]*>([\s\S]*?)<\/t>/gi);
    strings.push(textParts.join(''));
  }

  return strings;
}

function extractSpreadsheetCellValue(cellXml, attrs = '', sharedStrings = []) {
  const inlineText = extractAllTaggedText(cellXml, /<t[^>]*>([\s\S]*?)<\/t>/gi).join('');
  const rawValue = cellXml.match(/<v>([\s\S]*?)<\/v>/i)?.[1] || inlineText;
  const cellType = attrs.match(/\bt="([^"]+)"/i)?.[1] || '';

  if (!rawValue) return '';
  if (cellType === 's') {
    const index = Number.parseInt(rawValue, 10);
    return Number.isInteger(index) ? (sharedStrings[index] || '') : '';
  }
  if (cellType === 'b') {
    return rawValue === '1' ? 'TRUE' : 'FALSE';
  }

  return decodeXmlEntities(rawValue);
}

async function extractDocxText(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const xmlParts = [];

  const coreFiles = ['word/document.xml'];
  const optionalPrefixes = ['word/header', 'word/footer'];

  for (const fileName of coreFiles) {
    const file = zip.file(fileName);
    if (file) xmlParts.push(await file.async('text'));
  }

  zip.forEach((relativePath, file) => {
    if (optionalPrefixes.some((prefix) => relativePath.startsWith(prefix) && relativePath.endsWith('.xml'))) {
      xmlParts.push(file.async('text'));
    }
  });

  const resolved = await Promise.all(xmlParts);
  return stripXmlMarkup(resolved.join('\n'));
}

async function extractXlsxText(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const sharedStringsXml = await zip.file('xl/sharedStrings.xml')?.async('text');
  const sharedStrings = parseSharedStrings(sharedStringsXml || '');
  const worksheets = [];

  zip.forEach((relativePath, file) => {
    if (/^xl\/worksheets\/sheet\d+\.xml$/i.test(relativePath)) {
      worksheets.push({ path: relativePath, promise: file.async('text') });
    }
  });

  worksheets.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
  const resolvedSheets = await Promise.all(
    worksheets.map(async (sheet) => ({
      label: getSafeSheetLabel(sheet.path),
      xml: await sheet.promise,
    }))
  );

  const sections = [];
  for (const sheet of resolvedSheets) {
    const rows = [];
    const rowPattern = /<row\b[^>]*>([\s\S]*?)<\/row>/gi;
    let rowMatch;

    while ((rowMatch = rowPattern.exec(sheet.xml)) !== null) {
      const cellValues = [];
      const cellPattern = /<c\b([^>]*)>([\s\S]*?)<\/c>/gi;
      let cellMatch;

      while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
        const value = extractSpreadsheetCellValue(cellMatch[2], cellMatch[1], sharedStrings).trim();
        if (value) cellValues.push(value);
      }

      if (cellValues.length) rows.push(cellValues.join('\t'));
    }

    if (rows.length) {
      sections.push(`=== ${sheet.label} ===\n${rows.join('\n')}`);
    }
  }

  return sections.join('\n\n').trim();
}

async function extractPptxText(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const slides = [];

  zip.forEach((relativePath, file) => {
    if (/^ppt\/slides\/slide\d+\.xml$/i.test(relativePath)) {
      slides.push({ path: relativePath, promise: file.async('text') });
    }
  });

  slides.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
  const resolvedSlides = await Promise.all(
    slides.map(async (slide) => ({
      path: slide.path,
      xml: await slide.promise,
    }))
  );

  const sections = [];
  for (const slide of resolvedSlides) {
    const texts = extractAllTaggedText(slide.xml, /<a:t[^>]*>([\s\S]*?)<\/a:t>/gi)
      .map((value) => value.trim())
      .filter(Boolean);
    if (!texts.length) continue;

    const number = slide.path.match(/slide(\d+)\.xml$/i)?.[1] || '?';
    sections.push(`=== Slide ${number} ===\n${texts.join('\n')}`);
  }

  return sections.join('\n\n').trim();
}

export function getFileExtension(fileName = '', mimeType = '') {
  const normalized = String(fileName || '').toLowerCase();
  const lastDot = normalized.lastIndexOf('.');
  if (lastDot >= 0) return normalized.slice(lastDot + 1);

  const mimeMatch = Object.entries(SUPPORTED_MIME_BY_EXT).find(([, type]) => type === mimeType);
  return mimeMatch?.[0] || '';
}

export function getMimeTypeForExtension(ext = '') {
  return SUPPORTED_MIME_BY_EXT[String(ext || '').toLowerCase()] || 'application/octet-stream';
}

export function isSupportedDocumentExtension(ext = '') {
  return Object.prototype.hasOwnProperty.call(SUPPORTED_MIME_BY_EXT, String(ext || '').toLowerCase());
}

export function sanitizeFileName(fileName = 'upload') {
  return String(fileName || 'upload')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'upload';
}

export function parseMultipartForm(rawBody, contentType) {
  const boundaryMatch = contentType.match(/boundary=(.+?)(?:;|$)/i);
  if (!boundaryMatch) {
    return { fields: {}, fileBuffer: null, fileName: null, mimeType: null };
  }

  const boundary = boundaryMatch[1].trim().replace(/^"|"$/g, '');
  const boundaryBuf = Buffer.from(`--${boundary}`);
  const sep = Buffer.from('\r\n\r\n');

  const fields = {};
  let fileBuffer = null;
  let fileName = null;
  let mimeType = null;
  let position = 0;

  while (position < rawBody.length) {
    const start = rawBody.indexOf(boundaryBuf, position);
    if (start === -1) break;

    const nextStart = rawBody.indexOf(boundaryBuf, start + boundaryBuf.length);
    if (nextStart === -1) break;

    const part = rawBody.slice(start + boundaryBuf.length, nextStart);
    const headerEnd = part.indexOf(sep);
    if (headerEnd === -1) {
      position = nextStart;
      continue;
    }

    const header = part.slice(0, headerEnd).toString('utf8');
    const nameMatch = header.match(/name="([^"]+)"/i);
    if (!nameMatch) {
      position = nextStart;
      continue;
    }

    let body = part.slice(headerEnd + sep.length);
    if (body.length >= 2 && body[body.length - 2] === 0x0d && body[body.length - 1] === 0x0a) {
      body = body.slice(0, -2);
    }

    if (/filename=/i.test(header)) {
      fileBuffer = body;
      fileName = header.match(/filename="([^"]*)"/i)?.[1] || 'upload';
      mimeType = header.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || null;
    } else {
      fields[nameMatch[1]] = body.toString('utf8').trim();
    }

    position = nextStart;
  }

  return { fields, fileBuffer, fileName, mimeType };
}

export async function extractTextFromDocument({ buffer, fileName, mimeType }) {
  const ext = getFileExtension(fileName, mimeType);
  if (!isSupportedDocumentExtension(ext)) {
    throw new Error(`Unsupported document type: ${fileName || mimeType || 'unknown file'}`);
  }

  switch (ext) {
    case 'pdf': {
      const data = await pdf(buffer);
      return {
        text: (data.text || '').trim(),
        parser: 'pdf-parse',
        normalizedMimeType: getMimeTypeForExtension(ext),
      };
    }
    case 'docx':
      return {
        text: await extractDocxText(buffer),
        parser: 'jszip-docx',
        normalizedMimeType: getMimeTypeForExtension(ext),
      };
    case 'xlsx':
      return {
        text: await extractXlsxText(buffer),
        parser: 'jszip-xlsx',
        normalizedMimeType: getMimeTypeForExtension(ext),
      };
    case 'pptx':
      return {
        text: await extractPptxText(buffer),
        parser: 'jszip-pptx',
        normalizedMimeType: getMimeTypeForExtension(ext),
      };
    case 'txt':
    case 'csv':
      return {
        text: buffer.toString('utf8').trim(),
        parser: ext === 'csv' ? 'plain-text-csv' : 'plain-text',
        normalizedMimeType: getMimeTypeForExtension(ext),
      };
    default:
      throw new Error(`Unsupported document type: ${ext}`);
  }
}
