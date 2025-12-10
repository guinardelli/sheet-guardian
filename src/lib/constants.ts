// Security and validation constants

// Maximum file size limits (in MB)
export const MAX_FILE_SIZE_MB = 50; // Hard limit regardless of plan
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Warning threshold for large files (in MB)
export const LARGE_FILE_WARNING_MB = 10;
export const LARGE_FILE_WARNING_BYTES = LARGE_FILE_WARNING_MB * 1024 * 1024;

// Allowed file extensions
export const ALLOWED_FILE_EXTENSIONS = ['.xlsm'] as const;

// MIME types for Excel files with macros
export const ALLOWED_MIME_TYPES = [
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream', // Some systems report xlsm as this
] as const;

// Rate limiting
export const MAX_LOGIN_ATTEMPTS = 5;
export const RATE_LIMIT_WINDOW_MINUTES = 15;

// Password requirements
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 100;

// Session timeouts (in milliseconds)
export const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
export const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour
