import { preflightAsset, assetChildrenSnapshot } from './assetManager';
import { pageWorkspace } from './projectLayout';
import {
  canonicalJson,
  syncHash,
  MagicUiError,
  failure,
  resolveTokenReferences,
  trashMetadataSchema,
  type SyncScope,
  type SyncLive,
  type SyncStep,
  type Command,
} from '@magic-ui/shared';
import {
  snapshot,
  applyProperties,
  loadSpecificationFonts,
} from './designRenderer';
import {
  readIdentity as read,
  writeIdentity as write,
  renderState,
  projectVariables,
  applyTokenBindings,
  drift,
} from './designSystemIdentity';
import { applyInstance, findVariant } from './designSystemRenderer';

// Hash only fields the renderer owns. Keep a separate conservative guard for
// other manual styling that a Figma setter could incidentally replace.
function managedIndex(node: SceneNode) {
  if (!node.parent || !('children' in node.parent)) return -1;
  return node.parent.children
    .filter(
      (n) =>
        read(n, 'projectId') === read(node, 'projectId') &&
        read(n, 'screenId') === read(node, 'screenId') &&
        read(n, 'id'),
    )
    .indexOf(node);
}
export function ownedSnapshot(node: SceneNode): string {
  const data = JSON.parse(snapshot(node)) as Record<string, unknown>;
  data.managedIndex = managedIndex(node);
  const assetChildren = assetChildrenSnapshot(node);
  if (assetChildren) data.assetChildren = assetChildren;
  for (const key of [
    'children',
    'visible',
    'locked',
    'effects',
    'rotation',
    'blendMode',
    'dashPattern',
    'strokeAlign',
    'clipsContent',
    'textDecoration',
    'textCase',
    'effectStyleId',
  ])
    delete data[key];
  return canonicalJson(data);
}
function guardSnapshot(node: SceneNode): string {
  const data = JSON.parse(snapshot(node)) as Record<string, unknown>;
  data.managedIndex = managedIndex(node);
  const assetChildren = assetChildrenSnapshot(node);
  if (assetChildren) data.assetChildren = assetChildren;
  delete data.children; // Children have their own independent checkpoints.
  if (node.type === 'TEXT')
    data.segments = node.getStyledTextSegments([
      'fontName',
      'fontSize',
      'fills',
      'textDecoration',
      'textCase',
    ]);
  return canonicalJson(data);
}
function active(scope: SyncScope) {
  if (figma.currentPage.id !== scope.pageId)
    throw new MagicUiError(
      failure(
        'PAGE_CHANGED',
        'Select the original target page before continuing.',
      ),
    );
}
async function ownedNodes(scope: SyncScope): Promise<SceneNode[]> {
  const result: SceneNode[] = [];
  const visit = (node: SceneNode) => {
    if (
      read(node, 'projectId') === scope.projectId &&
      read(node, 'screenId') === scope.screenId &&
      read(node, 'id')
    )
      result.push(node);
    if (node.type !== 'INSTANCE' && 'children' in node)
      node.children.forEach(visit);
  };
  // Include moved identities and Trash; absence from the current page alone is
  // never permission to create another copy of an existing stable identity.
  for (const page of figma.root.children) {
    await page.loadAsync();
    page.children.forEach(visit);
  }
  const ids = new Set<string>();
  for (const node of result) {
    const id = read(node, 'id');
    if (ids.has(id))
      drift('Duplicate stable identity; resolve it before syncing.');
    ids.add(id);
  }
  return result;
}
function isTrashed(node: BaseNode): boolean {
  let current: BaseNode | null = node;
  while (current) {
    if (read(current, 'role') === 'trash' || read(current, 'trash'))
      return true;
    current = current.parent;
  }
  return false;
}
function commitBaseline(node: SceneNode, input: SyncStep) {
  write(figma.root, 'documentId', input.documentId);
  write(node, 'intent', input.entry.intent);
  write(node, 'specVersion', input.specVersion);
  write(node, 'hash', syncHash(ownedSnapshot(node)));
  write(node, 'syncGuard', guardSnapshot(node));
  write(node, 'snapshot', snapshot(node));
  write(node, 'operationId', input.operationId);
  if (!input.entry.parentId)
    write(
      figma.currentPage,
      `screen:${input.projectId}:${input.screenId}`,
      node.id,
    );
  return live(node);
}
function live(node: SceneNode): SyncLive {
  // Legacy renderer snapshots can be adopted only when the full old guard still
  // matches. Otherwise preserve the node and require an explicit decision.
  const legacySafe = read(node, 'snapshot') === snapshot(node);
  return {
    localId: read(node, 'id'),
    figmaNodeId: node.id,
    intent: read(node, 'intent'),
    snapshot: guardSnapshot(node),
    baseline:
      read(node, 'syncGuard') || (legacySafe ? guardSnapshot(node) : ''),
    ownedHash: syncHash(ownedSnapshot(node)),
    operationId: read(node, 'operationId'),
    trashed: isTrashed(node),
  };
}
export async function inspectSync(
  input: SyncScope & { localId?: string | undefined },
) {
  const nodes = await ownedNodes(input);
  const node = nodes.find((n) => read(n, 'id') === input.localId);
  return {
    documentId: read(figma.root, 'documentId'),
    projectPageId: read(
      figma.root.children.find((p) => p.id === input.pageId) ??
        figma.currentPage,
      'projectPageId',
    ),
    rootNodeId: read(
      figma.root.children.find((p) => p.id === input.pageId) ??
        figma.currentPage,
      `screen:${input.projectId}:${input.screenId}`,
    ),
    nodes: (input.localId ? [] : nodes).map((n) => ({
      localId: read(n, 'id'),
      figmaNodeId: n.id,
    })),
    live: node ? live(node) : null,
  };
}
function verify(
  node: SceneNode | undefined,
  expectedId: string | null,
  expected: string | null,
) {
  if (
    (node?.id ?? null) !== expectedId ||
    (node ? guardSnapshot(node) : null) !== expected
  )
    drift('Figma changed after inspection. Preview again before applying.');
}
export async function syncStep(
  input: SyncStep,
  cancelled: () => boolean = () => false,
): Promise<SyncLive> {
  if (renderState.busy)
    throw new MagicUiError(
      failure('SESSION_BUSY', 'Another write is running.', true),
    );
  renderState.busy = true;
  try {
    if (cancelled())
      throw new MagicUiError(failure('CANCELLED', 'Cancelled before writes.'));
    active(input);
    const documentId = read(figma.root, 'documentId');
    if (documentId && documentId !== input.documentId)
      drift('Operation belongs to another Figma document.');
    const nodes = await ownedNodes(input);
    let node = nodes.find((n) => read(n, 'id') === input.entry.id);
    verify(node, input.expectedNodeId, input.expectedSnapshot);
    if (node && live(node).trashed)
      drift('Restore this identity from Trash before applying a spec.');
    if (input.action === 'keep-figma') {
      if (cancelled())
        throw new MagicUiError(
          failure('CANCELLED', 'Cancelled before writes.'),
        );
      active(input);
      if (!node) drift('Cannot keep a missing node.');
      verify(node, input.expectedNodeId, input.expectedSnapshot);
      return commitBaseline(node, input);
    }
    const spec = input.entry.specification;
    const resolved = resolveTokenReferences(spec, input.tokens);
    const parent = input.entry.parentId
      ? nodes.find((n) => read(n, 'id') === input.entry.parentId)
      : (pageWorkspace(figma.currentPage, input.projectId) ??
        figma.currentPage);
    if (
      input.action === 'apply-spec' &&
      (!parent || !('insertChild' in parent) || isTrashed(parent))
    )
      drift('Parent is absent or in Trash; restore it before applying.');
    if (
      node &&
      node.type !==
        (spec.type === 'component-instance'
          ? 'INSTANCE'
          : spec.type.toUpperCase())
    )
      drift('Node type changes require a separate explicit migration.');
    await loadSpecificationFonts(resolved);
    await preflightAsset(input.asset);
    const source =
      spec.type === 'component-instance'
        ? await findVariant(input.projectId, spec.componentId, spec.variant)
        : undefined;
    const variables = await projectVariables(input.projectId);
    const styles = (await figma.getLocalTextStylesAsync()).filter(
      (s) => read(s, 'projectId') === input.projectId,
    );
    if (spec.type === 'text' && spec.typography) {
      const style = styles.find((s) => read(s, 'id') === spec.typography);
      if (!style)
        throw new MagicUiError(
          failure('INVALID_INPUT', 'Render typography styles first.'),
        );
      await figma.loadFontAsync(style.fontName);
    }
    // Re-scan after preflight to detect identities created during await gaps.
    const currentNodes = await ownedNodes(input);
    if (currentNodes.find((n) => read(n, 'id') === input.entry.id) !== node)
      drift('Identity changed during preflight.');
    // All async preflight is followed by optimistic concurrency validation.
    if (cancelled())
      throw new MagicUiError(failure('CANCELLED', 'Cancelled before writes.'));
    active(input);
    verify(node, input.expectedNodeId, input.expectedSnapshot);
    if (node?.removed || parent?.removed)
      drift('Node or parent disappeared during preflight.');
    write(figma.root, 'documentId', input.documentId);
    if (!node) {
      node =
        spec.type === 'frame'
          ? figma.createFrame()
          : spec.type === 'text'
            ? figma.createText()
            : spec.type === 'rectangle'
              ? figma.createRectangle()
              : source!.createInstance();
      write(node, 'id', input.entry.id);
      write(node, 'projectId', input.projectId);
      write(node, 'screenId', input.screenId);
    }
    if (input.action === 'apply-spec') {
      if (!['FRAME', 'TEXT', 'RECTANGLE', 'INSTANCE'].includes(node.type))
        drift('Unsupported node type.');
      const target = parent as PageNode | FrameNode;
      // Only change hierarchy when intent requests it; do not reorder preserved
      // user siblings merely because the spec uses a different absolute index.
      const previous = read(node, 'intent');
      let old: { parentId?: string | null; index?: number } = {};
      try {
        old = JSON.parse(previous) as typeof old;
      } catch {
        /* New node. */
      }
      if (
        node.parent !== target ||
        old.parentId !== input.entry.parentId ||
        old.index !== input.entry.index
      )
        target.insertChild(
          Math.min(input.entry.index, target.children.length),
          node,
        );
      applyProperties(
        node as FrameNode | TextNode | RectangleNode | InstanceNode,
        resolved,
        input.direction,
        input.asset,
      );
      if (node.type === 'INSTANCE' && spec.type === 'component-instance')
        await applyInstance(node, spec, input.projectId, () => active(input));
      await applyTokenBindings(node, spec, input.tokens, variables, styles);

      active(input);
    }
    return commitBaseline(node, input);
  } finally {
    renderState.busy = false;
  }
}
export async function trashNode(
  input: Extract<Command, { command: 'trashNode' }>['input'],
  cancelled: () => boolean = () => false,
): Promise<SyncLive> {
  if (renderState.busy)
    throw new MagicUiError(
      failure('SESSION_BUSY', 'Another write is running.', true),
    );
  renderState.busy = true;
  try {
    if (cancelled())
      throw new MagicUiError(failure('CANCELLED', 'Cancelled before writes.'));
    active(input);
    const nodes = await ownedNodes(input);
    const node = nodes.find((n) => read(n, 'id') === input.localId);
    verify(node, input.expectedNodeId, input.expectedSnapshot);
    if (!node || !read(node, 'id')) drift('Only owned nodes can enter Trash.');
    const saved = read(node, 'trash');
    const metadata = saved
      ? trashMetadataSchema.parse(JSON.parse(saved))
      : null;
    if (input.restore) {
      if (!metadata) drift('No original parent recorded for this node.');
      const parent = await figma.getNodeByIdAsync(metadata.parentId);
      if (cancelled())
        throw new MagicUiError(
          failure('CANCELLED', 'Cancelled before writes.'),
        );
      active(input);
      verify(node, input.expectedNodeId, input.expectedSnapshot);
      if (
        !parent ||
        !['PAGE', 'FRAME', 'COMPONENT'].includes(parent.type) ||
        !('insertChild' in parent) ||
        isTrashed(parent)
      )
        drift('Original parent is unavailable. Restore the parent first.');
      (parent as PageNode | FrameNode | ComponentNode).insertChild(
        Math.min(metadata.index, parent.children.length),
        node,
      );
      node.x = metadata.x;
      node.y = metadata.y;
      write(node, 'trash', '');
    } else {
      if (metadata?.trashed) return live(node);
      // Moving a container also moves descendants: refuse even one user node.
      const check = (child: SceneNode) => {
        if (
          child !== node &&
          child.parent &&
          read(child.parent, 'assetResolution') &&
          read(child.parent, 'projectId') === input.projectId &&
          read(child.parent, 'screenId') === input.screenId &&
          ((read(child, 'assetChild') === 'missing' && child.type === 'TEXT') ||
            (read(child, 'assetChild') === 'icon' && child.type === 'INSTANCE'))
        )
          return;
        if (
          read(child, 'projectId') !== input.projectId ||
          read(child, 'screenId') !== input.screenId ||
          !read(child, 'id')
        )
          drift(
            'Container contains user content; it cannot be moved to Trash.',
          );
        if (child.type !== 'INSTANCE' && 'children' in child)
          child.children.forEach(check);
      };
      check(node);
      if (!node.parent || !('children' in node.parent))
        drift('Original parent is unavailable.');
      const original = {
        localId: input.localId,
        projectId: input.projectId,
        screenId: input.screenId,
        parentId: node.parent.id,
        index: node.parent.children.indexOf(node),
        x: node.x,
        y: node.y,
        reason: input.reason,
        trashed: true,
      };
      if (cancelled())
        throw new MagicUiError(
          failure('CANCELLED', 'Cancelled before writes.'),
        );
      active(input);
      let page = figma.root.children.find(
        (p) =>
          read(p, 'role') === 'trash' &&
          read(p, 'projectId') === input.projectId,
      );
      if (!page) {
        page = figma.createPage();
        page.name = 'Trash';
        write(page, 'role', 'trash');
        write(page, 'projectId', input.projectId);
      }
      write(node, 'trash', JSON.stringify(original));
      (pageWorkspace(page, input.projectId) ?? page).appendChild(node);
    }
    // Preserve the original sync baseline so restore or manual edits are visible.
    return live(node);
  } finally {
    renderState.busy = false;
  }
}
