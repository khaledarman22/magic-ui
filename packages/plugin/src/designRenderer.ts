import {
  assetChildrenSnapshot,
  boundAsset,
  preflightAsset,
  applyAsset,
  assetSource,
} from './assetManager';
import type { AssetResolution } from '@magic-ui/shared';
import { applyInstance, findVariant } from './designSystemRenderer';
import {
  applyTokenBindings,
  projectVariables,
  readIdentity,
  renderState,
} from './designSystemIdentity';
import { resolveTokenReferences, type Resolved } from '@magic-ui/shared';
import {
  MagicUiError,
  failure,
  renderDesignSchema,
  flattenScreen,
  planRender,
  canonicalJson,
  syncHash,
  type RenderDesignInput,
  type RenderDesignResult,
  type NodeSpecification,
} from '@magic-ui/shared';

type RenderNode =
  FrameNode | TextNode | RectangleNode | ComponentNode | InstanceNode;
const namespace = 'magic_ui';
const loadedFonts = new Set<string>();

const readData = (node: BaseNode, key: string) =>
  node.getSharedPluginData(namespace, key);
function writeData(node: BaseNode, key: string, value: string) {
  if (readData(node, key) !== value)
    node.setSharedPluginData(namespace, key, value);
}
// Figma stores many numeric fields as float32; harmless rounding must not trigger writes.
function equivalentProperty(actual: unknown, desired: unknown): boolean {
  if (typeof actual === 'number' && typeof desired === 'number')
    return (
      Math.abs(actual - desired) <=
      Math.max(1, Math.abs(actual), Math.abs(desired)) * 1e-6
    );
  if (actual === desired) return true;
  if (
    !actual ||
    !desired ||
    typeof actual !== 'object' ||
    typeof desired !== 'object'
  )
    return false;
  if (Array.isArray(actual) || Array.isArray(desired))
    return (
      Array.isArray(actual) &&
      Array.isArray(desired) &&
      actual.length === desired.length &&
      actual.every((value, index) => equivalentProperty(value, desired[index]))
    );
  const a = actual as Record<string, unknown>;
  const b = desired as Record<string, unknown>;
  return (
    Object.keys(a).length === Object.keys(b).length &&
    Object.keys(b).every(
      (key) => key in a && equivalentProperty(a[key], b[key]),
    )
  );
}
function setProperty<T, K extends keyof T>(node: T, key: K, value: T[K]) {
  if (!equivalentProperty(node[key], value)) node[key] = value;
}
export function snapshot(node: SceneNode): string {
  const properties: Record<string, unknown> = {};
  // Record live properties, including manually applied styles; do not trust an intent hash alone.
  const keys = [
    'name',
    'type',
    'visible',
    'locked',
    'opacity',
    'fills',
    'strokes',
    'strokeWeight',
    'strokeAlign',
    'dashPattern',
    'cornerRadius',
    'topLeftRadius',
    'topRightRadius',
    'bottomLeftRadius',
    'bottomRightRadius',
    'effects',
    'rotation',
    'blendMode',
    'layoutMode',
    'layoutWrap',
    'layoutSizingHorizontal',
    'layoutSizingVertical',
    'layoutPositioning',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'itemSpacing',
    'primaryAxisAlignItems',
    'counterAxisAlignItems',
    'clipsContent',
    'characters',
    'fontName',
    'fontSize',
    'lineHeight',
    'letterSpacing',
    'textAlignHorizontal',
    'textAutoResize',
    'textDecoration',
    'textCase',
    'textStyleId',
    'fillStyleId',
    'strokeStyleId',
    'effectStyleId',
    'boundVariables',
    'componentPropertyDefinitions',
    'componentPropertyReferences',
    'componentProperties',
  ];
  for (const key of keys)
    if (
      !(
        key === 'componentPropertyDefinitions' &&
        node.type === 'COMPONENT' &&
        node.parent?.type === 'COMPONENT_SET'
      ) &&
      key in node
    )
      properties[key] = (node as unknown as Record<string, unknown>)[key];
  // Figma can recalculate auto-layout geometry after this turn. Only owned coordinates/sizes are stable.
  let intent: {
    layout?: { width: unknown; height: unknown };
    parentId?: string | null;
  } = {};
  try {
    intent = JSON.parse(readData(node, 'intent')) as typeof intent;
  } catch {
    /* Missing baselines are detected before writing. */
  }
  if (typeof intent.layout?.width === 'number') properties.width = node.width;
  if (typeof intent.layout?.height === 'number')
    properties.height = node.height;
  if (
    !node.parent ||
    !('layoutMode' in node.parent) ||
    node.parent.layoutMode === 'NONE' ||
    ('layoutPositioning' in node && node.layoutPositioning === 'ABSOLUTE')
  ) {
    properties.x = node.x;
    properties.y = node.y;
  }
  properties.parentId = node.parent?.id ?? null;
  if ('children' in node)
    properties.children = node.children.map((child) => child.id);
  if (
    node.type === 'TEXT' &&
    node.textStyleId &&
    node.textStyleId !== figma.mixed
  )
    for (const field of ['fontName', 'fontSize', 'lineHeight', 'letterSpacing'])
      delete properties[field];
  if (node.type === 'INSTANCE') {
    const inherited = [
      'fills',
      'strokes',
      'strokeWeight',
      'cornerRadius',
      'topLeftRadius',
      'topRightRadius',
      'bottomLeftRadius',
      'bottomRightRadius',
      'effects',
      'opacity',
      'layoutMode',
      'layoutWrap',
      'paddingTop',
      'paddingRight',
      'paddingBottom',
      'paddingLeft',
      'itemSpacing',
      'primaryAxisAlignItems',
      'counterAxisAlignItems',
      'clipsContent',
      'fillStyleId',
      'strokeStyleId',
      'effectStyleId',
      'children',
    ];
    for (const field of inherited) delete properties[field];
    properties.instanceOverrides = (node.overrides ?? []).map((override) => {
      const target =
        override.id === node.id
          ? node
          : node.findOne((n) => n.id === override.id);
      return {
        id: override.id,
        fields: Object.fromEntries(
          override.overriddenFields.map((field) => [
            field,
            target
              ? (target as unknown as Record<string, unknown>)[field]
              : null,
          ]),
        ),
      };
    });
  }
  if ('boundVariables' in node) {
    if (
      node.boundVariables?.topLeftRadius ||
      node.boundVariables?.topRightRadius ||
      node.boundVariables?.bottomLeftRadius ||
      node.boundVariables?.bottomRightRadius
    )
      delete properties.cornerRadius;
    if (
      node.type === 'TEXT' &&
      (node.boundVariables?.fontFamily || node.boundVariables?.fontStyle)
    )
      delete properties.fontName;
    for (const [field, binding] of Object.entries(node.boundVariables ?? {}))
      if (binding && field !== 'fills' && field !== 'strokes')
        delete properties[field];
    for (const field of ['fills', 'strokes']) {
      const paints = properties[field];
      if (Array.isArray(paints))
        properties[field] = paints.map((p: Record<string, unknown>) => {
          const bound = p.boundVariables as Record<string, unknown> | undefined;
          return bound?.color ? { ...p, color: bound.color } : p;
        });
    }
  }
  const assetContents = assetChildrenSnapshot(node);
  if (assetContents) properties.assetContents = assetContents;
  return canonicalJson(properties);
}
function assertActive(pageId: string, isCancelled: () => boolean) {
  if (isCancelled())
    throw new MagicUiError(
      failure('CANCELLED', 'Render cancelled before writes.'),
    );
  if (figma.currentPage.id !== pageId)
    throw new MagicUiError(
      failure(
        'PAGE_CHANGED',
        'The target page is no longer active. Reconnect before rendering.',
      ),
    );
}
function paint(input: { color: string; opacity: number }): SolidPaint {
  return {
    type: 'SOLID',
    color: {
      r: parseInt(input.color.slice(1, 3), 16) / 255,
      g: parseInt(input.color.slice(3, 5), 16) / 255,
      b: parseInt(input.color.slice(5, 7), 16) / 255,
    },
    opacity: input.opacity,
  };
}
function setPaints(
  node: RenderNode,
  key: 'fills' | 'strokes',
  paints: SolidPaint[],
) {
  const current = node[key];
  const normalized = (values: readonly Paint[]) =>
    values.map((value) =>
      value.type === 'SOLID'
        ? {
            type: value.type,
            color: value.color,
            opacity: value.opacity ?? 1,
            visible: value.visible ?? true,
            blendMode: value.blendMode ?? 'NORMAL',
          }
        : value,
    );
  if (
    current === figma.mixed ||
    !equivalentProperty(normalized(current), normalized(paints))
  )
    node[key] = paints;
}
export function applyProperties(
  node: RenderNode,
  spec: Resolved<NodeSpecification>,
  direction: 'ltr' | 'rtl',
  asset?: AssetResolution,
) {
  const l = spec.layout;
  setProperty(node, 'name', spec.name);
  if (node.type === 'FRAME' || node.type === 'COMPONENT') {
    setProperty(
      node,
      'layoutMode',
      l.type === 'absolute'
        ? 'NONE'
        : l.direction === 'horizontal'
          ? 'HORIZONTAL'
          : 'VERTICAL',
    );
    if (l.type === 'auto-layout') {
      setProperty(node, 'layoutWrap', 'NO_WRAP');
      setProperty(node, 'paddingTop', l.padding.top);
      setProperty(node, 'paddingRight', l.padding.right);
      setProperty(node, 'paddingBottom', l.padding.bottom);
      setProperty(node, 'paddingLeft', l.padding.left);
      setProperty(node, 'itemSpacing', l.itemSpacing);
      const alignment = {
        start: 'MIN',
        center: 'CENTER',
        end: 'MAX',
        'space-between': 'SPACE_BETWEEN',
      } as const;
      const cross =
        direction === 'rtl' && l.direction === 'vertical'
          ? ({ start: 'MAX', center: 'CENTER', end: 'MIN' } as const)
          : alignment;
      setProperty(node, 'primaryAxisAlignItems', alignment[l.primaryAlignment]);
      setProperty(node, 'counterAxisAlignItems', cross[l.alignment]);
    }
  }
  if (node.type === 'TEXT' && spec.type === 'text') {
    // Changing fontName only requires the destination font, already loaded in preflight.
    setProperty(node, 'fontName', {
      family: spec.fontFamily,
      style: spec.fontStyle,
    });
    setProperty(node, 'characters', spec.content);
    setProperty(node, 'fontSize', spec.fontSize);
    setProperty(
      node,
      'lineHeight',
      spec.lineHeight === 'auto'
        ? { unit: 'AUTO' }
        : { unit: 'PIXELS', value: spec.lineHeight },
    );
    setProperty(node, 'letterSpacing', {
      unit: 'PIXELS',
      value: spec.letterSpacing,
    });
    const align =
      spec.textAlign === 'start'
        ? direction === 'rtl'
          ? 'RIGHT'
          : 'LEFT'
        : spec.textAlign === 'end'
          ? direction === 'rtl'
            ? 'LEFT'
            : 'RIGHT'
          : (
              {
                left: 'LEFT',
                right: 'RIGHT',
                center: 'CENTER',
                justified: 'JUSTIFIED',
              } as const
            )[spec.textAlign];
    setProperty(node, 'textAlignHorizontal', align);
    setProperty(
      node,
      'textAutoResize',
      l.width === 'hug'
        ? 'WIDTH_AND_HEIGHT'
        : l.height === 'hug'
          ? 'HEIGHT'
          : 'NONE',
    );
  }
  const width = typeof l.width === 'number' ? l.width : node.width;
  const height = typeof l.height === 'number' ? l.height : node.height;
  if (
    !equivalentProperty(node.width, width) ||
    !equivalentProperty(node.height, height)
  )
    node.resize(width, height);
  const autoParent =
    node.parent &&
    'layoutMode' in node.parent &&
    node.parent.layoutMode !== 'NONE';
  if (autoParent)
    setProperty(
      node,
      'layoutPositioning',
      l.positioning === 'absolute' ? 'ABSOLUTE' : 'AUTO',
    );
  if (
    autoParent ||
    (['FRAME', 'COMPONENT', 'INSTANCE'].includes(node.type) &&
      l.type === 'auto-layout') ||
    node.type === 'TEXT'
  ) {
    setProperty(
      node,
      'layoutSizingHorizontal',
      typeof l.width === 'number'
        ? 'FIXED'
        : l.width === 'hug'
          ? 'HUG'
          : 'FILL',
    );
    setProperty(
      node,
      'layoutSizingVertical',
      typeof l.height === 'number'
        ? 'FIXED'
        : l.height === 'hug'
          ? 'HUG'
          : 'FILL',
    );
  }
  if (!autoParent || l.positioning === 'absolute') {
    setProperty(node, 'x', l.x);
    setProperty(node, 'y', l.y);
  }
  if (node.type === 'INSTANCE') return;
  setPaints(node, 'fills', spec.styling.fills.map(paint));
  setPaints(node, 'strokes', spec.styling.strokes.map(paint));
  setProperty(node, 'strokeWeight', spec.styling.strokeWeight);
  if (node.type !== 'TEXT')
    setProperty(node, 'cornerRadius', spec.styling.cornerRadius);
  setProperty(node, 'opacity', spec.styling.opacity);
  if (
    readData(node, 'assetResolution') &&
    !(spec.type === 'frame' && spec.assetId) &&
    'children' in node
  ) {
    for (const child of node.children)
      if (readData(child, 'assetChild')) child.visible = false;
    writeData(node, 'assetResolution', '');
  }
  if (
    spec.type === 'frame' &&
    spec.assetId &&
    (node.type === 'FRAME' || node.type === 'COMPONENT')
  ) {
    const resolution =
      asset ?? boundAsset(readData(node, 'projectId'), spec.assetId);
    applyAsset(node, resolution, assetSource(resolution.hash));
  }
}
export async function renderDesign(
  raw: RenderDesignInput,
  isCancelled: () => boolean,
): Promise<RenderDesignResult> {
  if (renderState.busy)
    throw new MagicUiError(
      failure(
        'SESSION_BUSY',
        'Another render is in progress. Retry when it completes.',
        true,
      ),
    );
  renderState.busy = true;
  try {
    const input = renderDesignSchema.parse(raw);
    if (input.specification.projectId !== input.projectId)
      throw new MagicUiError(failure('INVALID_INPUT', 'Project IDs differ.'));
    const screen = input.specification.pages
      .flatMap((page) => page.screens)
      .find((screen) => screen.id === input.screenId);
    if (!screen)
      throw new MagicUiError(
        failure('INVALID_INPUT', 'Screen ID was not found in this project.'),
      );
    assertActive(input.pageId, isCancelled);
    const rootKey = `screen:${input.projectId}:${input.screenId}`;
    const boundRootId = readData(figma.currentPage, rootKey);
    if (boundRootId) {
      const boundRoot = await figma.getNodeByIdAsync(boundRootId);
      assertActive(input.pageId, isCancelled);
      if (
        !boundRoot ||
        boundRoot.parent?.id !== input.pageId ||
        readData(boundRoot, 'id') !== screen.id ||
        readData(boundRoot, 'projectId') !== input.projectId ||
        readData(boundRoot, 'screenId') !== input.screenId
      )
        throw new MagicUiError(
          failure(
            'DRIFT_DETECTED',
            'The previously rendered screen was moved, removed or its identity changed. No new screen was created.',
          ),
        );
    }
    const entries = flattenScreen(screen, input.specification.tokens);
    for (const { specification: node } of entries) {
      for (const mode of input.specification.tokens.modes)
        await loadSpecificationFonts(
          resolveTokenReferences(node, input.specification.tokens, mode),
          input.projectId,
        );
      if (node.type === 'component-instance')
        await findVariant(input.projectId, node.componentId, node.variant);
      assertActive(input.pageId, isCancelled);
    }
    const variables = await projectVariables(input.projectId);
    const styles = (await figma.getLocalTextStylesAsync()).filter(
      (s) => readIdentity(s, 'projectId') === input.projectId,
    );
    const referencedIds = new Set<string>();
    const collectReferences = (value: unknown) => {
      if (value && typeof value === 'object') {
        if ('token' in value) referencedIds.add(String(value.token));
        else Object.values(value).forEach(collectReferences);
      }
    };
    collectReferences(screen);
    for (const id of referencedIds)
      if (!variables.some((v) => readIdentity(v, 'id') === id))
        throw new MagicUiError(
          failure('INVALID_INPUT', `Render design system first: ${id}`),
        );
    for (const { specification: node } of entries)
      if (
        node.type === 'text' &&
        node.typography &&
        !styles.some((s) => readIdentity(s, 'id') === node.typography)
      )
        throw new MagicUiError(
          failure('INVALID_INPUT', 'Render typography styles first.'),
        );
    for (const style of styles)
      try {
        await figma.loadFontAsync(style.fontName);
      } catch {
        throw new MagicUiError(
          failure(
            'FONT_UNAVAILABLE',
            `Font unavailable for style ${style.name}`,
          ),
        );
      }
    assertActive(input.pageId, isCancelled);
    // Only top-level screen roots are looked up; descendants are searched within that screen alone.
    const owns = (node: BaseNode) =>
      readData(node, 'projectId') === input.projectId &&
      readData(node, 'screenId') === input.screenId;
    const roots = figma.currentPage.children.filter(
      (node) => owns(node) && readData(node, 'id') === screen.id,
    );
    if (roots.length > 1)
      throw new MagicUiError(
        failure(
          'DRIFT_DETECTED',
          'Duplicate screen identities found. Resolve them before rendering.',
        ),
      );
    const root = roots[0];
    if (root && root.type !== 'FRAME')
      throw new MagicUiError(
        failure(
          'DRIFT_DETECTED',
          'Screen identity belongs to a non-frame node.',
        ),
      );
    const existing: SceneNode[] =
      root && root.type === 'FRAME'
        ? [root, ...ownedDescendants(root, owns)]
        : [];
    const byId = new Map<string, RenderNode>();
    const drift: { id: string; nodeId: string; reason: string }[] = [];
    for (const node of existing) {
      const id = readData(node, 'id');
      if (
        byId.has(id) ||
        !['FRAME', 'TEXT', 'RECTANGLE', 'INSTANCE'].includes(node.type)
      )
        drift.push({
          id,
          nodeId: node.id,
          reason: 'Duplicate or incompatible identity.',
        });
      else byId.set(id, node as RenderNode);
      const saved = readData(node, 'snapshot');
      if (!saved || saved !== snapshot(node))
        drift.push({
          id,
          nodeId: node.id,
          reason: 'Live Figma properties differ from the last render.',
        });
    }
    for (const entry of entries) {
      const node = byId.get(entry.id);
      if (
        node &&
        node.type !==
          (entry.specification.type === 'component-instance'
            ? 'INSTANCE'
            : entry.specification.type.toUpperCase())
      )
        drift.push({
          id: entry.id,
          nodeId: node.id,
          reason: 'Changing node type requires an explicit future migration.',
        });
    }
    if (drift.length)
      throw new MagicUiError({
        ...failure(
          'DRIFT_DETECTED',
          'Manual Figma changes detected. No nodes were changed; review drift before retrying.',
        ),
        details: { drift },
      });
    const plan = planRender(
      screen,
      existing.map((node) => ({
        id: readData(node, 'id'),
        nodeId: node.id,
        intent: readData(node, 'intent'),
      })),
      input.specification.tokens,
    );
    for (const operation of plan.operations)
      if (
        operation.specification.type === 'frame' &&
        operation.specification.assetId
      ) {
        operation.intent = canonicalJson({
          ...(JSON.parse(operation.intent) as Record<string, unknown>),
          assetResolution: boundAsset(
            input.projectId,
            operation.specification.assetId,
          ),
        });
        const existing = byId.get(operation.id);
        operation.action = !existing
          ? 'create'
          : readData(existing, 'intent') === operation.intent
            ? 'unchanged'
            : 'update';
      }
    const missingAssets = entries.flatMap((e) =>
      e.specification.type === 'frame' &&
      e.specification.assetId &&
      !boundAsset(input.projectId, e.specification.assetId).hash
        ? [
            {
              localId: e.id,
              assetId: e.specification.assetId,
              status: 'missing' as const,
            },
          ]
        : [],
    );
    const result: RenderDesignResult = {
      missingAssets,
      assetsComplete: missingAssets.length === 0,
      nodeCount: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      orphaned: plan.orphanedNodes.length,
      orphanedNodes: plan.orphanedNodes,
      mapping: [],
    };
    assertActive(input.pageId, isCancelled);
    // Bounded to 500 nodes with no async gap after this last preflight check.
    for (const operation of plan.operations) {
      assertActive(input.pageId, isCancelled);
      let node = byId.get(operation.id);
      if (!node) {
        const source =
          operation.specification.type === 'component-instance'
            ? await findVariant(
                input.projectId,
                operation.specification.componentId,
                operation.specification.variant,
              )
            : undefined;
        assertActive(input.pageId, isCancelled);
        node =
          operation.specification.type === 'frame'
            ? figma.createFrame()
            : operation.specification.type === 'text'
              ? figma.createText()
              : operation.specification.type === 'rectangle'
                ? figma.createRectangle()
                : source!.createInstance();
        // Persist identity immediately, even if a later Figma write fails.
        writeData(node, 'id', operation.id);
        writeData(node, 'projectId', input.projectId);
        writeData(node, 'screenId', input.screenId);
        byId.set(operation.id, node);
      }
      if (operation.action !== 'unchanged') {
        const parent = operation.parentId
          ? byId.get(operation.parentId)
          : figma.currentPage;
        if (!parent || !('insertChild' in parent))
          throw new MagicUiError(
            failure('INTERNAL_ERROR', 'Render parent is not a container.'),
          );
        if (
          operation.parentId &&
          (node.parent?.id !== parent.id ||
            parent.children.indexOf(node) !== operation.index)
        )
          parent.insertChild(operation.index, node);
        applyProperties(
          node,
          resolveTokenReferences(
            operation.specification,
            input.specification.tokens,
          ),
          screen.direction,
        );
        if (
          node.type === 'INSTANCE' &&
          operation.specification.type === 'component-instance'
        )
          await applyInstance(
            node,
            operation.specification,
            input.projectId,
            () => assertActive(input.pageId, isCancelled),
          );
        assertActive(input.pageId, isCancelled);
        if (variables.length || styles.length)
          await applyTokenBindings(
            node,
            operation.specification,
            input.specification.tokens,
            variables,
            styles,
          );
        writeData(node, 'intent', operation.intent);
        writeData(node, 'hash', syncHash(operation.intent));
        writeData(node, 'specVersion', input.specification.schemaVersion);
      }
      if (operation.action === 'create') result.created++;
      else if (operation.action === 'update') result.updated++;
      else result.unchanged++;
      result.mapping.push({ id: operation.id, nodeId: node.id });
    }
    // Capture after all moves/layout updates so parent baselines include their final children.
    for (const node of byId.values())
      writeData(node, 'snapshot', snapshot(node));
    const renderedRoot = byId.get(screen.id);
    if (renderedRoot) writeData(figma.currentPage, rootKey, renderedRoot.id);
    result.nodeCount =
      renderedRoot?.type === 'FRAME'
        ? 1 + renderedRoot.findAll(() => true).length
        : 0;
    return result;
  } finally {
    renderState.busy = false;
  }
}

