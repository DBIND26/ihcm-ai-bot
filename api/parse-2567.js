// ============================================================================
// 2567 PDF Parser API — POST /api/parse-2567
// ============================================================================
// Pure JavaScript implementation — no Python dependency.
// Uses pdf-parse for text extraction, then regex-based citation parsing.
//
// PRE-AUTH SCAFFOLD — no user verification. Internal use only.

import pdf from 'pdf-parse/lib/pdf-parse.js';

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

  // Provider number
  const providerMatch = text.match(/(?:PROVIDER|SUPPLIER|CMS)\s*(?:NUMBER|#|NO\.?)\s*[:\-]?\s*(\d{6})/i);
  if (providerMatch) info.provider_number = providerMatch[1];

  // Survey date
  const dateMatch = text.match(/(?:SURVEY|COMPLETED|EVENT)\s*(?:DATE|COMPLETED)\s*[:\-]?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (dateMatch) {
    info.survey_date = dateMatch[1];
  } else {
    const fallbackDate = text.slice(0, 2000).match(/(\d{2}\/\d{2}\/\d{4})/);
    if (fallbackDate) info.survey_date = fallbackDate[1];
  }

  // Facility name
  const nameMatch = text.match(/(?:NAME\s+OF\s+PROVIDER|FACILITY\s+NAME)\s*[:\-]?\s*(.+?)(?:\n|$)/i);
  if (nameMatch) info.facility_name = nameMatch[1].trim();

  // Survey type
  const top3000 = text.slice(0, 3000).toUpperCase();
  if (/COMPLAINT|INCIDENT/.test(top3000)) {
    info.survey_type = 'complaint';
  } else if (/ANNUAL|RECERTIFICATION/.test(top3000)) {
    info.survey_type = 'annual';
  } else if (/REVISIT|FOLLOW.?UP/.test(top3000)) {
    info.survey_type = 'revisit';
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
  let match = text.match(/(?:SCOPE|SEVERITY|S\/S)\s*[:\-]?\s*([A-L])\b/i);
  if (match) return match[1].toUpperCase();
  match = text.match(/\b([D-L])\s*(?:\-|–)\s*(?:Isolated|Pattern|Widespread)/i);
  return match ? match[1].toUpperCase() : null;
}

function extractDeficientPractice(text) {
  // Try explicit markers
  const patterns = [
    /(?:DEFICIENT\s+PRACTICE|DEFICIENCY)[:\-]?\s*(.+?)(?:\n\s*\n|\nFINDINGS)/is,
    /(Based\s+on\s+(?:observation|interview|record\s+review|a\s+review).+?)(?:\n\s*\n|\nFINDINGS)/is,
    /((?:The\s+facility|This\s+(?:facility|provider))\s+(?:failed|did\s+not).+?)(?:\n\s*\n)/is,
  ];

  for (const pat of patterns) {
    const match = text.match(pat);
    if (match) return match[1].trim().slice(0, 2000);
  }

  // Fallback: first paragraph after tag line
  const lines = text.split('\n');
  const contentLines = [];
  let started = false;
  for (let i = 1; i < lines.length; i++) {
    const stripped = lines[i].trim();
    if (!stripped) {
      if (started && contentLines.length) break;
      continue;
    }
    started = true;
    contentLines.push(stripped);
    if (contentLines.join(' ').length > 500) break;
  }

  return contentLines.length ? contentLines.join(' ').slice(0, 2000) : null;
}

function extractFindings(text) {
  // Try specific markers
  const markers = ['FINDINGS', 'Based on', 'During observation', 'Review of',
    'Interview with', 'Observation on', 'Record review'];

  for (const marker of markers) {
    const idx = text.toLowerCase().indexOf(marker.toLowerCase());
    if (idx >= 0) {
      return text.slice(idx).trim().slice(0, 5000);
    }
  }

  // Aggressive fallback: skip header lines, take everything
  const lines = text.split('\n');
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

  // Ultimate fallback
  if (text.length > 150) return text.slice(100).trim().slice(0, 5000);
  return text.trim().slice(0, 5000) || null;
}

function extractPocDue(text) {
  const match = text.match(
    /(?:POC|PLAN\s+OF\s+CORRECTION|COMPLETION)\s*(?:DUE|DATE)\s*[:\-]?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i
  );
  return match ? match[1] : null;
}

function parseCitations(fullText) {
  const citations = [];

  // Find all F-tag markers
  const tagPattern = /(?:^|\n)\s*F\s*[\-\s]?(\d{3,4})\b/gm;
  const matches = [];
  let m;
  while ((m = tagPattern.exec(fullText)) !== null) {
    matches.push({ tag: m[1], index: m.index });
  }

  // Alternate pattern: "Tag F689"
  if (matches.length === 0) {
    const altPattern = /Tag\s+F\s*(\d{3,4})/gi;
    while ((m = altPattern.exec(fullText)) !== null) {
      matches.push({ tag: m[1], index: m.index });
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const fTag = `F${matches[i].tag}`;
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : fullText.length;
    const sectionText = fullText.slice(start, end).trim();

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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the raw body as buffer
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const rawBody = Buffer.concat(chunks);
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

    const result = {
      ...headerInfo,
      citations,
      total_citations: citations.length,
      critical_tags: criticalTags,
      raw_text_length: fullText.length,
    };

    console.log(`[parse-2567] Parsed: ${citations.length} citations, ${fullText.length} chars text`);

    return res.status(200).json(result);

  } catch (err) {
    console.error('[parse-2567] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
