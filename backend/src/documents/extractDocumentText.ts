import { convert as htmlToText } from "html-to-text";
import mammoth from "mammoth";
import readXlsxFile from "read-excel-file/node";
import { TextDecoder } from "node:util";

export type UploadedDocumentFormat =
  | "text"
  | "markdown"
  | "csv"
  | "json"
  | "yaml"
  | "xml"
  | "html"
  | "pdf"
  | "docx"
  | "xlsx";

export interface ExtractDocumentTextInput {
  filename: string;
  mimetype: string;
  buffer: Buffer;
}

export interface ExtractDocumentTextResult {
  content: string;
  format: UploadedDocumentFormat;
}

export class DocumentExtractionError extends Error {
  constructor(
    readonly statusCode: number,
    readonly error: string,
    message: string
  ) {
    super(message);
    this.name = "DocumentExtractionError";
  }
}

const supportedExtensions = new Map<string, UploadedDocumentFormat>([
  [".txt", "text"],
  [".log", "text"],
  [".conf", "text"],
  [".ini", "text"],
  [".sql", "text"],
  [".md", "markdown"],
  [".markdown", "markdown"],
  [".csv", "csv"],
  [".tsv", "csv"],
  [".json", "json"],
  [".jsonl", "json"],
  [".yaml", "yaml"],
  [".yml", "yaml"],
  [".xml", "xml"],
  [".html", "html"],
  [".htm", "html"],
  [".pdf", "pdf"],
  [".docx", "docx"],
  [".xlsx", "xlsx"]
]);

const supportedMimes = new Map<string, UploadedDocumentFormat>([
  ["text/plain", "text"],
  ["text/markdown", "markdown"],
  ["application/markdown", "markdown"],
  ["text/csv", "csv"],
  ["text/tab-separated-values", "csv"],
  ["application/json", "json"],
  ["application/x-ndjson", "json"],
  ["application/yaml", "yaml"],
  ["application/x-yaml", "yaml"],
  ["application/xml", "xml"],
  ["text/xml", "xml"],
  ["text/html", "html"],
  ["application/xhtml+xml", "html"],
  ["application/pdf", "pdf"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"]
]);

export const supportedUploadDescription =
  "PDF, DOCX, XLSX, TXT, Markdown, CSV/TSV, JSON/JSONL, YAML/YML, XML, HTML, LOG, CONF, INI e SQL";

export async function extractDocumentText(input: ExtractDocumentTextInput): Promise<ExtractDocumentTextResult> {
  const format = detectFormat(input.filename, input.mimetype);

  if (!format) {
    throw new DocumentExtractionError(
      415,
      "unsupported_media_type",
      `Formato nao suportado. Envie ${supportedUploadDescription}.`
    );
  }

  const content =
    format === "pdf"
      ? await extractPdfText(input.buffer)
      : format === "docx"
        ? await extractDocxText(input.buffer)
        : format === "xlsx"
          ? await extractXlsxText(input.buffer)
          : extractUtf8Text(input.buffer, format);

  return {
    content: validateExtractedText(content),
    format
  };
}

function detectFormat(filename: string, mimetype: string): UploadedDocumentFormat | null {
  const extension = extensionOf(filename);
  const formatFromExtension = supportedExtensions.get(extension);

  if (formatFromExtension) {
    return formatFromExtension;
  }

  const normalizedMime = mimetype.toLowerCase().split(";")[0]?.trim();
  const formatFromMime = normalizedMime ? supportedMimes.get(normalizedMime) : undefined;

  if (formatFromMime && isExtensionOptionalForMime(formatFromMime, extension)) {
    return formatFromMime;
  }

  return null;
}

function isExtensionOptionalForMime(format: UploadedDocumentFormat, extension: string) {
  return !extension && format !== "docx" && format !== "xlsx";
}

async function extractPdfText(buffer: Buffer) {
  ensurePdfTextExtractionGlobals();
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    stopAtErrors: true
  });

  try {
    const result = await parser.getText();
    return result.text;
  } catch {
    throw new DocumentExtractionError(400, "unsupported_document", "Nao foi possivel ler texto deste PDF.");
  } finally {
    await parser.destroy();
  }
}

function ensurePdfTextExtractionGlobals() {
  const globals = globalThis as Record<string, unknown>;

  if (globals.DOMMatrix) {
    return;
  }

  globals.DOMMatrix = LightweightDOMMatrix;
}

class LightweightDOMMatrix {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;

  constructor(init?: number[]) {
    if (!Array.isArray(init)) {
      return;
    }

    [this.a, this.b, this.c, this.d, this.e, this.f] = [
      init[0] ?? this.a,
      init[1] ?? this.b,
      init[2] ?? this.c,
      init[3] ?? this.d,
      init[4] ?? this.e,
      init[5] ?? this.f
    ];
  }

  multiplySelf() {
    return this;
  }

  preMultiplySelf() {
    return this;
  }

  translate() {
    return this;
  }

  scale() {
    return this;
  }

  invertSelf() {
    return this;
  }
}

async function extractDocxText(buffer: Buffer) {
  try {
    const result = await mammoth.extractRawText({
      buffer
    });
    return result.value;
  } catch {
    throw new DocumentExtractionError(400, "unsupported_document", "Nao foi possivel ler texto deste DOCX.");
  }
}

async function extractXlsxText(buffer: Buffer) {
  try {
    const sheets = await readXlsxFile(buffer);
    return sheets
      .map((sheet) => {
        const rows = sheet.data
          .map((row) => row.map(formatCellValue).filter(Boolean).join("\t"))
          .filter(Boolean)
          .join("\n");
        return rows ? `Planilha: ${sheet.sheet}\n${rows}` : "";
      })
      .filter(Boolean)
      .join("\n\n");
  } catch {
    throw new DocumentExtractionError(400, "unsupported_document", "Nao foi possivel ler texto deste XLSX.");
  }
}

function extractUtf8Text(buffer: Buffer, format: UploadedDocumentFormat) {
  let content: string;

  try {
    content = new TextDecoder("utf-8", {
      fatal: true
    }).decode(buffer);
  } catch {
    throw new DocumentExtractionError(400, "unsupported_document", "O arquivo precisa estar em UTF-8 ou em um formato suportado.");
  }

  if (format === "html") {
    return htmlToText(content, {
      selectors: [
        { selector: "script", format: "skip" },
        { selector: "style", format: "skip" },
        { selector: "img", format: "skip" }
      ],
      wordwrap: false
    });
  }

  return content;
}

function validateExtractedText(content: string) {
  const normalized = content
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (normalized.length < 20) {
    throw new DocumentExtractionError(
      400,
      "empty_document",
      "O arquivo foi recebido, mas nao tem texto suficiente para alimentar a base de conhecimento."
    );
  }

  return normalized;
}

function formatCellValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value).trim();
}

function extensionOf(filename: string) {
  const normalized = filename.toLowerCase().trim();
  const dotIndex = normalized.lastIndexOf(".");
  return dotIndex >= 0 ? normalized.slice(dotIndex) : "";
}