export async function loadSpecificationFonts(
  node: Resolved<NodeSpecification>,
  projectId?: string,
) {
  if (projectId && node.type === 'frame' && node.assetId)
    await preflightAsset(boundAsset(projectId, node.assetId));
  if (node.type === 'text') {
    const key = canonicalJson([node.fontFamily, node.fontStyle]);
    if (!loadedFonts.has(key)) {
      try {
        await figma.loadFontAsync({
          family: node.fontFamily,
          style: node.fontStyle,
        });
      } catch {
        throw new MagicUiError(
          failure(
            'FONT_UNAVAILABLE',
            `Font unavailable: ${node.fontFamily} / ${node.fontStyle}. Install or select an available font explicitly.`,
          ),
        );
      }
      loadedFonts.add(key);
    }
  }
  if ('nodes' in node)
    for (const child of node.nodes)
      await loadSpecificationFonts(child, projectId);
}
export function ownedDescendants(
  root: FrameNode | ComponentSetNode,
  owns: (node: BaseNode) => boolean,
): SceneNode[] {
  const result: SceneNode[] = [];
  const visit = (node: SceneNode) => {
    if (owns(node)) result.push(node);
    if (node.type !== 'INSTANCE' && 'children' in node)
      node.children.forEach(visit);
  };
  root.children.forEach(visit);
  return result;
}
