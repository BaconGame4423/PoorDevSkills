/**
 * Backup manager utility for Best Practice and Tool Suggestion Phase
 * Handles automatic backup and recovery for critical YAML state files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseYAML } from './suggestion-parser.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

/**
 * Validate that a directory path is within the project root
 * Prevents path traversal attacks (e.g., ../../etc/passwd)
 * @param {string} dirPath - Directory path to validate
 * @throws {Error} If path is outside project root
 */
function validatePathWithinProject(dirPath) {
  const resolved = path.resolve(dirPath);
  if (!resolved.startsWith(PROJECT_ROOT + path.sep) && resolved !== PROJECT_ROOT) {
    throw new Error(`Path traversal detected: ${dirPath} is outside project root`);
  }
}

/**
 * Create a timestamped backup of the file before writing
 * @param {string} filePath - Path to the file to backup
 * @returns {Promise<string|null>} - Path to backup file, or null if source doesn't exist
 */
export async function createBackup(filePath) {
  try {
    validatePathWithinProject(filePath);
    // Check if source file exists
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const dir = path.dirname(filePath);
    const basename = path.basename(filePath, path.extname(filePath));
    const backupDir = path.join(dir, '.backups');

    // Create backup directory if not exists
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Generate timestamp: YYYYMMDDTHHMMSSsss (ms precision for uniqueness)
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('.', '').slice(0, -1);
    const backupPath = path.join(backupDir, `${basename}-${timestamp}.yaml`);

    // Copy file to backup
    fs.copyFileSync(filePath, backupPath);

    return backupPath;
  } catch (error) {
    throw new Error(`Failed to create backup: ${error.message}`);
  }
}

/**
 * List last 5 backups for a file, sorted by date (newest first)
 * @param {string} filePath - Path to the original file
 * @returns {Promise<Array<{path: string, timestamp: string, size: number}>>}
 */
export async function listBackups(filePath) {
  try {
    validatePathWithinProject(filePath);
    const dir = path.dirname(filePath);
    const basename = path.basename(filePath, path.extname(filePath));
    const backupDir = path.join(dir, '.backups');

    if (!fs.existsSync(backupDir)) {
      return [];
    }

    // Read all files in backup directory
    const files = fs.readdirSync(backupDir);

    // Filter files matching the pattern (YYYYMMDDTHHMMSSsss)
    const pattern = new RegExp(`^${basename}-\\d{8}T\\d{9}\\.yaml$`);
    const backups = files
      .filter(file => pattern.test(file))
      .map(file => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        // Extract timestamp from filename
        const match = file.match(/(\d{8}T\d{9})/);
        const timestamp = match ? match[1] : '';

        return {
          path: filePath,
          timestamp,
          size: stats.size
        };
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 5);

    return backups;
  } catch (error) {
    throw new Error(`Failed to list backups: ${error.message}`);
  }
}

/**
 * Restore from latest backup (or specified backup)
 * @param {string} filePath - Path to the file to restore
 * @param {string} [backupPath] - Optional specific backup to restore from
 * @returns {Promise<{success: boolean, restoredFrom: string|null, message: string}>}
 */
export async function recoverFromBackup(filePath, backupPath = null) {
  try {
    validatePathWithinProject(filePath);
    let sourceBackup = backupPath;

    // If no specific backup provided, use most recent
    if (!sourceBackup) {
      const backups = await listBackups(filePath);
      if (backups.length === 0) {
        return {
          success: false,
          restoredFrom: null,
          message: 'No backups found'
        };
      }
      sourceBackup = backups[0].path;
    }

    // Check if backup exists
    if (!fs.existsSync(sourceBackup)) {
      return {
        success: false,
        restoredFrom: null,
        message: `Backup file not found: ${sourceBackup}`
      };
    }

    // Restore the backup
    fs.copyFileSync(sourceBackup, filePath);

    return {
      success: true,
      restoredFrom: sourceBackup,
      message: `Successfully restored from ${path.basename(sourceBackup)}`
    };
  } catch (error) {
    return {
      success: false,
      restoredFrom: null,
      message: `Failed to recover: ${error.message}`
    };
  }
}

/**
 * Remove old backups
 * @param {string} filePath - Path to the original file
 * @param {number} maxAge - Maximum age in days (default: 7)
 * @param {number} maxCount - Maximum number of backups to keep (default: 5)
 * @returns {Promise<{deleted: number, kept: number}>}
 */
