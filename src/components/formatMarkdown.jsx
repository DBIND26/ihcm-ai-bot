import React from 'react';

// Format inline markdown (bold, links with protocol sanitization)
function formatInline(text, lineKey) {
  const parts = [];
  let remaining = text;
  let partIdx = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);

    let nextMatch = null;
    let nextType = null;

    if (boldMatch && (!linkMatch || boldMatch.index <= linkMatch.index)) {
      nextMatch = boldMatch;
      nextType = 'bold';
    } else if (linkMatch) {
      nextMatch = linkMatch;
      nextType = 'link';
    }

    if (!nextMatch) {
      parts.push(remaining);
      break;
    }

    if (nextMatch.index > 0) {
      parts.push(remaining.slice(0, nextMatch.index));
    }

    if (nextType === 'bold') {
      parts.push(<strong key={`${lineKey}-b${partIdx++}`}>{nextMatch[1]}</strong>);
    } else if (nextType === 'link') {
      const href = nextMatch[2];
      const isSafe = /^https?:\/\//i.test(href) || href.startsWith('/') || href.startsWith('#');
      if (isSafe) {
        parts.push(
          <a key={`${lineKey}-a${partIdx++}`} href={href} target="_blank" rel="noopener noreferrer"
            style={{ color: '#2563eb', textDecoration: 'underline' }}>
            {nextMatch[1]}
          </a>
        );
      } else {
        parts.push(nextMatch[1]);
      }
    }

    remaining = remaining.slice(nextMatch.index + nextMatch[0].length);
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
}

function getListType(line) {
  if (/^\s*\d+[\.\)]\s/.test(line)) return 'ol';
  if (line.trim().startsWith('-') || line.trim().startsWith('* ')) return 'ul';
  return null;
}

function getListItemText(line, type) {
  if (type === 'ol') return line.replace(/^\s*\d+[\.\)]\s/, '');
  if (line.trim().startsWith('-')) return line.replace(/^\s*-\s*/, '');
  return line.replace(/^\s*\*\s/, '');
}

export default function formatContent(content) {
  const lines = content.split('\n');
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code blocks
    if (line.trim().startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      result.push(
        <pre key={`code-${i}`} style={{
          backgroundColor: '#1f2937', color: '#e5e7eb', padding: '12px 16px',
          borderRadius: '6px', fontSize: '13px', overflowX: 'auto',
          fontFamily: 'monospace', margin: '8px 0', lineHeight: '1.5',
        }}>
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      i++;
      continue;
    }

    // Headers
    if (line.startsWith('##')) {
      result.push(
        <h3 key={`h3-${i}`} className="ihcm-message-header">
          {formatInline(line.replace(/^##\s*/, ''), `h3-${i}`)}
        </h3>
      );
      i++;
      continue;
    }

    // Consecutive list items grouped into <ul>/<ol>
    const listType = getListType(line);
    if (listType) {
      const items = [];
      const startIdx = i;
      while (i < lines.length && getListType(lines[i]) === listType) {
        items.push(
          <li key={`li-${i}`} className="ihcm-message-bullet">
            {formatInline(getListItemText(lines[i], listType), `li-${i}`)}
          </li>
        );
        i++;
      }
      const ListTag = listType === 'ol' ? 'ol' : 'ul';
      result.push(
        <ListTag key={`${listType}-${startIdx}`} style={{ margin: '4px 0', paddingLeft: '24px' }}>
          {items}
        </ListTag>
      );
      continue;
    }

    if (line.trim() === '') {
      result.push(<div key={`empty-${i}`} className="ihcm-message-spacing" />);
    } else {
      result.push(
        <p key={`p-${i}`} className="ihcm-message-text">
          {formatInline(line, `line-${i}`)}
        </p>
      );
    }

    i++;
  }

  return result;
}
