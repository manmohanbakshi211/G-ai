/**
 * Fuzzy search service using Levenshtein distance for typo correction
 * and vocabulary-based autosuggestion.
 */

// ── Levenshtein distance ──
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// ── Vocabulary store (rebuilt periodically from DB) ──
let vocabulary: string[] = [];
let lastRefresh = 0;
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export async function refreshVocabulary(prisma: any) {
  const now = Date.now();
  if (now - lastRefresh < REFRESH_INTERVAL && vocabulary.length > 0) return;

  const products = await prisma.product.findMany({
    select: { productName: true, brand: true, category: true, description: true },
  });
  const stores = await prisma.store.findMany({
    select: { storeName: true, category: true },
  });

  const words = new Set<string>();
  for (const p of products) {
    tokenize(p.productName).forEach(w => words.add(w));
    if (p.brand) tokenize(p.brand).forEach(w => words.add(w));
    if (p.category) tokenize(p.category).forEach(w => words.add(w));
    // Add full product names for phrase suggestions
    words.add(p.productName.toLowerCase().trim());
  }
  for (const s of stores) {
    tokenize(s.storeName).forEach(w => words.add(w));
    if (s.category) tokenize(s.category).forEach(w => words.add(w));
    words.add(s.storeName.toLowerCase().trim());
  }

  vocabulary = [...words].filter(w => w.length >= 2);
  lastRefresh = now;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 2);
}

// ── Spell correction ──
export function correctSpelling(query: string): { corrected: string; didCorrect: boolean } {
  const words = query.toLowerCase().trim().split(/\s+/);
  let didCorrect = false;
  const correctedWords: string[] = [];

  for (const word of words) {
    if (word.length < 2) { correctedWords.push(word); continue; }
    // If the word exists in vocabulary, keep it
    if (vocabulary.includes(word)) { correctedWords.push(word); continue; }

    // Find closest match
    let bestMatch = word;
    let bestDist = Infinity;
    const maxDist = word.length <= 4 ? 1 : 2; // stricter for short words

    for (const v of vocabulary) {
      // Quick length filter
      if (Math.abs(v.length - word.length) > maxDist) continue;
      const dist = levenshtein(word, v);
      if (dist < bestDist && dist <= maxDist) {
        bestDist = dist;
        bestMatch = v;
      }
    }

    if (bestMatch !== word) didCorrect = true;
    correctedWords.push(bestMatch);
  }

  return { corrected: correctedWords.join(' '), didCorrect };
}

// ── Autocomplete suggestions ──
export function getSuggestions(prefix: string, limit = 8): string[] {
  if (!prefix || prefix.length < 1) return [];
  const p = prefix.toLowerCase().trim();
  const results: string[] = [];

  // Prioritise full phrases that start with the prefix
  for (const v of vocabulary) {
    if (v.startsWith(p) && v !== p) {
      results.push(v);
    }
    if (results.length >= limit * 2) break; // collect extras for dedup
  }

  // Then words that contain the prefix
  if (results.length < limit) {
    for (const v of vocabulary) {
      if (!v.startsWith(p) && v.includes(p) && v !== p && !results.includes(v)) {
        results.push(v);
      }
      if (results.length >= limit * 2) break;
    }
  }

  // Sort: shorter = more relevant, then alphabetical
  results.sort((a, b) => a.length - b.length || a.localeCompare(b));
  return results.slice(0, limit);
}
