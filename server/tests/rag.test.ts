import test from "node:test";
import assert from "node:assert/strict";
import { createChunks, createEmbedding, retrieveRelevantChunks } from "../src/rag";

test("chunking produces meaningful text segments", () => {
  const text = "Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu. ".repeat(3);
  const chunks = createChunks(text, 30);

  assert.ok(chunks.length >= 2);
  assert.ok(chunks.every((chunk) => chunk.trim().length > 0));
});

test("embeddings and retrieval surface the best matching chunk", () => {
  const chunks = [
    "Photosynthesis converts light energy into chemical energy in plants.",
    "The mitochondria produce ATP for cellular work.",
    "In algebra, variables represent unknown values in equations.",
  ];

  const embeddings = chunks.map((chunk) => createEmbedding(chunk));
  const results = retrieveRelevantChunks(chunks, embeddings, "What is photosynthesis", 2);

  assert.equal(results[0].text, chunks[0]);
});
