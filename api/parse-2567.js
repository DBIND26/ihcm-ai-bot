// ============================================================================
// 2567 PDF Parser API — POST /api/parse-2567
// ============================================================================
// Pure JavaScript implementation — no Python dependency.
// Uses pdf-parse for text extraction, then regex-based citation parsing.
//
import { requireAuth } from './lib/requireAuth.js';
import pdf from 'pdf-parse/lib/pdf-parse.js';

const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20 MB

// ── Common F-tag descriptions ──
const COMMON_TAGS = {
  F550: "Resident Rights/Exercise of Rights",
  F600: "Free from Abuse and Neglect",
  F609: "Reporting of Alleged Violations",
  F610: "Investigate/Prevent/Correct Alleged Violation",
  F623: "Notice Requirements Before Transfer/Discharge",
  F625: "Notice of Bed Hold Policy Before/Upon Transfer",
  F641: "Accuracy of Assessments",
  F656: "Develop/Implement Comprehensive Care Plan",
  F657: "Care Plan Timing and Revision",
  F658: "Services Provided Meet Professional Standards",
  F677: "ADL Care Provided for Dependent Residents",
  F684: "Quality of Care",
  F686: "Treatment/Services to Prevent/Heal Pressure Ulcers",
  F688: "Increase/Prevent Decrease in ROM/Mobility",
  F689: "Free of Accident Hazards/Supervision/Devices",
  F690: "Bowel/Bladder Incontinence, Catheter, UTI",
  F692: "Nutrition/Hydration Status Maintenance",
  F693: "Tube Feeding Management/Restore Eating Skills",
  F695: "Respiratory/Tracheostomy Care and Suctioning",
  F697: "Pain Management",
  F698: "Dialysis",
  F699: "Trauma/Injury - Assess, Monitor, and Treat",
  F725: "Sufficient Nursing Staff",
  F726: "Competent Nursing Staff",
  F740: "Behavioral Health Services",
  F741: "Sufficient/Competent Staff - Behavioral Health",
  F744: "Treatment/Service for Dementia",
  F755: "Pharmacy - Drug Regimen Review",
  F756: "Drug Regimen is Free from Unnecessary Drugs",
  F757: "Drug Regimen Review Report/Irregularities",
  F758: "Psychotropic Drugs - PRN Use",
  F759: "Medication Error Rates",
  F760: "Residents Are Free of Significant Med Errors",
  F761: "Label/Store Drugs and Biologicals",
  F800: "Facility Must Provide and Implement Infection Prevention",
  F804: "Nutritionally Adequate Diet/Therapeutic Diets",
  F812: "Food Procurement, Store/Prepare/Serve - Sanitary",
  F838: "Facility Assessment",
  F842: "Resident Records - Identifiable Information",
  F867: "QAPI/QAA",
  F880: "Infection Prevention & Control",
  F881: "Antibiotic Stewardship Program",
  F886: "COVID-19 Immunization",
  F919: "Resident Room/Bathroom Meets Requirements",
  F921: "Safe/Functional/Sanitary/Comfortable Environment",
  F925: "Maintain Effective Pest Control",
  F926: "Smoking Policies",
  F940: "Training Requirements",
  F941: "Nurse Aide Training Competencies",
  F944: "Nurse Aide Registry Verification",
  F945: "Nursing Aide Performance Review",
  F947: "Required Training of Feeding Assistants",
};

const HIGH_IMPACT_TAGS = new Set([
  'F600', 'F609', 'F684', 'F689', 'F725', 'F800', 'F880',
]);

// ── Parsing functions ──

