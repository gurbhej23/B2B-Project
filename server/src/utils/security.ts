/**
 * Safely escapes characters with special meaning in regular expressions
 * to protect against ReDoS (Regular Expression Denial of Service)
 * and prevent SyntaxError crashes on user input containing special symbols.
 */
export function escapeRegex(text: string): string {
  if (!text) return '';
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
