import DOMPurify from 'dompurify';

/**
 * Sanitize HTML string to prevent XSS.
 * Use this whenever inserting user content into innerHTML.
 */
export function sanitize(dirty: string): string {
    return DOMPurify.sanitize(dirty);
}