function parseHeader(text) {
  const info = {
    facility_name: null,
    survey_date: null,
    survey_type: null,
    provider_number: null,
  };

  // Provider number (6-digit CMS ID)
  const providerMatch = text.match(/(?:PROVIDER|SUPPLIER|CMS|CCN)\s*(?:NUMBER|#|NO\.?|ID)\s*[:\-]?\s*(\d{6})/i);
  if (providerMatch) info.provider_number = providerMatch[1];

  // Survey date
  const dateMatch = text.match(/(?:SURVEY|COMPLETED|EVENT)\s*(?:DATE|COMPLETED)\s*[:\-]?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (dateMatch) {
    info.survey_date = dateMatch[1];
  } else {
    const fallbackDate = text.slice(0, 2000).match(/(\d{2}\/\d{2}\/\d{4})/);
    if (fallbackDate) info.survey_date = fallbackDate[1];
  }

  // Facility name — multiple strategies to avoid capturing address/form text
  const namePatterns = [
    // "NAME OF PROVIDER OR SUPPLIER\n<actual name>"
    /NAME\s+OF\s+PROVIDER\s+OR\s+SUPPLIER\s*[\n\r]+\s*([A-Z][A-Z\s\-\.\'\&\/]+?)(?:\s*\n|\s{3,})/i,
    // "NAME OF PROVIDER\n<actual name>"
    /NAME\s+OF\s+PROVIDER\s*[:\-]?\s*[\n\r]+\s*([A-Z][A-Z\s\-\.\'\&\/]+?)(?:\s*\n|\s{3,})/i,
    // "FACILITY NAME: <name>" on same line
    /FACILITY\s+NAME\s*[:\-]\s*([A-Z][A-Z\s\-\.\'\&\/]+?)(?:\s*\n|\s{3,})/i,
    // Provider name near the top (common in CMS forms)
    /PROVIDER\s+NAME\s*[:\-]?\s*(.+?)(?:\n|$)/i,
  ];

  for (const pat of namePatterns) {
    const match = text.slice(0, 3000).match(pat);
    if (match) {
      let name = match[1].trim();
      // Clean up: remove trailing address-like text (starts with digits)
      name = name.replace(/\s*\d{2,5}\s+[A-Z].+$/, '').trim();
      // Remove "OR SUPPLIER" if captured
      name = name.replace(/\bOR\s+SUPPLIER\b.*/i, '').trim();
      // Remove "STREET ADDRESS" form labels
      name = name.replace(/\bSTREET\s+ADDRESS\b.*/i, '').trim();
      if (name.length > 3 && name.length < 100 && !/^\d/.test(name)) {
        info.facility_name = name;
        break;
      }
    }
  }

  // Fallback: map provider number to known building name
  if (!info.facility_name && info.provider_number) {
    const PROVIDER_MAP = {
      '045350': 'Nightingale at Arkadelphia',
      '045437': 'Nightingale at Stonegate',
      '045403': 'Nightingale at Glenwood',
      '045176': 'The Woods',
      '045190': 'Nightingale at Crossett',
      '366335': 'Villa at Marymount',
      '395042': 'Nightingale Erie',
    };
    info.facility_name = PROVIDER_MAP[info.provider_number] || null;
  }

  // Fallback: try to find a known IHCM building name in text
  if (!info.facility_name) {
    const knownNames = ['NIGHTINGALE', 'ARKADELPHIA', 'STONEGATE', 'GLENWOOD', 'THE WOODS', 'CROSSETT', 'MARYMOUNT', 'VILLA AT'];
    const topText = text.slice(0, 3000).toUpperCase();
    for (const known of knownNames) {
      const idx = topText.indexOf(known);
      if (idx >= 0) {
        // Grab the line containing this name
        const lineStart = topText.lastIndexOf('\n', idx) + 1;
        const lineEnd = topText.indexOf('\n', idx);
        const line = text.slice(lineStart, lineEnd > 0 ? lineEnd : lineStart + 100).trim();
        if (line.length > 3 && line.length < 100) {
          info.facility_name = line;
          break;
        }
      }
    }
  }

  // Survey type detection
  const top3000 = text.slice(0, 3000).toUpperCase();
  if (/COMPLAINT\s+(?:SURVEY|INVESTIGATION)|INCIDENT\s+INVESTIGATION/.test(top3000)) {
    info.survey_type = 'complaint';
  } else if (/ANNUAL\s+(?:SURVEY|RECERTIFICATION)|RECERTIFICATION\s+SURVEY/.test(top3000)) {
    info.survey_type = 'annual';
  } else if (/REVISIT|FOLLOW[\s\-]?UP/.test(top3000)) {
    info.survey_type = 'revisit';
  } else if (/LIFE\s+SAFETY/.test(top3000)) {
    info.survey_type = 'life_safety';
  } else if (/INFECTION\s+CONTROL/.test(top3000)) {
    info.survey_type = 'infection_control';
  } else {
    info.survey_type = 'standard';
  }

  return info;
}

function extractRegulation(text) {
  const match = text.match(/(48[23]\.\d+(?:\([a-z0-9]+\))*)/);
  return match ? match[1] : null;
}

function extractScopeSeverity(text) {
  // Try explicit scope/severity markers
  let match = text.match(/(?:SCOPE|SEVERITY|S\/S)\s*[:\-]?\s*([A-L])\b/i);
  if (match) return match[1].toUpperCase();

  // Pattern: "D - Isolated" or "F - Pattern"
  match = text.match(/\b([A-L])\s*(?:\-|–|—)\s*(?:Isolated|Pattern|Widespread)/i);
  if (match) return match[1].toUpperCase();

  // Pattern: "(D)" or "[D]" near scope/severity context
  match = text.match(/(?:scope|severity|level|rating)\s*[:\-]?\s*[\(\[]([A-L])[\)\]]/i);
  if (match) return match[1].toUpperCase();

  // CMS form column pattern: single letter between form fields
  // Look for standalone severity letter near "ISOLATED" "PATTERN" "WIDESPREAD"
  match = text.match(/\b(Isolated|Pattern|Widespread)\b/i);
  if (match) {
    // Search nearby for a single letter A-L
    const nearby = text.slice(Math.max(0, match.index - 50), match.index + match[0].length + 20);
    const letterMatch = nearby.match(/\b([A-L])\b/);
    if (letterMatch) return letterMatch[1].toUpperCase();
  }

  // Fallback: look for single uppercase letter A-L after a regulation citation
  match = text.match(/48[23]\.\d+[^\n]*?\b([D-L])\b/);
  if (match) return match[1].toUpperCase();

  return null;
}

// CMS form boilerplate lines to strip from extracted text
const FORM_NOISE = [
  /FORM\s+CMS[\-\s]*2567/i,
  /STATEMENT\s+OF\s+DEFICIENCIES/i,
  /PROVIDER['']?S?\s+PLAN\s+OF\s+CORRECTION/i,
  /PREFIX\s+TAG/i,
  /SUMMARY\s+STATEMENT/i,
  /ID\s+PREFIX\s+TAG/i,
  /PRINTED:\s*\d/i,
  /PAGE\s+\d+\s+OF\s+\d+/i,
  /LABORATORY\s+DIRECTOR/i,
  /STREET\s+ADDRESS.*CITY.*STATE/i,
  /^\s*\(X\d\)/,
  /^\s*X\d\s*$/,
  /^\s*REGULATION\s*$/i,
  /^\s*[A-L]\s*$/,  // standalone severity letter as line
];

function stripFormNoise(text) {
  return text.split('\n')
    .filter(line => !FORM_NOISE.some(pat => pat.test(line.trim())))
    .join('\n');
}

function extractDeficientPractice(text) {
  const cleaned = stripFormNoise(text);

  // Try explicit markers
  const patterns = [
    /(?:DEFICIENT\s+PRACTICE|DEFICIENCY)[:\-]?\s*(.+?)(?:\n\s*\n|\nFINDINGS)/is,
    /(Based\s+on\s+(?:observation|interview|record\s+review|a\s+review).+?)(?:\n\s*\n|\nFINDINGS)/is,
    /((?:The\s+facility|This\s+(?:facility|provider))\s+(?:failed|did\s+not).+?)(?:\n\s*\n)/is,
  ];

  for (const pat of patterns) {
    const match = cleaned.match(pat);
    if (match) return match[1].trim().slice(0, 2000);
  }

  // Fallback: first substantive paragraph after tag line
  const lines = cleaned.split('\n');
  const contentLines = [];
  let started = false;
  for (let i = 1; i < lines.length; i++) {
    const stripped = lines[i].trim();
    if (!stripped) {
      if (started && contentLines.length) break;
      continue;
    }
    // Skip short form-like lines
    if (stripped.length < 15 && !/[a-z]/.test(stripped)) continue;
    started = true;
    contentLines.push(stripped);
    if (contentLines.join(' ').length > 500) break;
  }

  return contentLines.length ? contentLines.join(' ').slice(0, 2000) : null;
}

function extractFindings(text) {
  const cleaned = stripFormNoise(text);

  // Try specific markers
  const markers = ['FINDINGS', 'Based on', 'During observation', 'Review of',
    'Interview with', 'Observation on', 'Record review'];

  for (const marker of markers) {
    const idx = cleaned.toLowerCase().indexOf(marker.toLowerCase());
    if (idx >= 0) {
      return cleaned.slice(idx).trim().slice(0, 5000);
    }
  }

  // Fallback: skip header lines, take substantive content
  const lines = cleaned.split('\n');
  let contentStart = 0;
  for (let i = 0; i < lines.length && i < 8; i++) {
    const stripped = lines[i].trim();
    if (stripped.length < 80) {
      contentStart = i + 1;
      continue;
    }
    if (stripped.length > 80) {
      contentStart = i;
      break;
    }
  }

  const findingsText = lines.slice(contentStart).join('\n').trim();
  if (findingsText) return findingsText.slice(0, 5000);

  if (text.length > 150) return stripFormNoise(text.slice(100)).trim().slice(0, 5000);
  return stripFormNoise(text).trim().slice(0, 5000) || null;
}

function extractPocDue(text) {
  const match = text.match(
    /(?:POC|PLAN\s+OF\s+CORRECTION|COMPLETION)\s*(?:DUE|DATE)\s*[:\-]?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i
  );
  return match ? match[1] : null;
}

function parseCitations(fullText) {
  const citations = [];
  const seenTags = new Set();

  // Valid F-tag range: F150-F999 (F000 is not a real deficiency tag)
  const isValidFTag = (tagNum) => {
    const num = parseInt(tagNum, 10);
    return num >= 150 && num <= 999;
  };

  // Find all F-tag markers
  const tagPattern = /(?:^|\n)\s*F\s*[\-\s]?(\d{3,4})\b/gm;
  const matches = [];
  let m;
  while ((m = tagPattern.exec(fullText)) !== null) {
    if (isValidFTag(m[1])) {
      matches.push({ tag: m[1], index: m.index });
    }
  }

  // Alternate pattern: "Tag F689"
  if (matches.length === 0) {
    const altPattern = /Tag\s+F\s*(\d{3,4})/gi;
    while ((m = altPattern.exec(fullText)) !== null) {
      if (isValidFTag(m[1])) {
        matches.push({ tag: m[1], index: m.index });
      }
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const fTag = `F${matches[i].tag}`;
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : fullText.length;
    const sectionText = fullText.slice(start, end).trim();

    // Skip very short sections (likely noise from form headers)
    if (sectionText.length < 50) continue;

    // Deduplicate: if we've seen this tag, only keep if this section has more content
    if (seenTags.has(fTag)) {
      const existing = citations.find(c => c.f_tag === fTag);
      if (existing && sectionText.length <= (existing.findings?.length || 0)) continue;
      // Replace with longer version
      const idx = citations.findIndex(c => c.f_tag === fTag);
      if (idx >= 0) citations.splice(idx, 1);
    }
    seenTags.add(fTag);

    citations.push({
      f_tag: fTag,
      regulation: extractRegulation(sectionText),
      tag_description: COMMON_TAGS[fTag] || null,
      scope_severity: extractScopeSeverity(sectionText),
      deficient_practice: extractDeficientPractice(sectionText),
      findings: extractFindings(sectionText),
      plan_of_correction_due: extractPocDue(sectionText),
    });
  }

  return citations;
}

function classifySeverity(citations) {
  const critical = new Set();
  for (const c of citations) {
    if (c.scope_severity && c.scope_severity >= 'G') {
      critical.add(c.f_tag);
    } else if (HIGH_IMPACT_TAGS.has(c.f_tag)) {
      critical.add(c.f_tag);
    }
  }
  return [...critical];
}

// ── Multipart parser (Buffer-safe) ──

function parseMultipart(rawBody, contentType) {
  const boundaryMatch = contentType.match(/boundary=(.+?)(?:;|$)/);
  if (!boundaryMatch) return null;

  const boundary = boundaryMatch[1].trim();
  const boundaryBuf = Buffer.from(`--${boundary}`);

  let start = rawBody.indexOf(boundaryBuf, 0);
  if (start === -1) return null;

  const nextBoundary = rawBody.indexOf(boundaryBuf, start + boundaryBuf.length);
  if (nextBoundary === -1) return null;

  const partData = rawBody.slice(start + boundaryBuf.length, nextBoundary);
  const sep = Buffer.from('\r\n\r\n');
  const headerEnd = partData.indexOf(sep);
  if (headerEnd === -1) return null;

  const headerStr = partData.slice(0, headerEnd).toString('utf8');
  if (!headerStr.includes('filename=')) return null;

  let fileData = partData.slice(headerEnd + sep.length);
  if (fileData.length >= 2 &&
      fileData[fileData.length - 2] === 0x0d &&
      fileData[fileData.length - 1] === 0x0a) {
    fileData = fileData.slice(0, -2);
  }

  return fileData;
}

// ── Main handler ──

export default async function handler(req, res) {
  // CORS
  const origin = req.headers.origin || '';
  if (origin.endsWith('.vercel.app') || origin.startsWith('http://localhost')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check
  const auth = await requireAuth(req);
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Get the raw body as buffer
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const rawBody = Buffer.concat(chunks);
    if (rawBody.length > MAX_PDF_SIZE) {
      return res.status(413).json({ error: `File too large (max ${MAX_PDF_SIZE / 1024 / 1024}MB)` });
    }
    const contentType = req.headers['content-type'] || '';

    console.log(`[parse-2567] Received ${rawBody.length} bytes, content-type: ${contentType}`);

    let fileBuffer;

    if (contentType.includes('multipart/form-data')) {
      fileBuffer = parseMultipart(rawBody, contentType);
    } else if (contentType.includes('application/pdf')) {
      fileBuffer = rawBody;
    }

    if (!fileBuffer || fileBuffer.length < 100) {
      console.error(`[parse-2567] No valid PDF extracted. Buffer length: ${fileBuffer?.length || 0}`);
      return res.status(400).json({ error: 'No valid PDF file received' });
    }

    // Verify PDF header
    const header = fileBuffer.slice(0, 5).toString('ascii');
    if (!header.startsWith('%PDF')) {
      return res.status(400).json({ error: 'Uploaded file is not a valid PDF' });
    }

    console.log(`[parse-2567] Extracted PDF: ${fileBuffer.length} bytes`);

    // Parse PDF text
    const pdfData = await pdf(fileBuffer);
    const fullText = pdfData.text || '';

    if (!fullText.trim()) {
      return res.status(200).json({
        error: 'No text extracted from PDF. The file may be a scanned image — OCR is not yet supported.',
        raw_text_length: 0,
        citations: [],
        total_citations: 0,
        critical_tags: [],
      });
    }

    const headerInfo = parseHeader(fullText);
    const citations = parseCitations(fullText);
    const criticalTags = classifySeverity(citations);

    // Assess parse quality for confidence banner
    const nullSeverityCount = citations.filter(c => !c.scope_severity).length;
    const hasValidName = headerInfo.facility_name && headerInfo.facility_name.length > 3;
    const hasDate = !!headerInfo.survey_date;
    const parseQuality = (citations.length > 0 && nullSeverityCount < citations.length / 2 && hasValidName && hasDate)
      ? 'good'
      : (citations.length > 0 ? 'partial' : 'poor');

    const result = {
      ...headerInfo,
      citations,
      total_citations: citations.length,
      critical_tags: criticalTags,
      raw_text_length: fullText.length,
      parse_quality: parseQuality,
      parse_warning: parseQuality !== 'good'
        ? 'Auto-parsed from PDF. Please verify facility name, F-tags, and severity before use.'
        : null,
    };

    console.log(`[parse-2567] Parsed: ${citations.length} citations, ${fullText.length} chars, quality: ${parseQuality}`);

    return res.status(200).json(result);

  } catch (err) {
    console.error('[parse-2567] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
