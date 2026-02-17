import { randomUUID } from 'crypto';

function parseYAML(yamlString) {
  const lines = yamlString.split('\n');
  const result = {};
  const stack = [{ key: null, value: result, indent: -1 }];

  for (let line of lines) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;

    const indent = line.search(/\S|$/);
    const trimmed = line.trim();
    
    if (trimmed.startsWith('- ')) {
      const itemContent = trimmed.substring(2);

      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }

      let parentObj = stack[stack.length - 1].value;

      // If parent is an empty object from "key:" with no value, convert to array
      const parentKey = stack[stack.length - 1].key;
      if (!Array.isArray(parentObj) && parentKey !== null && typeof parentObj === 'object' && Object.keys(parentObj).length === 0 && stack.length >= 2) {
        const grandparent = stack[stack.length - 2].value;
        grandparent[parentKey] = [];
        parentObj = grandparent[parentKey];
        stack[stack.length - 1].value = parentObj;
      }

      if (!Array.isArray(parentObj)) {
        const lastKey = Object.keys(parentObj).pop();
        if (!Array.isArray(parentObj[lastKey])) {
          parentObj[lastKey] = [];
        }
        parentObj = parentObj[lastKey];
      }

      // Handle "- key: value" (object entry in array)
      if (itemContent.includes(':')) {
        const [itemKey, ...itemValueParts] = itemContent.split(':');
        const itemValue = itemValueParts.join(':').trim();
        const entry = {};
        entry[itemKey] = itemValue === '' ? {} : parseValue(itemValue);
        parentObj.push(entry);
        stack.push({ key: null, value: entry, indent: indent });
      } else {
        parentObj.push(parseValue(itemContent));
      }
    } else if (trimmed.includes(':')) {
      const [key, ...valueParts] = trimmed.split(':');
      const value = valueParts.join(':').trim();

      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }

      const obj = stack[stack.length - 1].value;

      if (value === '' || value.startsWith('|') || value.startsWith('>')) {
        obj[key] = {};
        stack.push({ key, value: obj[key], indent });
      } else {
        obj[key] = parseValue(value);
      }
    }
  }

  return result;
}

function parseValue(value) {
  if (value === 'null' || value === '~' || value === '') return null;
  if (value === 'true' || value === 'True') return true;
  if (value === 'false' || value === 'False') return false;
  if (value === '[]' || value === 'null') return [];
  if (!isNaN(Number(value))) return Number(value);
  if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1);
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  return value;
}

function toYAML(obj, indent = 0) {
  const spaces = ' '.repeat(indent);
  let result = '';

  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (typeof item === 'object' && item !== null) {
        result += `${spaces}-\n${toYAML(item, indent + 2)}`;
      } else {
        result += `${spaces}- ${formatValue(item)}\n`;
      }
    }
  } else if (typeof obj === 'object' && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result += `${spaces}${key}:\n${toYAML(value, indent + 2)}`;
      } else if (Array.isArray(value)) {
        result += `${spaces}${key}:\n${toYAML(value, indent + 2)}`;
      } else {
        result += `${spaces}${key}: ${formatValue(value)}\n`;
      }
    }
  }

  return result;
}

function formatValue(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') {
    if (value.includes(':') || value.includes('#') || value.includes('\n')) {
      return `"${value}"`;
    }
    return value;
  }
  return String(value);
}

function validateSuggestion(obj) {
  const errors = [];

  if (!obj.id || !isValidUUID(obj.id)) {
    errors.push('id must be a valid UUID');
  }

  if (!obj.type || !['best_practice', 'tool', 'library', 'usage_pattern'].includes(obj.type)) {
    errors.push('type must be one of: best_practice, tool, library, usage_pattern');
  }

  if (!obj.name || typeof obj.name !== 'string') {
    errors.push('name is required and must be a string');
  }

  if (!obj.description || typeof obj.description !== 'string') {
    errors.push('description is required and must be a string');
  }

  if (!obj.rationale || typeof obj.rationale !== 'string') {
    errors.push('rationale is required and must be a string');
  }

  if (typeof obj.maintainability_score !== 'number' || obj.maintainability_score < 0 || obj.maintainability_score > 100) {
    errors.push('maintainability_score must be a number between 0 and 100');
  }

  if (typeof obj.security_score !== 'number' || obj.security_score < 0 || obj.security_score > 100) {
    errors.push('security_score must be a number between 0 and 100');
  }

  if (!Array.isArray(obj.source_urls)) {
    errors.push('source_urls must be an array');
  }

  if (!Array.isArray(obj.adoption_examples)) {
    errors.push('adoption_examples must be an array');
  }

  if (!Array.isArray(obj.evidence)) {
    errors.push('evidence must be an array');
  }

  if (!obj.created_at || !isValidISO8601(obj.created_at)) {
    errors.push('created_at must be a valid ISO8601 date string');
  }

  return { valid: errors.length === 0, errors };
}

