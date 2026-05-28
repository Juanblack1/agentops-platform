import { randomUUID } from "node:crypto";
import type { Classification, DocumentChunk } from "../domain/types";

interface ChunkInput {
  documentId: string;
  content: string;
  tags: string[];
  classification: Classification;
  maxLength?: number;
  overlap?: number;
}

export function chunkText(input: ChunkInput): DocumentChunk[] {
  const maxLength = input.maxLength ?? 900;
  const overlap = input.overlap ?? 120;
  const normalized = input.content.replace(/\r\n/g, "\n").trim();

  if (!normalized) {
    return [];
  }

  const chunks: DocumentChunk[] = [];
  let cursor = 0;
  let index = 0;

  while (cursor < normalized.length) {
    const end = Math.min(cursor + maxLength, normalized.length);
    const slice = normalized.slice(cursor, end);
    const lastBreak = slice.lastIndexOf("\n\n");
    const shouldRespectParagraph = lastBreak > maxLength * 0.45 && end !== normalized.length;
    const content = shouldRespectParagraph ? slice.slice(0, lastBreak).trim() : slice.trim();

    if (content) {
      chunks.push({
        id: randomUUID(),
        documentId: input.documentId,
        content,
        index,
        tags: input.tags,
        classification: input.classification
      });
      index += 1;
    }

    if (end === normalized.length) {
      break;
    }

    const nextCursor = shouldRespectParagraph ? cursor + lastBreak : end;
    cursor = Math.max(nextCursor - overlap, cursor + 1);
  }

  return chunks;
}
