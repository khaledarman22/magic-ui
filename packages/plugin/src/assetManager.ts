import {
  sha256,
  sanitizeSvg,
  type Command,
  type CommandResult,
  type AssetResolution,
  MagicUiError,
  failure,
} from '@magic-ui/shared';
import {
  readIdentity as read,
  writeIdentity as write,
  drift,
  renderState,
} from './designSystemIdentity';
import { ensureProjectPage } from './projectLayout';
import { snapshot } from './designRenderer';
type StoredAsset = { hash: string; imageHash?: string; componentId?: string };
let pending:
  | { key: string; bytes: Uint8Array; received: number; mime: string }
  | undefined;
const keyFor = (hash: string) => `asset:${hash}`;
export function storedAsset(hash: string): StoredAsset | undefined {
  const raw = read(figma.root, keyFor(hash));
  if (!raw) return undefined;
  return JSON.parse(raw) as StoredAsset;
}
function active(
  input: { pageId: string; documentId: string },
  cancelled: () => boolean,
) {
  if (cancelled()) throw new MagicUiError(failure('CANCELLED', 'Cancelled.'));
  if (figma.currentPage.id !== input.pageId)
    throw new MagicUiError(failure('PAGE_CHANGED', 'Page changed.'));
  const doc = read(figma.root, 'documentId');
  if (doc && doc !== input.documentId)
    drift('Asset belongs to another document.');
}
export async function receiveAssetChunk(
  input: Extract<Command, { command: 'assetChunk' }>['input'],
  cancelled: () => boolean,
): Promise<Extract<CommandResult, { command: 'assetChunk' }>['result']> {
  if (renderState.busy)
    throw new MagicUiError(
      failure('SESSION_BUSY', 'Another write is running.'),
    );
  renderState.busy = true;
  try {
    active(input, cancelled);
    const existing = storedAsset(input.hash);
    if (existing) {
      if (existing.imageHash && !figma.getImageByHash(existing.imageHash))
        drift('Registered image is missing.');
      if (existing.componentId) {
        const c = await figma.getNodeByIdAsync(existing.componentId);
        active(input, cancelled);
        if (
          !c ||
          c.type !== 'COMPONENT' ||
          read(c, 'assetHash') !== input.hash ||
          iconSnapshot(c) !== read(c, 'assetGuard')
        )
          drift('Registered icon was edited or removed.');
      }
      return {
        received: input.total,
        complete: true,
        ...(existing.imageHash ? { imageHash: existing.imageHash } : {}),
        ...(existing.componentId ? { componentId: existing.componentId } : {}),
      };
    }
    const key = `${input.documentId}:${input.projectId}:${input.hash}:${input.transferHash}`;
    if (input.offset === 0)
      pending = {
        key,
        bytes: new Uint8Array(input.total),
        received: 0,
        mime: input.mime,
      };
    if (
      !pending ||
      pending.key !== key ||
      pending.bytes.length !== input.total ||
      pending.mime !== input.mime ||
      pending.received !== input.offset ||
      !input.bytes.length ||
      input.offset + input.bytes.length > input.total
    )
      throw new Error('Invalid asset chunk sequence; restart at offset zero.');
    pending.bytes.set(input.bytes, input.offset);
    pending.received += input.bytes.length;
    if (pending.received !== input.total)
      return { received: pending.received, complete: false };
    const bytes = pending.bytes;
    pending = undefined;
    if (
      sha256(bytes) !== input.transferHash ||
      (input.mime !== 'image/svg+xml' && input.transferHash !== input.hash)
    )
      throw new Error('Asset SHA-256 mismatch.');
    let record: StoredAsset;
    if (input.mime === 'image/svg+xml') {
      const svg = sanitizeSvg(
        decodeURIComponent(
          [...bytes].map((b) => `%${b.toString(16).padStart(2, '0')}`).join(''),
        ),
      );
      const { workspace } = await ensureProjectPage(
        input.projectId,
        'components',
        'Components',
      );
      active(input, cancelled);
      const c = figma.createComponent();
      write(c, 'assetHash', input.hash);
      write(c, 'id', `icon:${input.hash}`);
      write(c, 'projectId', input.projectId);
      c.name = `Icon / ${input.assetId}`;
      workspace.appendChild(c);
      // Publish the identity before importing; a failure remains visible and cannot create duplicates.
      record = { hash: input.hash, componentId: c.id };
      write(figma.root, keyFor(input.hash), JSON.stringify(record));
      const vector = figma.createNodeFromSvg(svg);
      c.appendChild(vector);
      const identify = (n: SceneNode, path: string) => {
        write(n, 'id', `asset-vector:${input.hash}:${path}`);
        if ('children' in n)
          n.children.forEach((child, i) => identify(child, `${path}-${i}`));
      };
      identify(vector, '0');
      c.resize(vector.width, vector.height);
      c.fills = [];
      vector.x = 0;
      vector.y = 0;
      write(c, 'assetGuard', iconSnapshot(c));
    } else {
      const image = figma.createImage(bytes);
      record = { hash: input.hash, imageHash: image.hash };
      write(figma.root, keyFor(input.hash), JSON.stringify(record));
    }
    write(figma.root, 'documentId', input.documentId);
    return {
      received: input.total,
      complete: true,
      ...(record.imageHash ? { imageHash: record.imageHash } : {}),
      ...(record.componentId ? { componentId: record.componentId } : {}),
    };
  } finally {
    renderState.busy = false;
  }
}
function iconSnapshot(node: SceneNode): string {
  return JSON.stringify({
    snapshot: snapshot(node),
    width: node.width,
    height: node.height,
    relativeTransform: node.relativeTransform,
    vectorPaths: node.type === 'VECTOR' ? node.vectorPaths : undefined,
    children: 'children' in node ? node.children.map(iconSnapshot) : [],
  });
}
const sources = new Map<string, ComponentNode>();
export function boundAsset(projectId: string, id: string): AssetResolution {
  const hash = read(figma.root, `assetRef:${projectId}:${id}`);
  return { id, hash: hash || null };
}
export function assetSource(hash: string | null) {
  return hash ? sources.get(hash) : undefined;
}
export async function bindAssets(
  input: Extract<Command, { command: 'assetBindings' }>['input'],
  cancelled: () => boolean,
) {
  if (renderState.busy)
    throw new MagicUiError(
      failure('SESSION_BUSY', 'Another write is running.'),
    );
  active(input, cancelled);
  for (const asset of input.assets)
    if (asset.hash && !storedAsset(asset.hash))
      throw new Error('Upload assets before binding.');
  for (const asset of input.assets)
    write(
      figma.root,
      `assetRef:${input.projectId}:${asset.id}`,
      asset.hash ?? '',
    );
  return { bound: input.assets.length };
}
export async function preflightAsset(asset: AssetResolution | undefined) {
  if (!asset) return undefined;
  if (!asset.hash) {
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
    return undefined;
  }
  const record = storedAsset(asset.hash);
  if (!record) throw new Error('Upload registered asset before rendering.');
  if (record.imageHash && !figma.getImageByHash(record.imageHash))
    drift('Missing uploaded image.');
  if (record.componentId) {
    const c = await figma.getNodeByIdAsync(record.componentId);
    if (
      !c ||
      c.type !== 'COMPONENT' ||
      read(c, 'assetHash') !== asset.hash ||
      iconSnapshot(c) !== read(c, 'assetGuard')
    )
      drift('Icon source changed or disappeared.');
    sources.set(asset.hash, c);
    return c;
  }
  return undefined;
}
export function applyAsset(
  node: FrameNode | ComponentNode,
  asset: AssetResolution,
  source?: ComponentNode,
) {
  const record = asset.hash ? storedAsset(asset.hash) : undefined;
  const children = node.children;
  if (children.some((n) => !read(n, 'assetChild')))
    drift('Asset frame contains user content.');
  // Retain generated children and their identities. Hide the missing label when the file arrives.
  for (const child of children) child.visible = false;
  if (!record) {
    let label = children.find((n) => read(n, 'assetChild') === 'missing');
    if (label && label.type !== 'TEXT') drift('Invalid missing asset label.');
    if (!label) {
      label = figma.createText();
      write(label, 'assetChild', 'missing');
      write(label, 'id', `asset-label:${read(node, 'id')}`);
      node.appendChild(label);
    }
    if (label.type !== 'TEXT') return;
    label.fontName = { family: 'Inter', style: 'Regular' };
    label.characters = `Missing asset: ${asset.id}`;
    label.fontSize = 14;
    label.textAutoResize = 'HEIGHT';
    label.resize(Math.max(1, node.width), 20);
    label.x = 0;
    label.y = 0;
    label.visible = true;
    node.fills = [{ type: 'SOLID', color: { r: 1, g: 0.9, b: 0.8 } }];
  } else if (record.imageHash)
    node.fills = [
      { type: 'IMAGE', imageHash: record.imageHash, scaleMode: 'FILL' },
    ];
  else if (source) {
    let instance = children.find((n) => read(n, 'assetChild') === 'icon');
    if (instance && instance.type !== 'INSTANCE')
      drift('Invalid icon instance.');
    if (!instance) {
      instance = source.createInstance();
      write(instance, 'assetChild', 'icon');
      write(instance, 'id', `asset-icon:${read(node, 'id')}`);
      node.appendChild(instance);
    }
    if (instance.type === 'INSTANCE') {
      instance.swapComponent(source);
      instance.resize(node.width, node.height);
      instance.x = 0;
      instance.y = 0;
      instance.visible = true;
    }
  }
  write(node, 'assetResolution', JSON.stringify(asset));
}
export function assetChildrenSnapshot(node: SceneNode): string | undefined {
  return read(node, 'assetResolution') && 'children' in node
    ? JSON.stringify(node.children.map(iconSnapshot))
    : undefined;
}
