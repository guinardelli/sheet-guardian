/**
 * Sanitizes a string to prevent XSS attacks
 * Removes potentially dangerous HTML/script content
 */
export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
};

/**
 * Sanitizes email input
 */
export const sanitizeEmail = (email: string): string => {
  if (typeof email !== 'string') return '';
  return email.toLowerCase().trim().slice(0, 255);
};

/**
 * Validates UUID format
 */
export const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Validates and sanitizes numeric input
 */
export const sanitizeNumber = (value: unknown, defaultValue: number = 0): number => {
  const num = Number(value);
  if (isNaN(num) || !isFinite(num)) return defaultValue;
  return num;
};
