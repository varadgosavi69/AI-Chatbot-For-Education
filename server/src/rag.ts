export interface RagChunk {
  id: string;
  text: string;
  embedding: number[];
}

export interface RagMatch {
  text: string;
  score: number;
}

export function createChunks(text: string, chunkSize = 600): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const words = normalized.split(" ");
  const chunks: string[] = [];

  for (let index = 0; index < words.length; index += chunkSize) {
    const slice = words.slice(index, index + chunkSize).join(" ");
    if (slice.trim()) chunks.push(slice.trim());
  }

  return chunks.length > 0 ? chunks : [normalized];
}

export function createEmbedding(text: string): number[] {
  const normalized = text.toLowerCase();
  const values = new Array(16).fill(0);
  for (let index = 0; index < normalized.length; index += 1) {
    const charCode = normalized.charCodeAt(index);
    values[index % values.length] += charCode;
  }
  return values.map((value) => Number((value / Math.max(1, normalized.length)).toFixed(4)));
}

export function retrieveRelevantChunks(
  chunks: string[],
  embeddings: number[][],
  question: string,
  topK = 4
): RagMatch[] {
  const queryEmbedding = createEmbedding(question);

  const scored = chunks.map((text, index) => {
    const embedding = embeddings[index] || [];
    const score = dotProduct(queryEmbedding, embedding);
    return { text, score };
  });

  return scored
    .sort((left, right) => right.score - left.score)
    .slice(0, topK)
    .filter((entry) => entry.score > 0);
}

function dotProduct(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  let total = 0;
  for (let index = 0; index < length; index += 1) {
    total += left[index] * right[index];
  }
  return total;
}
