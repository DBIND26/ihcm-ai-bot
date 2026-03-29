#!/usr/bin/env python3
"""
CMS 2567 (Statement of Deficiencies) PDF Parser

Extracts structured citation data from a 2567 survey form PDF.
Returns JSON to stdout for the Node.js API to consume.

Usage: python3 parse_2567.py <path_to_pdf>

Output JSON shape:
{
  "facility_name": "...",
  "survey_date": "...",
  "survey_type": "...",
  "provider_number": "...",
  "citations": [
    {
      "f_tag": "F689",
      "regulation": "483.25(d)(1)(2)",
      "tag_description": "Free of Accident Hazards/Supervision/Devices",
      "scope_severity": "G",
      "deficient_practice": "...",
      "findings": "...",
      "plan_of_correction_due": "..."
    }
  ],
  "total_citations": 5,
  "critical_tags": ["F689", "F880"],
  "raw_text_length": 12345
}
"""

import json
import re
import sys

try:
    import pdfplumber
except ImportError:
    print(json.dumps({"error": "pdfplumber not installed. Run: pip install pdfplumber"}))
    sys.exit(1)


def extract_text(pdf_path):
    """Extract all text from the PDF with page boundaries."""
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            pages.append(text)
    return pages


def parse_header(full_text):
    """Extract facility info from the first page header."""
    info = {
        "facility_name": None,
        "survey_date": None,
        "survey_type": None,
        "provider_number": None,
    }

    # Provider number (CMS certification number)
    provider_match = re.search(r'(?:PROVIDER|SUPPLIER|CMS)\s*(?:NUMBER|#|NO\.?)\s*[:\-]?\s*(\d{6})', full_text, re.IGNORECASE)
    if provider_match:
        info["provider_number"] = provider_match.group(1)

    # Survey date — look for common patterns
    date_match = re.search(r'(?:SURVEY|COMPLETED|EVENT)\s*(?:DATE|COMPLETED)\s*[:\-]?\s*(\d{1,2}/\d{1,2}/\d{2,4})', full_text, re.IGNORECASE)
    if date_match:
        info["survey_date"] = date_match.group(1)
    else:
        # Try MM/DD/YYYY anywhere near top
        date_match = re.search(r'(\d{2}/\d{2}/\d{4})', full_text[:2000])
        if date_match:
            info["survey_date"] = date_match.group(1)

    # Facility name — typically appears near the top in caps or after "NAME OF PROVIDER"
    name_match = re.search(r'(?:NAME\s+OF\s+PROVIDER|FACILITY\s+NAME)\s*[:\-]?\s*(.+?)(?:\n|$)', full_text, re.IGNORECASE)
    if name_match:
        info["facility_name"] = name_match.group(1).strip()

    # Survey type
    if re.search(r'COMPLAINT|INCIDENT', full_text[:3000], re.IGNORECASE):
        info["survey_type"] = "complaint"
    elif re.search(r'ANNUAL|RECERTIFICATION', full_text[:3000], re.IGNORECASE):
        info["survey_type"] = "annual"
    elif re.search(r'REVISIT|FOLLOW.?UP', full_text[:3000], re.IGNORECASE):
        info["survey_type"] = "revisit"
    else:
        info["survey_type"] = "standard"

    return info


def parse_citations(full_text):
    """
    Extract individual F-tag citations from the 2567 text.

    2567 forms follow a pattern:
    F XXXX  — tag number
    Followed by the regulation reference
    Followed by the tag description
    Then the surveyor's findings
    """
    citations = []

    # Pattern: F followed by 3-4 digits (F-tags)
    # The text between one F-tag and the next is that citation's content
    tag_pattern = re.compile(
        r'(?:^|\n)\s*F\s*[\-\s]?(\d{3,4})\b',
        re.MULTILINE
    )

    matches = list(tag_pattern.finditer(full_text))

    if not matches:
        # Try alternate patterns — some 2567s use "Tag F689" format
        tag_pattern = re.compile(r'Tag\s+F\s*(\d{3,4})', re.IGNORECASE)
        matches = list(tag_pattern.finditer(full_text))

    for i, match in enumerate(matches):
        f_tag = f"F{match.group(1)}"
        start = match.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(full_text)

        section_text = full_text[start:end].strip()

        citation = {
            "f_tag": f_tag,
            "regulation": extract_regulation(section_text),
            "tag_description": extract_tag_description(f_tag),
            "scope_severity": extract_scope_severity(section_text),
            "deficient_practice": extract_deficient_practice(section_text),
            "findings": extract_findings(section_text),
            "plan_of_correction_due": extract_poc_due(section_text),
        }

        citations.append(citation)

    return citations