export async function cleanupBackups(filePath, maxAge = 7, maxCount = 5) {
  try {
    validatePathWithinProject(filePath);
    const dir = path.dirname(filePath);
    const basename = path.basename(filePath, path.extname(filePath));
    const backupDir = path.join(dir, '.backups');

    if (!fs.existsSync(backupDir)) {
      return { deleted: 0, kept: 0 };
    }

    // Read all files in backup directory
    const files = fs.readdirSync(backupDir);
    const pattern = new RegExp(`^${basename}-\\d{8}T\\d{9}\\.yaml$`);

    const backups = files
      .filter(file => pattern.test(file))
      .map(file => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        const match = file.match(/(\d{8}T\d{9})/);
        const timestamp = match ? match[1] : '';

        return {
          path: filePath,
          timestamp,
          mtime: stats.mtime
        };
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    const now = new Date();
    const maxAgeMs = maxAge * 24 * 60 * 60 * 1000;
    let deleted = 0;

    // Delete backups that are too old or exceed maxCount
    for (let i = 0; i < backups.length; i++) {
      const backup = backups[i];
      const age = now - backup.mtime;

      if (i >= maxCount || age > maxAgeMs) {
        fs.unlinkSync(backup.path);
        deleted++;
      }
    }

    const kept = backups.length - deleted;
    return { deleted, kept };
  } catch (error) {
    throw new Error(`Failed to cleanup backups: ${error.message}`);
  }
}

/**
 * Write content to file with automatic backup
 * @param {string} filePath - Path to the file to write
 * @param {string} content - Content to write
 * @returns {Promise<{success: boolean, backupPath: string|null}>}
 */
export async function writeWithBackup(filePath, content) {
  try {
    validatePathWithinProject(filePath);
    let backupPath = null;

    // Create backup of existing file if it exists
    if (fs.existsSync(filePath)) {
      backupPath = await createBackup(filePath);
    }

    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write new content
    fs.writeFileSync(filePath, content, 'utf8');

    return {
      success: true,
      backupPath
    };
  } catch (error) {
    throw new Error(`Failed to write with backup: ${error.message}`);
  }
}

/**
 * Archive backups on pipeline completion
 * @param {string} featureDir - Feature directory path
 * @param {string} [archiveDir] - Optional archive directory (defaults to featureDir/.completed-backups)
 * @returns {Promise<{success: boolean, archived: number, message: string}>}
 */
export async function archiveBackups(featureDir, archiveDir = null) {
  try {
    validatePathWithinProject(featureDir);
    const backupDir = path.join(featureDir, '.backups');
    const targetDir = archiveDir || path.join(featureDir, '.completed-backups');

    // Validate custom archiveDir if provided
    if (archiveDir) {
      validatePathWithinProject(archiveDir);
    }

    if (!fs.existsSync(backupDir)) {
      return {
        success: true,
        archived: 0,
        message: 'No backups to archive'
      };
    }

    // Create archive directory if not exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Move all backup files
    const files = fs.readdirSync(backupDir);
    let archived = 0;

    for (const file of files) {
      if (file.endsWith('.yaml')) {
        const sourcePath = path.join(backupDir, file);
        const targetPath = path.join(targetDir, file);
        fs.renameSync(sourcePath, targetPath);
        archived++;
      }
    }

    // Remove empty backup directory
    if (fs.readdirSync(backupDir).length === 0) {
      fs.rmdirSync(backupDir);
    }

    return {
      success: true,
      archived,
      message: `Archived ${archived} backup files`
    };
  } catch (error) {
    return {
      success: false,
      archived: 0,
      message: `Failed to archive backups: ${error.message}`
    };
  }
}

/**
 * Basic schema validation before writing
 * @param {string} filePath - Path to the file (for context)
 * @param {string} content - Content to validate
 * @returns {Promise<{valid: boolean, errors: string[]}>}
 */
export async function validateBeforeWrite(filePath, content) {
  const errors = [];

  try {
    // Check content is not empty
    if (!content || content.trim().length === 0) {
      errors.push('Content is empty');
      return { valid: false, errors };
    }

    // Basic YAML structure check - has key:value patterns
    const hasKeyValue = /^\s*[\w-]+\s*:/m.test(content);
    if (!hasKeyValue) {
      errors.push('Content does not appear to have YAML key:value structure');
    }

    // Check for common YAML syntax errors
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip empty lines and comments
      if (!line.trim() || line.trim().startsWith('#')) {
        continue;
      }

      // Check for tabs (YAML doesn't allow tabs for indentation)
      if (line.includes('\t')) {
        errors.push(`Line ${i + 1}: YAML does not allow tab characters for indentation`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  } catch (error) {
    errors.push(`Validation error: ${error.message}`);
    return { valid: false, errors };
  }
}

/**
 * Detect corruption in YAML file based on schema type
 * @param {string} filePath - Path to the YAML file to check
 * @param {string} schema - Schema type: 'exploration-session', 'suggestions', 'suggestion-decisions'
 * @returns {Promise<{corrupted: boolean, errors: string[]}>}
 */
export async function detectCorruption(filePath, schema) {
  const errors = [];

  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      errors.push('File does not exist');
      return { corrupted: true, errors };
    }

    // Read file content
    const content = fs.readFileSync(filePath, 'utf8');

    // Check if content is empty
    if (!content || content.trim().length === 0) {
      errors.push('File is empty');
      return { corrupted: true, errors };
    }

    // YAML structural validation using safe parser
    let data;
    try {
      const lines = content.split('\n');
      const trimmed = content.trim();
      const hasValidStructure = lines.some(line => /^\s*[\w-]+\s*:/.test(line))
        || trimmed.startsWith('-') || trimmed.startsWith('[');

      if (!hasValidStructure) {
        errors.push('Invalid YAML structure');
        return { corrupted: true, errors };
      }

      // Use safe YAML parser (no eval)
      data = parseYAML(content);
    } catch (parseError) {
      errors.push(`YAML parse error: ${parseError.message}`);
      return { corrupted: true, errors };
    }

    // Schema-specific validation
    switch (schema) {
      case 'exploration-session':
        if (!content.includes('id:')) errors.push('Missing required field: id');
        if (!content.includes('feature_id:')) errors.push('Missing required field: feature_id');
        if (!content.includes('status:')) errors.push('Missing required field: status');
        if (!content.includes('findings_summary:')) errors.push('Missing required field: findings_summary');
        if (!content.includes('suggestions_generated_count:')) errors.push('Missing required field: suggestions_generated_count');
        break;

      case 'suggestions':
        // Suggestions is an array - just check it's a valid array structure
        if (!content.trim().startsWith('-') && !content.trim().startsWith('[')) {
          // Empty array is valid (represented as [] or empty file)
          if (content.trim() !== '[]' && content.trim() !== '') {
            errors.push('Suggestions file must be a YAML array');
          }
        }
        break;

      case 'suggestion-decisions':
        // Decisions is an array - same validation as suggestions
        if (!content.trim().startsWith('-') && !content.trim().startsWith('[')) {
          if (content.trim() !== '[]' && content.trim() !== '') {
            errors.push('Suggestion decisions file must be a YAML array');
          }
        }
        break;

      default:
        errors.push(`Unknown schema type: ${schema}`);
        return { corrupted: true, errors };
    }

    return {
      corrupted: errors.length > 0,
      errors
    };
  } catch (error) {
    errors.push(`Corruption detection error: ${error.message}`);
    return { corrupted: true, errors };
  }
}

/**
 * Recover suggestion-decisions.yaml if corrupted
 * @param {string} featureDir - Feature directory path
 * @returns {Promise<{success: boolean, method: string, message: string}>}
 */
export async function recoverSuggestionDecisions(featureDir) {
  validatePathWithinProject(featureDir);
  try {
    const decisionsPath = path.join(featureDir, 'suggestion-decisions.yaml');
    const suggestionsPath = path.join(featureDir, 'suggestions.yaml');

    // Check if file is corrupted
    const corruptionCheck = await detectCorruption(decisionsPath, 'suggestion-decisions');

    if (!corruptionCheck.corrupted) {
      return {
        success: true,
        method: 'no_recovery_needed',
        message: 'File is not corrupted'
      };
    }

    // Try to recover from backup
    const backupRecovery = await recoverFromBackup(decisionsPath);
    if (backupRecovery.success) {
      // Verify recovered file is not corrupted
      const verifyCheck = await detectCorruption(decisionsPath, 'suggestion-decisions');
      if (!verifyCheck.corrupted) {
        return {
          success: true,
          method: 'backup',
          message: `Recovered from backup: ${backupRecovery.restoredFrom}`
        };
      }
    }

    // No valid backup - recreate from suggestions.yaml by extracting IDs
    if (fs.existsSync(suggestionsPath)) {
      const suggestionsContent = fs.readFileSync(suggestionsPath, 'utf8');

      // Parse suggestions to create pending decisions
      const suggestionLines = suggestionsContent.split('\n');
      const suggestionIds = [];

      // Extract all suggestion IDs from YAML (pattern: "id: <uuid>")
      for (const line of suggestionLines) {
        const idMatch = line.match(/^\s*-?\s*id:\s*(.+)$/);
        if (idMatch) {
          suggestionIds.push(idMatch[1].trim());
        }
      }

      // Create pending decisions for each suggestion
      let decisionsContent = '';
      for (const suggestionId of suggestionIds) {
        decisionsContent += `- suggestion_id: ${suggestionId}\n`;
        decisionsContent += `  decision: pending\n`;
        decisionsContent += `  decided_at: null\n`;
        decisionsContent += `  reason: null\n`;
      }

      // If no suggestions, create empty array
      if (suggestionIds.length === 0) {
        decisionsContent = '[]\n';
      }

      fs.writeFileSync(decisionsPath, decisionsContent, 'utf8');

      return {
        success: true,
        method: 'recreate_from_suggestions',
        message: `Recreated ${suggestionIds.length} pending decisions from suggestions: ${suggestionIds.join(', ')}`
      };
    }

    // No suggestions file - create empty decisions
    fs.writeFileSync(decisionsPath, '[]\n', 'utf8');

    return {
      success: true,
      method: 'create_empty',
      message: 'Created empty suggestion-decisions.yaml (no suggestions found)'
    };
  } catch (error) {
    return {
      success: false,
      method: 'failed',
      message: `Recovery failed: ${error.message}`
    };
  }
}

/**
 * Recover from state inconsistencies between exploration session, suggestions, and decisions
 * @param {string} featureDir - Feature directory path
 * @returns {Promise<{success: boolean, fixes: string[], message: string}>}
 */
export async function recoverStateInconsistency(featureDir) {
  validatePathWithinProject(featureDir);
  const fixes = [];

  try {
    const sessionPath = path.join(featureDir, 'exploration-session.yaml');
    const suggestionsPath = path.join(featureDir, 'suggestions.yaml');
    const decisionsPath = path.join(featureDir, 'suggestion-decisions.yaml');

    const sessionExists = fs.existsSync(sessionPath);
    const suggestionsExist = fs.existsSync(suggestionsPath);
    const decisionsExist = fs.existsSync(decisionsPath);

    // Check 1: If exploration-session exists but suggestions missing → set session status to 'failed'
    if (sessionExists && !suggestionsExist) {
      const sessionContent = fs.readFileSync(sessionPath, 'utf8');

      // Check if status is not already 'failed'
      if (!sessionContent.includes('status: failed')) {
        const updatedContent = sessionContent.replace(
          /status:\s*\w+/,
          'status: failed'
        ).replace(
          /failure_reason:\s*null/,
          'failure_reason: "Suggestions file missing - possible pipeline failure"'
        );

        fs.writeFileSync(sessionPath, updatedContent, 'utf8');
        fixes.push('Set exploration-session status to failed (suggestions missing)');
      }
    }

    // Check 2: If suggestions exist but decisions missing → create empty decisions
    if (suggestionsExist && !decisionsExist) {
      fs.writeFileSync(decisionsPath, '[]\n', 'utf8');
      fixes.push('Created empty suggestion-decisions.yaml');
    }

    // Check 3: If suggestion count doesn't match session.suggestions_generated_count → update count
    if (sessionExists && suggestionsExist) {
      const sessionContent = fs.readFileSync(sessionPath, 'utf8');
      const suggestionsContent = fs.readFileSync(suggestionsPath, 'utf8');

      // Count suggestions (count "- id:" patterns)
      const suggestionCount = (suggestionsContent.match(/^\s*-?\s*id:\s*/gm) || []).length;

      // Extract current count from session
      const countMatch = sessionContent.match(/suggestions_generated_count:\s*(\d+)/);
      const currentCount = countMatch ? parseInt(countMatch[1], 10) : 0;

      if (suggestionCount !== currentCount) {
        const updatedContent = sessionContent.replace(
          /suggestions_generated_count:\s*\d+/,
          `suggestions_generated_count: ${suggestionCount}`
        );

        fs.writeFileSync(sessionPath, updatedContent, 'utf8');
        fixes.push(`Updated suggestion count from ${currentCount} to ${suggestionCount}`);
      }
    }

    return {
      success: true,
      fixes,
      message: fixes.length > 0
        ? `Applied ${fixes.length} fixes`
        : 'No inconsistencies detected'
    };
  } catch (error) {
    return {
      success: false,
      fixes,
      message: `State recovery failed: ${error.message}`
    };
  }
}
