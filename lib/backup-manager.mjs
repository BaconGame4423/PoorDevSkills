/**
 * Backup manager utility for Best Practice and Tool Suggestion Phase
 * Handles automatic backup and recovery for critical YAML state files
 */

import fs from 'fs';
import path from 'path';

/**
 * Create a timestamped backup of the file before writing
 * @param {string} filePath - Path to the file to backup
 * @returns {Promise<string|null>} - Path to backup file, or null if source doesn't exist
 */
export async function createBackup(filePath) {
  try {
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

    // Generate timestamp in ISO format
    const timestamp = new Date().toISOString().replace(/[:.]/g, '').replace('T', 'T').split('.')[0] + 'Z';
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
    const dir = path.dirname(filePath);
    const basename = path.basename(filePath, path.extname(filePath));
    const backupDir = path.join(dir, '.backups');

    if (!fs.existsSync(backupDir)) {
      return [];
    }

    // Read all files in backup directory
    const files = fs.readdirSync(backupDir);

    // Filter files matching the pattern
    const pattern = new RegExp(`^${basename}-\\d{8}T\\d{6}Z\\.yaml$`);
    const backups = files
      .filter(file => pattern.test(file))
      .map(file => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        // Extract timestamp from filename
        const match = file.match(/(\d{8}T\d{6}Z)/);
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
    const dir = path.dirname(filePath);
    const basename = path.basename(filePath, path.extname(filePath));
    const backupDir = path.join(dir, '.backups');

    if (!fs.existsSync(backupDir)) {
      return { deleted: 0, kept: 0 };
    }

    // Read all files in backup directory
    const files = fs.readdirSync(backupDir);
    const pattern = new RegExp(`^${basename}-\\d{8}T\\d{6}Z\\.yaml$`);

    const backups = files
      .filter(file => pattern.test(file))
      .map(file => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        const match = file.match(/(\d{8}T\d{6}Z)/);
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
    const backupDir = path.join(featureDir, '.backups');
    const targetDir = archiveDir || path.join(featureDir, '.completed-backups');

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