def extract_regulation(text):
    """Pull the CFR regulation reference."""
    match = re.search(r'(48[23]\.\d+(?:\([a-z0-9]+\))*)', text)
    return match.group(1) if match else None


def extract_scope_severity(text):
    """Extract scope and severity letter (A through L)."""
    match = re.search(r'(?:SCOPE|SEVERITY|S/S)\s*[:\-]?\s*([A-L])\b', text, re.IGNORECASE)
    if match:
        return match.group(1).upper()
    # Check for patterns like "(D)" or "Severity: D"
    match = re.search(r'\b([D-L])\s*(?:\-|–)\s*(?:Isolated|Pattern|Widespread)', text, re.IGNORECASE)
    return match.group(1).upper() if match else None


def extract_deficient_practice(text):
    """Extract the deficient practice statement."""
    # Try explicit markers first
    for pattern in [
        r'(?:DEFICIENT\s+PRACTICE|DEFICIENCY)[:\-]?\s*(.+?)(?:\n\s*\n|\nFINDINGS)',
        r'(Based\s+on\s+(?:observation|interview|record\s+review|a\s+review).+?)(?:\n\s*\n|\nFINDINGS)',
        r'((?:The\s+facility|This\s+(?:facility|provider))\s+(?:failed|did\s+not).+?)(?:\n\s*\n)',
    ]:
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if match:
            return match.group(1).strip()[:2000]

    # Fallback: first paragraph after header lines
    lines = text.split('\n')
    content_lines = []
    started = False
    for line in lines[1:]:
        stripped = line.strip()
        if not stripped:
            if started and content_lines:
                break
            continue
        started = True
        content_lines.append(stripped)
        if len(' '.join(content_lines)) > 500:
            break

    return ' '.join(content_lines)[:2000] if content_lines else None


def extract_findings(text):
    """Extract the surveyor's findings (the bulk of the citation).

    Strategy: be aggressive. The entire text block between one F-tag and the
    next IS the citation content. We just need to skip the tag header lines
    and grab everything else.
    """
    # First try specific markers
    for marker in ['FINDINGS', 'Based on', 'During observation', 'Review of',
                    'Interview with', 'Observation on', 'Record review']:
        idx = text.lower().find(marker.lower())
        if idx >= 0:
            findings = text[idx:].strip()
            return findings[:5000]

    # Aggressive fallback: skip the first few header lines (tag number,
    # regulation ref, description), then take EVERYTHING as findings
    lines = text.split('\n')
    # Skip header lines (typically 1-5 lines of tag/regulation info)
    content_start = 0
    for i, line in enumerate(lines):
        stripped = line.strip()
        # Skip short lines that look like headers (tag number, regulation, severity)
        if len(stripped) < 80 and i < 8:
            content_start = i + 1
            continue
        # Found a substantial line — this is likely the start of findings
        if len(stripped) > 80:
            content_start = i
            break

    findings_text = '\n'.join(lines[content_start:]).strip()

    if findings_text:
        return findings_text[:5000]

    # Ultimate fallback: everything after first 100 chars
    if len(text) > 150:
        return text[100:].strip()[:5000]

    return text.strip()[:5000] if text else None


def extract_poc_due(text):
    """Extract plan of correction due date if present."""
    match = re.search(
        r'(?:POC|PLAN\s+OF\s+CORRECTION|COMPLETION)\s*(?:DUE|DATE)\s*[:\-]?\s*(\d{1,2}/\d{1,2}/\d{2,4})',
        text, re.IGNORECASE
    )
    return match.group(1) if match else None


