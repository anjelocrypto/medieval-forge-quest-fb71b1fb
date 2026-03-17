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
function buildPattern(word: string): RegExp {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // For multi-word phrases, don't require word boundaries
  if (word.includes(' ')) {
    return new RegExp(escaped, 'gi');
  }
  // Strict word boundary matching only
  return new RegExp(`\\b${escaped}\\b`, 'gi');
}

// Separate patterns for leet-speak variants of the most offensive terms only
function buildLeetPattern(word: string): RegExp {
  const leetMap: Record<string, string> = {
    'a': '[a@4]', 'e': '[e3]', 'i': '[i1!]', 'o': '[o0]',
    's': '[s$5]', 'l': '[l1]', 't': '[t7]',
  };
  const escaped = word
    .split('')
    .map(c => leetMap[c.toLowerCase()] || c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('');
  return new RegExp(`\\b${escaped}\\b`, 'gi');
}

const PATTERNS = BLOCKED_WORDS.map(buildPattern);

// Only apply leet-speak detection to the worst slurs, not common words like "ass"
const LEET_WORDS = ['fuck', 'shit', 'nigger', 'nigga', 'faggot', 'retard', 'cunt'];
const LEET_PATTERNS = LEET_WORDS.map(buildLeetPattern);

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
