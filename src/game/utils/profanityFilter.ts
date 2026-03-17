/**
 * Lightweight profanity filter for display names and chat messages.
 * Blocks common slurs/offensive terms. Expandable word list.
 */

const BLOCKED_WORDS: string[] = [
  // Slurs & hate speech
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'retarded', 'tranny', 'kike', 'spic', 'chink', 'wetback', 'beaner',
  // Sexual
  'fuck', 'shit', 'ass', 'bitch', 'whore', 'slut', 'cunt', 'dick', 'cock', 'pussy', 'porn', 'hentai',
  // Harassment
  'kill yourself', 'kys', 'rape', 'nazi', 'hitler',
  // Scam/phishing
  'free nitro', 'free robux',
];

// Build regex patterns - match whole words, case insensitive
// Also match common letter substitutions: @ for a, 0 for o, 1 for i/l, 3 for e, $ for s
function buildPattern(word: string): RegExp {
  const escaped = word
    .split('')
    .map(c => {
      const lower = c.toLowerCase();
      switch (lower) {
        case 'a': return '[a@4]';
        case 'e': return '[e3]';
        case 'i': return '[i1!|]';
        case 'o': return '[o0]';
        case 's': return '[s$5]';
        case 'l': return '[l1|]';
        case 't': return '[t7]';
        default: return c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
    })
    .join('+'); // Allow repeated chars like "fuuuck"
  
  // For multi-word phrases, don't require word boundaries
  if (word.includes(' ')) {
    return new RegExp(escaped, 'gi');
  }
  // Use word boundary OR camelCase boundary (uppercase letter before/after)
  // This catches "FuckYou", "shitHead" etc.
  return new RegExp(`(?<=^|\\b|[a-z])${escaped}(?=$|\\b|[A-Z])`, 'gi');
}

const PATTERNS = BLOCKED_WORDS.map(buildPattern);

/**
 * Returns true if text contains profanity.
 */
export function containsProfanity(text: string): boolean {
  const normalized = text.toLowerCase();
  return PATTERNS.some(p => p.test(normalized));
}

/**
 * Censors profane words with asterisks.
 */
export function censorText(text: string): string {
  let result = text;
  for (const pattern of PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, (match) => '*'.repeat(match.length));
  }
  return result;
}

/**
 * Validates a display name. Returns cleaned name or fallback.
 */
export function sanitizeDisplayName(raw: string): string {
  const cleaned = raw
    .replace(/<[^>]*>/g, '')
    .replace(/[^\w\s\-_.!?]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20);
  
  if (!cleaned || containsProfanity(cleaned)) {
    return 'Knight';
  }
  return cleaned;
}