# Common F-tag descriptions (most frequently cited)
COMMON_TAGS = {
    "F600": "Free from Abuse and Neglect",
    "F609": "Reporting of Alleged Violations",
    "F610": "Investigate/Prevent/Correct Alleged Violation",
    "F623": "Notice Requirements Before Transfer/Discharge",
    "F625": "Notice of Bed Hold Policy Before/Upon Transfer",
    "F641": "Accuracy of Assessments",
    "F656": "Develop/Implement Comprehensive Care Plan",
    "F657": "Care Plan Timing and Revision",
    "F658": "Services Provided Meet Professional Standards",
    "F677": "ADL Care Provided for Dependent Residents",
    "F684": "Quality of Care",
    "F686": "Treatment/Services to Prevent/Heal Pressure Ulcers",
    "F688": "Increase/Prevent Decrease in ROM/Mobility",
    "F689": "Free of Accident Hazards/Supervision/Devices",
    "F690": "Bowel/Bladder Incontinence, Catheter, UTI",
    "F692": "Nutrition/Hydration Status Maintenance",
    "F693": "Tube Feeding Management/Restore Eating Skills",
    "F695": "Respiratory/Tracheostomy Care and Suctioning",
    "F697": "Pain Management",
    "F698": "Dialysis",
    "F699": "Trauma/Injury - Assess, Monitor, and Treat",
    "F725": "Sufficient Nursing Staff",
    "F726": "Competent Nursing Staff",
    "F740": "Behavioral Health Services",
    "F741": "Sufficient/Competent Staff - Behavioral Health",
    "F744": "Treatment/Service for Dementia",
    "F755": "Pharmacy - Drug Regimen Review",
    "F756": "Drug Regimen is Free from Unnecessary Drugs",
    "F757": "Drug Regimen Review Report/Irregularities",
    "F758": "Psychotropic Drugs - PRN Use",
    "F759": "Medication Error Rates",
    "F760": "Residents Are Free of Significant Med Errors",
    "F761": "Label/Store Drugs and Biologicals",
    "F800": "Facility Must Provide and Implement Infection Prevention",
    "F812": "Food Procurement, Store/Prepare/Serve - Sanitary",
    "F838": "Facility Assessment",
    "F842": "Resident Records - Identifiable Information",
    "F867": "QAPI/QAA",
    "F880": "Infection Prevention & Control",
    "F881": "Antibiotic Stewardship Program",
    "F886": "COVID-19 Immunization",
    "F919": "Resident Room/Bathroom Meets Requirements",
    "F921": "Safe/Functional/Sanitary/Comfortable Environment",
    "F925": "Maintain Effective Pest Control",
    "F926": "Smoking Policies",
    "F940": "Training Requirements",
    "F941": "Nurse Aide Training Competencies",
    "F944": "Nurse Aide Registry Verification",
    "F945": "Nursing Aide Performance Review",
    "F947": "Required Training of Feeding Assistants",
}


def extract_tag_description(f_tag):
    """Look up the standard tag description."""
    return COMMON_TAGS.get(f_tag, None)


def classify_severity(citations):
    """Identify critical tags (scope/severity G or higher, or high-impact tags)."""
    critical = []
    high_impact_tags = {"F600", "F609", "F684", "F689", "F725", "F800", "F880"}

    for c in citations:
        ss = c.get("scope_severity", "")
        tag = c.get("f_tag", "")
        if ss and ss >= "G":
            critical.append(tag)
        elif tag in high_impact_tags:
            critical.append(tag)

    return list(set(critical))


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: parse_2567.py <pdf_path>"}))
        sys.exit(1)

    pdf_path = sys.argv[1]

    try:
        pages = extract_text(pdf_path)
    except Exception as e:
        print(json.dumps({"error": f"Failed to read PDF: {str(e)}"}))
        sys.exit(1)

    full_text = '\n\n'.join(pages)

    if not full_text.strip():
        print(json.dumps({
            "error": "No text extracted from PDF. The file may be a scanned image — OCR is not yet supported.",
            "raw_text_length": 0
        }))
        sys.exit(0)

    header = parse_header(full_text)
    citations = parse_citations(full_text)
    critical = classify_severity(citations)

    result = {
        **header,
        "citations": citations,
        "total_citations": len(citations),
        "critical_tags": critical,
        "raw_text_length": len(full_text),
    }

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