function validateExplorationSession(obj) {
  const errors = [];

  if (!obj.id || !isValidUUID(obj.id)) {
    errors.push('id must be a valid UUID');
  }

  if (!obj.feature_id || typeof obj.feature_id !== 'string') {
    errors.push('feature_id is required and must be a string');
  }

  if (!obj.status || !['pending', 'in_progress', 'completed', 'failed'].includes(obj.status)) {
    errors.push('status must be one of: pending, in_progress, completed, failed');
  }

  if (!obj.started_at || !isValidISO8601(obj.started_at)) {
    errors.push('started_at must be a valid ISO8601 date string');
  }

  if (obj.completed_at !== null && !isValidISO8601(obj.completed_at)) {
    errors.push('completed_at must be null or a valid ISO8601 date string');
  }

  if (typeof obj.findings_summary !== 'string') {
    errors.push('findings_summary must be a string');
  }

  if (typeof obj.suggestions_generated_count !== 'number') {
    errors.push('suggestions_generated_count must be a number');
  }

  if (!Array.isArray(obj.sources_consulted)) {
    errors.push('sources_consulted must be an array');
  }

  if (obj.failure_reason !== null && typeof obj.failure_reason !== 'string') {
    errors.push('failure_reason must be null or a string');
  }

  return { valid: errors.length === 0, errors };
}

function validateSuggestionDecision(obj) {
  const errors = [];

  if (!obj.id || !isValidUUID(obj.id)) {
    errors.push('id must be a valid UUID');
  }

  if (!obj.suggestion_id || !isValidUUID(obj.suggestion_id)) {
    errors.push('suggestion_id must be a valid UUID');
  }

  if (!obj.feature_id || typeof obj.feature_id !== 'string') {
    errors.push('feature_id is required and must be a string');
  }

  if (!obj.decision || !['accepted', 'rejected', 'pending'].includes(obj.decision)) {
    errors.push('decision must be one of: accepted, rejected, pending');
  }

  if (typeof obj.reason !== 'string') {
    errors.push('reason must be a string');
  }

  if (obj.decided_at !== null && !isValidISO8601(obj.decided_at)) {
    errors.push('decided_at must be null or a valid ISO8601 date string');
  }

  return { valid: errors.length === 0, errors };
}

function createExplorationSession(featureId) {
  return {
    id: generateUUID(),
    feature_id: featureId,
    status: 'pending',
    started_at: new Date().toISOString(),
    completed_at: null,
    findings_summary: '',
    suggestions_generated_count: 0,
    sources_consulted: [],
    failure_reason: null
  };
}

function transitionSessionStatus(session, newStatus) {
  const validTransitions = {
    pending: ['in_progress'],
    in_progress: ['completed', 'failed'],
    completed: [],
    failed: []
  };

  if (!validTransitions[session.status]?.includes(newStatus)) {
    throw new Error(
      `Invalid status transition from ${session.status} to ${newStatus}. ` +
      `Valid transitions: ${validTransitions[session.status].join(', ') || 'none'}`
    );
  }

  session.status = newStatus;

  if (newStatus === 'completed' || newStatus === 'failed') {
    session.completed_at = new Date().toISOString();
  }

  return session;
}

function recordDecision(suggestionId, featureId, decision, reason) {
  return {
    id: generateUUID(),
    suggestion_id: suggestionId,
    feature_id: featureId,
    decision: decision,
    reason: reason,
    decided_at: decision !== 'pending' ? new Date().toISOString() : null
  };
}

function generateUUID() {
  return randomUUID();
}

function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

function isValidISO8601(dateString) {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

export {
  parseYAML,
  toYAML,
  validateSuggestion,
  validateExplorationSession,
  validateSuggestionDecision,
  createExplorationSession,
  transitionSessionStatus,
  recordDecision,
  generateUUID
};
