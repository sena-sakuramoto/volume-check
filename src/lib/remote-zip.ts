import { inflateRawSync } from 'node:zlib';

type ZipEntryIndex = {
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
  fileNameLength: number;
  extraFieldLength: number;
};

type ZipIndex = Map<string, ZipEntryIndex>;

const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_FILE_HEADER_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const MAX_EOCD_SEARCH = 12 * 1024 * 1024;

const zipIndexCache = new Map<string, ZipIndex>();

async function fetchRange(url: string, start: number, end: number): Promise<Uint8Array> {
  const response = await fetch(url, {
    headers: { Range: `bytes=${start}-${end}` },
  });
  if (!(response.ok || response.status === 206)) {
    throw new Error(`ZIP range request failed: ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function fetchContentLength(url: string): Promise<number> {
  const response = await fetch(url, { method: 'HEAD' });
  if (!response.ok) {
    throw new Error(`ZIP head request failed: ${response.status}`);
  }
  const length = Number(response.headers.get('Content-Length'));
  if (!Number.isFinite(length) || length <= 0) {
    throw new Error('ZIP content length is unavailable');
  }
  return length;
}

function parseZipIndexFromTail(data: Uint8Array, startOffset: number): ZipIndex {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let eocdOffset = -1;

  for (let i = data.byteLength - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === ZIP_EOCD_SIGNATURE) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset < 0) {
    throw new Error('ZIP EOCD not found');
  }

  const centralDirectorySize = view.getUint32(eocdOffset + 12, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
  const relativeCdOffset = centralDirectoryOffset - startOffset;
  if (relativeCdOffset < 0 || relativeCdOffset + centralDirectorySize > data.byteLength) {
    throw new Error('ZIP central directory is outside fetched range');
  }

  const index: ZipIndex = new Map();
  let ptr = relativeCdOffset;
  const cdEnd = relativeCdOffset + centralDirectorySize;

  while (ptr + 46 <= cdEnd) {
    if (view.getUint32(ptr, true) !== ZIP_CENTRAL_FILE_HEADER_SIGNATURE) {
      break;
    }
    const compressionMethod = view.getUint16(ptr + 10, true);
    const compressedSize = view.getUint32(ptr + 20, true);
    const uncompressedSize = view.getUint32(ptr + 24, true);
    const fileNameLength = view.getUint16(ptr + 28, true);
    const extraFieldLength = view.getUint16(ptr + 30, true);
    const fileCommentLength = view.getUint16(ptr + 32, true);
    const localHeaderOffset = view.getUint32(ptr + 42, true);
    const nameStart = ptr + 46;
    const nameEnd = nameStart + fileNameLength;
    const name = new TextDecoder().decode(data.subarray(nameStart, nameEnd));

    index.set(name, {
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
      fileNameLength,
      extraFieldLength,
    });

    ptr = nameEnd + extraFieldLength + fileCommentLength;
  }

  return index;
}

async function getZipIndex(url: string): Promise<ZipIndex> {
  const cached = zipIndexCache.get(url);
  if (cached) return cached;

  const contentLength = await fetchContentLength(url);
  const tailSize = Math.min(contentLength, MAX_EOCD_SEARCH);
  const start = contentLength - tailSize;
  const tail = await fetchRange(url, start, contentLength - 1);
  const index = parseZipIndexFromTail(tail, start);
  zipIndexCache.set(url, index);
  return index;
}

export async function fetchZipEntry(url: string, entryPath: string): Promise<Uint8Array | null> {
  const index = await getZipIndex(url);
  const entry = index.get(entryPath);
  if (!entry) return null;

  const localHeader = await fetchRange(url, entry.localHeaderOffset, entry.localHeaderOffset + 30 - 1);
  const headerView = new DataView(localHeader.buffer, localHeader.byteOffset, localHeader.byteLength);
  if (headerView.getUint32(0, true) !== ZIP_LOCAL_FILE_HEADER_SIGNATURE) {
    throw new Error('ZIP local header is invalid');
  }
  const localNameLength = headerView.getUint16(26, true);
  const localExtraLength = headerView.getUint16(28, true);
  const dataStart = entry.localHeaderOffset + 30 + localNameLength + localExtraLength;
  const compressed = await fetchRange(url, dataStart, dataStart + entry.compressedSize - 1);

  if (entry.compressionMethod === 0) {
    return compressed;
  }
  if (entry.compressionMethod === 8) {
    return inflateRawSync(compressed);
  }
  throw new Error(`ZIP compression method ${entry.compressionMethod} is not supported`);
}
