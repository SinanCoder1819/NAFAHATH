/**
 * 
 
 *
 * @param {string} value 
 * @returns {{ valid: boolean, value?: string, message?: string }}
 */
export function validateName(value) {
    if (!value || typeof value !== 'string') {
        return { valid: false, message: 'Name is required.' };
    }

    const trimmed = value.trim();

    if (trimmed.length === 0) {
        return { valid: false, message: 'Name is required.' };
    }

    if (trimmed.length <= 3) {
        return { valid: false, message: 'Name must be at least 3 characters.' };
    }

    if (trimmed.length > 50) {
        return { valid: false, message: 'Name must not exceed 50 characters.' };
    }

    
    const injectionPattern = /[<>&"`;{}]/;
    if (injectionPattern.test(trimmed)) {
        return { valid: false, message: 'Name contains invalid characters.' };
    }

  
    const hasLetter = /\p{L}/u.test(trimmed);
    if (!hasLetter) {
        return { valid: false, message: 'Name must contain at least one letter.' };
    }

    return { valid: true, value: trimmed };
}






/**
 * 
 *
 * @param {string} value  — raw input from req.body
 * @returns {{ valid: boolean, value?: string, message?: string }}
 *          
 */
export function validatePhone(value) {
    if (value === undefined || value === null || typeof value !== 'string') {
        return { valid: false, message: 'Phone number is required.' };
    }

    const trimmed = value.trim();

    if (trimmed.length === 0) {
        return { valid: false, message: 'Phone number is required.' };
    }

    
    const noSep = trimmed.replace(/[\s\-]/g, '');

    
    if (!/^\d+$/.test(noSep)) {
        return { valid: false, message: 'Phone number must contain digits only.' };
    }

    
    let digits = noSep;
    if (digits.startsWith('+91')) {
        digits = digits.slice(3);                           
    } else if (digits.startsWith('91') && digits.length === 12) {
        digits = digits.slice(2);                           
    } else if (digits.startsWith('0') && digits.length === 11) {
        digits = digits.slice(1);                           
    }

    
    if (digits.length !== 10) {
        return { valid: false, message: 'Phone number must be exactly 10 digits.' };
    }

    // Rule 2: First digit must be 6, 7, 8, or 9
    if (!/^[6-9]/.test(digits)) {
        return { valid: false, message: 'Phone number must start with 6, 7, 8, or 9.' };
    }

    return { valid: true, value: digits };
}

/**
 * Validates a PIN code based on the core rules.
 * - Strips spaces and hyphens.
 * - Must consist of exactly 6 numeric digits.
 * - Starting digit must be between 1 and 9 (cannot start with 0).
 *
 * @param {string} value
 * @returns {{ valid: boolean, value?: string, message?: string }}
 */
export function validatePincode(value) {
    if (value === undefined || value === null || typeof value !== 'string') {
        return { valid: false, message: 'Postal code is required.' };
    }

    const trimmed = value.trim();

    if (trimmed.length === 0) {
        return { valid: false, message: 'Postal code is required.' };
    }

    const cleaned = trimmed.replace(/[\s\-]/g, '');

    if (!/^\d+$/.test(cleaned)) {
        return { valid: false, message: 'Postal code must contain numbers only.' };
    }

    if (cleaned.length !== 6) {
        return { valid: false, message: 'Postal code must be exactly 6 digits.' };
    }

    if (!/^[1-9]/.test(cleaned)) {
        return { valid: false, message: 'Postal code cannot start with 0.' };
    }

    return { valid: true, value: cleaned };
}

/**
 * Validates a password based on strong password rules.
 * - Minimum Length: At least 8 characters.
 * - Uppercase: At least one capital letter (A-Z).
 * - Lowercase: At least one small letter (a-z).
 * - Number: At least one numeric digit (0-9).
 * - Special Character: At least one symbol (e.g. !@#$%^&*).
 *
 * @param {string} value
 * @returns {{ valid: boolean, message?: string }}
 */
export function validatePassword(value) {
    if (!value || typeof value !== 'string') {
        return { valid: false, message: 'Password is required.' };
    }

    if (value.length < 8) {
        return { valid: false, message: 'Password must be at least 8 characters.' };
    }

    if (!/[A-Z]/.test(value)) {
        return { valid: false, message: 'Password must contain at least one uppercase letter.' };
    }

    if (!/[a-z]/.test(value)) {
        return { valid: false, message: 'Password must contain at least one lowercase letter.' };
    }

    if (!/[0-9]/.test(value)) {
        return { valid: false, message: 'Password must contain at least one number.' };
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(value)) {
        return { valid: false, message: 'Password must contain at least one special character (e.g. !@#$%^&*).' };
    }

    return { valid: true };
}
