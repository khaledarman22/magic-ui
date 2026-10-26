import { constants } from 'node:fs';
import { open, realpath, lstat, mkdir, rename, unlink } from 'node:fs/promises';
import { resolve, relative, join, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import {
  basicMockupSources,
  assetManifestSchema,
  assetRecordSchema,
  registerAssetSchema,
  MAX_ASSET_BYTES,
  sanitizeSvg,
  sha256,
  type AssetManifest,
  type AssetRecord,
} from '@magic-ui/shared';
import type { DesignWorkspace } from './designWorkspace.js';
import type { BridgeConnection } from '@magic-ui/shared';
function absent(error: unknown) {
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}
export async function readAssetFile(root: string, path: string) {
  const target = resolve(root, path),
    rel = relative(root, target);
  if (isAbsolute(path) || rel.startsWith('..') || isAbsolute(rel) || !rel)
    throw new Error('Asset path must stay inside the workspace.');
  if ((await realpath(target)) !== target)
    throw new Error('Asset symlinks are forbidden.');
  const file = await open(
    target,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size < 1 || stat.size > MAX_ASSET_BYTES)
      throw new Error('Asset must be a regular file of 1 byte–8 MiB.');
    const data = Buffer.alloc(stat.size + 1);
    let offset = 0;
    while (offset < data.length) {
      const { bytesRead } = await file.read(
        data,
        offset,
        data.length - offset,
        null,
      );
      if (!bytesRead) break;
      offset += bytesRead;
    }
    if (offset !== stat.size) throw new Error('Asset changed during read.');
    return data.subarray(0, offset);
  } finally {
    await file.close();
  }
}
function crc32(bytes: Uint8Array) {
  let crc = -1;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ -1) >>> 0;
}
export function inspectAsset(bytes: Buffer) {
  let width = 0,
    height = 0;
  let mime: AssetRecord['mime'];
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    mime = 'image/png';
    let offset = 8,
      header = false,
      end = false;
    let bitDepth = 0,
      colorType = 0,
      interlace = 0;
    const compressed: Buffer[] = [];
    while (offset + 12 <= bytes.length) {
      const length = bytes.readUInt32BE(offset),
        type = bytes.toString('ascii', offset + 4, offset + 8);
      if (
        offset + 12 + length > bytes.length ||
        crc32(bytes.subarray(offset + 4, offset + 8 + length)) !==
          bytes.readUInt32BE(offset + 8 + length)
      )
        throw new Error('Invalid PNG chunk.');
      if (!header && type !== 'IHDR') throw new Error('Missing PNG header.');
      if (type === 'IHDR') {
        if (header || length !== 13) throw new Error('Invalid PNG header.');
        header = true;
        width = bytes.readUInt32BE(offset + 8);
        height = bytes.readUInt32BE(offset + 12);
        bitDepth = bytes[offset + 16]!;
        colorType = bytes[offset + 17]!;
        interlace = bytes[offset + 20]!;
        const depths: Record<number, number[]> = {
          0: [1, 2, 4, 8, 16],
          2: [8, 16],
          3: [1, 2, 4, 8],
          4: [8, 16],
          6: [8, 16],
        };
        if (
          !depths[colorType]?.includes(bitDepth) ||
          bytes[offset + 18] !== 0 ||
          bytes[offset + 19] !== 0 ||
          interlace > 1
        )
          throw new Error('Unsupported PNG header.');
      }
      if (type === 'IDAT')
        compressed.push(bytes.subarray(offset + 8, offset + 8 + length));
      offset += length + 12;
      if (type === 'IEND') {
        if (length || offset !== bytes.length)
          throw new Error('Invalid PNG end.');
        end = true;
        break;
      }
    }
    if (!end || !compressed.length || width * height > 40_000_000)
      throw new Error('Invalid or oversized PNG.');
    const pixels = inflateSync(Buffer.concat(compressed), {
      maxOutputLength: Math.min(320_000_000, height * (width * 8 + 8) + 1024),
    });
    if (!pixels.length) throw new Error('Empty PNG pixels.');
    if (interlace === 0) {
      const channels: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
      const stride =
        Math.ceil((width * channels[colorType]! * bitDepth) / 8) + 1;
      if (pixels.length !== height * stride)
        throw new Error('PNG pixel size differs from its dimensions.');
      for (let row = 0; row < height; row++)
        if (pixels[row * stride]! > 4)
          throw new Error('Invalid PNG row filter.');
    }
  } else if (bytes[0] === 255 && bytes[1] === 216) {
    mime = 'image/jpeg';
    let offset = 2,
      scan = false;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset++] !== 255) throw new Error('Invalid JPEG marker.');
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++]!;
      if (marker === 0xda) {
        scan = true;
        break;
      }
      const size = bytes.readUInt16BE(offset);
      if (size < 2 || offset + size > bytes.length)
        throw new Error('Invalid JPEG segment.');
      if ([0xc0, 0xc1, 0xc2].includes(marker)) {
        if (size < 8) throw new Error('Invalid JPEG dimensions.');
        height = bytes.readUInt16BE(offset + 3);
        width = bytes.readUInt16BE(offset + 5);
      }
      offset += size;
    }
    if (!scan || bytes.at(-2) !== 255 || bytes.at(-1) !== 217)
      throw new Error('Truncated JPEG.');
  } else {
    mime = 'image/svg+xml';
    const svg = sanitizeSvg(bytes.toString('utf8'));
    const tag = svg.slice(0, svg.indexOf('>') + 1);
    const dimension = (name: string) =>
      Number(new RegExp(` ${name}="([0-9.]+)(?:px)?"`).exec(tag)?.[1]);
    const view = / viewBox="([\d.eE+\-\s,]+)"/
      .exec(tag)?.[1]
      ?.trim()
      .split(/[\s,]+/)
      .map(Number);
    width = dimension('width') || view?.[2] || 0;
    height = dimension('height') || view?.[3] || 0;
  }
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    width > 16384 ||
    height > 16384 ||
    width * height > 40_000_000
  )
    throw new Error(
      'Asset dimensions must be valid, at most 16384 per axis and 40 million pixels.',
    );
  return { mime, width, height };
}
export class AssetRegistry {
  private busy = false;
  constructor(private workspace: DesignWorkspace) {}
  async writeMockupSources(projectId: string) {
    const root = await this.workspace.projectDirectory(projectId);
    for (const path of ['assets', 'assets/mockups']) {
      const directory = join(root, path);
      await mkdir(directory, { recursive: true });
      if (
        (await realpath(directory)) !== directory ||
        !(await lstat(directory)).isDirectory()
      )
        throw new Error('Mockup directory must be canonical.');
    }
    const name = 'assets/mockups/basic-shapes.json';
    try {
      await readAssetFile(root, name);
      return;
    } catch (error) {
      if (!absent(error)) throw error;
    }
    const file = await open(join(root, name), 'wx', 0o600);
    try {
      await file.writeFile(JSON.stringify(basicMockupSources, null, 2) + '\n');
    } finally {
      await file.close();
    }
  }
  async read(projectId: string): Promise<AssetManifest> {
    const root = await this.workspace.projectDirectory(projectId);
    try {
      const raw = await readAssetFile(root, 'assets/assets-manifest.json');
      const result = assetManifestSchema.parse(JSON.parse(raw.toString()));
      if (
        result.projectId !== projectId ||
        new Set(result.assets.map((a) => a.id)).size !== result.assets.length ||
        new Set(result.assets.map((a) => a.hash)).size !== result.assets.length
      )
        throw new Error('Invalid asset identities.');
      return result;
    } catch (error) {
      if (absent(error)) return { projectId, assets: [] };
      throw error;
    }
  }
  private async save(manifest: AssetManifest) {
    const root = await this.workspace.projectDirectory(manifest.projectId),
      directory = join(root, 'assets');
    await mkdir(directory, { recursive: true });
    if (
      (await realpath(directory)) !== directory ||
      !(await lstat(directory)).isDirectory()
    )
      throw new Error('Invalid asset directory.');
    const destination = join(directory, 'assets-manifest.json');
    try {
      if (!(await lstat(destination)).isFile())
        throw new Error('Invalid manifest file.');
    } catch (e) {
      if (!absent(e)) throw e;
    }
    const data =
      JSON.stringify(assetManifestSchema.parse(manifest), null, 2) + '\n';
    if (Buffer.byteLength(data) > MAX_ASSET_BYTES)
      throw new Error('Manifest too large.');
    const temporary = join(directory, `.assets-${randomUUID()}.json`),
      file = await open(temporary, 'wx', 0o600);
    try {
      await file.writeFile(data);
      await file.sync();
    } finally {
      await file.close();
    }
    try {
      await rename(temporary, destination);
    } finally {
      await unlink(temporary).catch(() => {});
    }
  }
  private async exclusive<T>(work: () => Promise<T>) {
    if (this.busy) throw new Error('Asset registry busy; retry.');
    this.busy = true;
    try {
      return await work();
    } finally {
      this.busy = false;
    }
  }
  async register(raw: unknown) {
    return this.exclusive(async () => {
      const input = registerAssetSchema.parse(raw),
        root = await this.workspace.projectDirectory(input.projectId);
      const bytes = await readAssetFile(root, input.path),
        info = inspectAsset(bytes),
        hash = sha256(bytes),
        manifest = await this.read(input.projectId);
      const collision = manifest.assets.find(
        (a) => a.id === input.id && a.hash !== hash,
      );
      if (collision)
        throw new Error(
          'Asset ID already has different content. Use a new ID.',
        );
      const existing = manifest.assets.find((a) => a.hash === hash);
      if (existing) {
        if (existing.path !== input.path) {
          existing.path = input.path;
          await this.save(manifest);
        }
        return existing;
      }
      const asset = assetRecordSchema.parse({
        id: input.id ?? `asset-${hash}`,
        name: input.name,
        path: input.path,
        hash,
        ...info,
        size: bytes.length,
        source: input.source,
        license: input.license,
        usages: [],
        optimization: 'original',
      });
      manifest.assets.push(asset);
      await this.save(manifest);
      return asset;
    });
  }
  async resolve(projectId: string, ids: string[]) {
    const manifest = await this.read(projectId),
      root = await this.workspace.projectDirectory(projectId);
    return Promise.all(
      [...new Set(ids)].map(async (id) => {
        const asset = manifest.assets.find((a) => a.id === id);
        if (!asset) return { id, hash: null, asset: null, bytes: null };
        try {
          const bytes = await readAssetFile(root, asset.path);
          if (sha256(bytes) !== asset.hash)
            throw new Error(
              `Asset content changed: ${id}. Register the new file explicitly.`,
            );
          inspectAsset(bytes);
          return { id, hash: asset.hash, asset, bytes };
        } catch (e) {
          if (absent(e)) return { id, hash: null, asset: null, bytes: null };
          throw e;
        }
      }),
    );
  }
  async upload(
    bridge: BridgeConnection,
    sessionId: string,
    projectId: string,
    pageId: string,
    documentId: string,
    ids: string[],
    signal: AbortSignal,
  ) {
    return this.exclusive(async () => {
      const resolved = await this.resolve(projectId, ids),
        manifest = await this.read(projectId);
      for (const item of resolved) {
        if (!item.asset || !item.bytes) continue;
        const transfer =
          item.asset.mime === 'image/svg+xml'
            ? Buffer.from(sanitizeSvg(item.bytes.toString('utf8')))
            : item.bytes;
        const transferHash = sha256(transfer);
        for (let offset = 0; offset < transfer.length; offset += 8000) {
          const response = await bridge.request(
            sessionId,
            {
              command: 'assetChunk',
              input: {
                projectId,
                pageId,
                documentId,
                assetId: item.id,
                hash: item.asset.hash,
                transferHash,
                mime: item.asset.mime,
                offset,
                total: transfer.length,
                bytes: [...transfer.subarray(offset, offset + 8000)],
              },
            },
            signal,
          );
          if (response.command !== 'assetChunk')
            throw new Error('Unexpected asset response.');
          if (response.result.complete) {
            const record = manifest.assets.find((a) => a.id === item.id)!;
            record.figma = record.figma.filter(
              (f) => f.documentId !== documentId,
            );
            record.figma.push({
              documentId,
              ...(response.result.imageHash
                ? { imageHash: response.result.imageHash }
                : {}),
              ...(response.result.componentId
                ? { componentId: response.result.componentId }
                : {}),
            });
            break;
          }
          if (
            response.result.received !==
            Math.min(offset + 8000, transfer.length)
          )
            throw new Error('Asset transfer offset mismatch.');
        }
      }
      await bridge.request(
        sessionId,
        {
          command: 'assetBindings',
          input: {
            projectId,
            pageId,
            documentId,
            assets: resolved.map(({ id, hash }) => ({ id, hash })),
          },
        },
        signal,
      );
      await this.save(manifest);
      return resolved.map(({ id, hash }) => ({ id, hash }));
    });
  }
  async recordUsage(projectId: string, usages: Map<string, string[]>) {
    return this.exclusive(async () => {
      const manifest = await this.read(projectId);
      if (!manifest.assets.length) return;
      for (const asset of manifest.assets)
        asset.usages = [...new Set(usages.get(asset.id) ?? [])];
      await this.save(manifest);
    });
  }
}
