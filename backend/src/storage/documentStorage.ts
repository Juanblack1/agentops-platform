import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { BlobServiceClient } from "@azure/storage-blob";
import type { DocumentStorageObject } from "../domain/types";

export interface StoreDocumentInput {
  filename: string;
  contentType: string;
  bytes: Buffer;
}

export interface DocumentStorage {
  store(input: StoreDocumentInput): Promise<DocumentStorageObject>;
}

export class LocalDocumentStorage implements DocumentStorage {
  constructor(private readonly baseDir: string) {}

  async store(input: StoreDocumentInput): Promise<DocumentStorageObject> {
    const now = new Date().toISOString();
    const safeName = sanitizeFilename(input.filename);
    const key = `${randomUUID()}${extname(safeName) || ".txt"}`;
    const directory = resolve(this.baseDir);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, key), input.bytes);

    return {
      provider: "local",
      key,
      filename: safeName,
      contentType: input.contentType,
      bytes: input.bytes.byteLength,
      storedAt: now
    };
  }
}

export class AzureBlobDocumentStorage implements DocumentStorage {
  constructor(
    private readonly connectionString: string,
    private readonly containerName: string
  ) {}

  async store(input: StoreDocumentInput): Promise<DocumentStorageObject> {
    const now = new Date().toISOString();
    const safeName = sanitizeFilename(input.filename);
    const key = `${randomUUID()}-${safeName}`;
    const service = BlobServiceClient.fromConnectionString(this.connectionString);
    const container = service.getContainerClient(this.containerName);
    await container.createIfNotExists();
    const blob = container.getBlockBlobClient(key);
    await blob.uploadData(input.bytes, {
      blobHTTPHeaders: {
        blobContentType: input.contentType
      },
      metadata: {
        originalFilename: safeName,
        storedAt: now
      }
    });

    return {
      provider: "azure-blob",
      key,
      url: blob.url,
      filename: safeName,
      contentType: input.contentType,
      bytes: input.bytes.byteLength,
      storedAt: now
    };
  }
}

function sanitizeFilename(filename: string) {
  const name = basename(filename || "document.txt");
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 140) || "document.txt";
}
