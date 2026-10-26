import type {
  DesignSystemRecovery,
  SystemRecoveryResource,
} from './designSystemRecovery';
import {
  canonicalJson,
  componentRegistrySchema,
  componentDependencies,
  orderComponents,
  resolveToken,
  resolveTokenReferences,
  failure,
  MagicUiError,
  designSystemInputSchema,
  type DesignSystemInput,
  type DesignSystemResult,
  type ComponentRegistry,
  type NodeSpecification,
} from '@magic-ui/shared';
import {
  applyProperties,
  snapshot,
  loadSpecificationFonts,
  ownedDescendants,
} from './designRenderer';
import {
  readIdentity as read,
  writeIdentity as write,
  drift,
  projectVariables,
  applyTokenBindings,
  renderState,
} from './designSystemIdentity';
const key = (projectId: string) => `design-system:${projectId}`;
export function readComponents(projectId: string): ComponentRegistry {
  const saved = read(figma.root, key(projectId));
  return saved
    ? componentRegistrySchema.parse(JSON.parse(saved))
    : { projectId, components: [] };
}
export async function readVariables(projectId: string) {
  const variables = await projectVariables(projectId);
  const collections = (
    await figma.variables.getLocalVariableCollectionsAsync()
  ).filter((c) => read(c, 'projectId') === projectId);
  return {
    variables: variables.map((v) => ({
      id: read(v, 'id'),
      variableId: v.id,
      type: v.resolvedType,
      values: v.valuesByMode,
    })),
    collections: collections.map((c) => ({
      id: c.id,
      name: c.name,
      modes: [...c.modes],
    })),
  };
}
export async function findVariant(
  projectId: string,
  componentId: string,
  variantId?: string,
): Promise<ComponentNode> {
  const c = readComponents(projectId).components.find(
    (c) => c.id === componentId,
  );
  const variant = variantId
    ? c?.variants.find((v) => v.id === variantId)
    : c?.variants[0];
  const node = variant ? await figma.getNodeByIdAsync(variant.nodeId) : null;
  if (
    !node ||
    node.type !== 'COMPONENT' ||
    read(node, 'id') !== variant?.id ||
    read(node, 'projectId') !== projectId
  )
    throw new MagicUiError(
      failure(
        'INVALID_INPUT',
        `Render component first: ${componentId}/${variantId ?? ''}`,
      ),
    );
  return node;
}
export async function applyInstance(
  node: InstanceNode,
  spec: Extract<NodeSpecification, { type: 'component-instance' }>,
  projectId: string,
  active: () => void = () => {},
) {
  const registry = readComponents(projectId);
  const c = registry.components.find((c) => c.id === spec.componentId);
  if (!c)
    throw new MagicUiError(
      failure('INVALID_INPUT', 'Component is not rendered.'),
    );
  const initial = c.variants.find((v) => v.id === spec.variant)!;
  const values = {
    ...initial.values,
    ...Object.fromEntries(
      Object.entries(spec.overrides).filter(([id]) =>
        c.properties.some((p) => p.id === id && p.type === 'VARIANT'),
      ),
    ),
  };
  const selected = c.variants.find((v) =>
    Object.entries(values).every(([k, val]) => v.values[k] === val),
  );
  if (!selected)
    throw new MagicUiError(
      failure('INVALID_INPUT', 'Variant combination is not declared.'),
    );
  const main = await findVariant(projectId, c.id, selected.id);
  const previousMain = await node.getMainComponentAsync();
  const properties: Record<string, string | boolean> = {};
  for (const p of c.properties) {
    if (p.type === 'VARIANT') continue;
    const value = spec.overrides[p.id] ?? p.defaultValue;
    const propertyKey = c.propertyKeys[p.id];
    if (!propertyKey)
      throw new MagicUiError(
        failure('INVALID_INPUT', `Missing component property ${p.id}`),
      );
    properties[propertyKey] =
      p.type === 'INSTANCE_SWAP'
        ? (await findVariant(projectId, String(value))).id
        : value;
  }
  active();
  if (previousMain?.id !== main.id) node.swapComponent(main);
  if (
    Object.entries(properties).some(
      ([k, v]) => node.componentProperties[k]?.value !== v,
    )
  )
    node.setProperties(properties);
}

export async function renderDesignSystem(
  raw: DesignSystemInput,
  cancelled: () => boolean,
  recovery?: DesignSystemRecovery,
): Promise<DesignSystemResult> {
  if (renderState.busy && !recovery)
    throw new MagicUiError(
      failure('SESSION_BUSY', 'Design system render in progress.'),
    );
  renderState.busy = true;
  try {
    const input = designSystemInputSchema.parse(raw),
      spec = input.specification;
    if (spec.projectId !== input.projectId)
      throw new MagicUiError(failure('INVALID_INPUT', 'Project IDs differ.'));
    const active = () => {
      if (cancelled())
        throw new MagicUiError(failure('CANCELLED', 'Render cancelled.'));
      if (figma.currentPage.id !== input.pageId)
        throw new MagicUiError(failure('PAGE_CHANGED', 'Target page changed.'));
    };
    active();
    const touch = (...items: (SystemRecoveryResource | undefined | null)[]) =>
      items.forEach((item) => {
        if (item) recovery?.touch(item);
      });
    const checkpoint = async (
      id: string,
      action: () => void | Promise<void>,
    ) => {
      active();
      if (recovery) await recovery.step(id, action);
      else await action();
    };
    const pendingKey = `design-system-pending:${input.projectId}`;
    if (read(figma.root, pendingKey) && !recovery)
      drift(
        'A previous design system write did not finish. Inspect the document and resolve the partial render before retrying; no duplicate system was created.',
      );
    const previous = readComponents(input.projectId);
    const variables = await projectVariables(input.projectId);
    const collections = (
      await figma.variables.getLocalVariableCollectionsAsync()
    ).filter((c) => read(c, 'projectId') === input.projectId);
    const styles = (await figma.getLocalTextStylesAsync()).filter(
      (s) => read(s, 'projectId') === input.projectId,
    );
    const unique = (
      items: { getSharedPluginData(ns: string, key: string): string }[],
    ) => {
      const ids = items.map((v) => read(v, 'id'));
      if (new Set(ids).size !== ids.length)
        drift('Duplicate design system identity.');
    };
    unique(variables);
    unique(styles);
    if (collections.length > 1) drift('Duplicate token collection.');
    const variableSnapshot = (v: Variable) =>
      canonicalJson({
        name: v.name,
        type: v.resolvedType,
        values: v.valuesByMode,
        collection: v.variableCollectionId,
      });
    const styleSnapshot = (s: TextStyle) =>
      canonicalJson({
        name: s.name,
        fontName: s.fontName,
        fontSize: s.fontSize,
        lineHeight: s.lineHeight,
        letterSpacing: s.letterSpacing,
      });
    for (const v of variables)
      if (
        (!recovery || recovery.fresh) &&
        read(v, 'snapshot') !== variableSnapshot(v)
      )
        drift(`Variable changed manually: ${read(v, 'id')}`);
    for (const s of styles)
      if (
        (!recovery || recovery.fresh) &&
        read(s, 'snapshot') !== styleSnapshot(s)
      )
        drift(`Text style changed manually: ${read(s, 'id')}`);
    let collection = collections[0];
    if (
      collection &&
      (!recovery || recovery.fresh) &&
      read(collection, 'snapshot') !==
        canonicalJson({ name: collection.name, modes: collection.modes })
    )
      drift('Token collection changed manually.');
    const manifestKey = `design-system-manifest:${input.projectId}`;
    const manifest = read(figma.root, manifestKey);
    if (manifest && (!recovery || recovery.fresh)) {
      const saved = JSON.parse(manifest) as {
        collectionId: string | null;
        variableIds: string[];
        styleIds: string[];
        pageId: string | null;
      };
      if (saved.collectionId && collections[0]?.id !== saved.collectionId)
        drift('Previously rendered token collection was removed.');
      if (
        saved.variableIds.some((id) => !variables.some((v) => v.id === id)) ||
        saved.styleIds.some((id) => !styles.some((s) => s.id === id))
      )
        drift('Previously rendered token or text style was removed.');
      if (
        saved.pageId &&
        !figma.root.children.some(
          (p) =>
            p.id === saved.pageId &&
            read(p, 'designSystemProject') === input.projectId,
        )
      )
        drift('Previously rendered Components page was removed.');
    }
    const existingNodes = new Map<string, SceneNode>();
    for (const c of previous.components) {
      const set = await figma.getNodeByIdAsync(c.nodeId);
      if (!set || set.type !== 'COMPONENT_SET' || read(set, 'id') !== c.id)
        drift(`Component set moved or missing: ${c.id}`);
      for (const n of [
        set,
        ...ownedDescendants(
          set,
          (n) => read(n, 'projectId') === input.projectId,
        ),
      ]) {
        if (
          (!recovery || recovery.fresh) &&
          read(n, 'snapshot') !== snapshot(n)
        )
          drift(`Component changed manually: ${read(n, 'id')}`);
        const identity =
          n.id === set.id ? `set:${c.id}` : `${c.id}:${read(n, 'id')}`;
        if (existingNodes.has(identity))
          drift('Duplicate component node identity.');
        existingNodes.set(identity, n);
      }
    }
    if (recovery) {
      for (const page of figma.root.children) {
        await page.loadAsync();
        const visit = (node: SceneNode) => {
          if (
            read(node, 'projectId') === input.projectId &&
            read(node, 'componentId')
          ) {
            const identity =
              node.type === 'COMPONENT_SET'
                ? `set:${read(node, 'componentId')}`
                : `${read(node, 'componentId')}:${read(node, 'id')}`;
            const existing = existingNodes.get(identity);
            if (existing && existing.id !== node.id)
              drift('Duplicate component identity during recovery.');
            existingNodes.set(identity, node);
          }
          if (node.type !== 'INSTANCE' && 'children' in node)
            node.children.forEach(visit);
        };
        page.children.forEach(visit);
      }
    }
    const dependents = async (
      source: SceneNode | undefined,
    ): Promise<InstanceNode[]> => {
      if (
        !recovery ||
        !source ||
        !['COMPONENT', 'COMPONENT_SET'].includes(source.type)
      )
        return [];
      const result: InstanceNode[] = [];
      for (const candidate of existingNodes.values()) {
        if (candidate.type !== 'INSTANCE') continue;
        const main = await candidate.getMainComponentAsync();
        if (main?.id === source.id || main?.parent?.id === source.id)
          result.push(candidate);
      }
      return result;
    };
    for (const token of spec.tokens.values) {
      const existing = variables.find((v) => read(v, 'id') === token.id);
      const expected =
        token.type === 'color'
          ? 'COLOR'
          : token.type === 'number'
            ? 'FLOAT'
            : 'STRING';
      if (existing && existing.resolvedType !== expected)
        drift('Changing token type requires migration.');
    }
    for (const component of spec.components) {
      const set = existingNodes.get(`set:${component.id}`);
      if (set && set.type === 'COMPONENT_SET')
        for (const property of component.properties) {
          const propertyKey = read(set, `property:${property.id}`);
          if (
            propertyKey &&
            set.componentPropertyDefinitions[propertyKey]?.type !==
              property.type
          )
            drift('Changing property type requires migration.');
        }
      for (const variant of component.variants) {
        const check = (node: NodeSpecification, isRoot = false) => {
          const existing = existingNodes.get(
            `${component.id}:${isRoot ? variant.id : `${variant.id}/${node.id}`}`,
          );
          const expected = isRoot
            ? 'COMPONENT'
            : node.type === 'component-instance'
              ? 'INSTANCE'
              : node.type.toUpperCase();
          if (existing && existing.type !== expected)
            drift('Changing component node type requires migration.');
          if ('nodes' in node) node.nodes.forEach((n) => check(n));
        };
        check(variant.root, true);
      }
    }
    for (const mode of spec.tokens.modes)
      for (const c of spec.components)
        for (const v of c.variants)
          await loadSpecificationFonts(
            resolveTokenReferences(v.root, spec.tokens, mode),
            input.projectId,
          );
    for (const s of spec.tokens.typography) {
      try {
        await figma.loadFontAsync({ family: s.fontFamily, style: s.fontStyle });
      } catch {
        throw new MagicUiError(
          failure(
            'FONT_UNAVAILABLE',
            `Font unavailable: ${s.fontFamily}/${s.fontStyle}`,
          ),
        );
      }
    }
    active();
    if (!recovery)
      write(figma.root, pendingKey, 'Writing tokens and components');
    if (spec.tokens.values.length) {
      await checkpoint('collection', () => {
        touch(collection);
        if (!collection) {
          collection = figma.variables.createVariableCollection('Magic UI');
          touch(collection);
          write(collection, 'id', 'tokens');
          write(collection, 'projectId', input.projectId);
          collection.renameMode(
            collection.defaultModeId,
            spec.tokens.modes[0]!,
          );
        }
      });
      if (!collection) drift('Missing token collection.');
      const modes = new Map(collection.modes.map((m) => [m.name, m.modeId]));
      for (const mode of spec.tokens.modes) {
        await checkpoint(`mode:${mode}`, () => {
          if (modes.has(mode)) return;
          touch(collection);
          try {
            modes.set(mode, collection!.addMode(mode));
          } catch (error) {
            if (/Limited to \d+ modes only/.test(String(error)))
              throw new MagicUiError(
                failure(
                  'FIGMA_MODE_LIMIT',
                  'This Figma file does not permit the requested modes. Resume this operation after capacity is available.',
                ),
              );
            throw error;
          }
        });
      }
      const byId = new Map(variables.map((v) => [read(v, 'id'), v]));
      for (const t of spec.tokens.values) {
        const type =
          t.type === 'color'
            ? 'COLOR'
            : t.type === 'number'
              ? 'FLOAT'
              : 'STRING';
        let v = byId.get(t.id);
        if (v && v.resolvedType !== type)
          drift('Changing token type requires migration.');
        await checkpoint(`allocate:${t.id}`, () => {
          if (!v) {
            v = figma.variables.createVariable(
              t.id.replace(/\./g, '/'),
              collection!,
              type,
            );
            touch(v);
            write(v, 'id', t.id);
            write(v, 'projectId', input.projectId);
            variables.push(v);
            byId.set(t.id, v);
          }
        });
      }
      for (const t of spec.tokens.values) {
        const v = byId.get(t.id)!;
        for (const mode of spec.tokens.modes) {
          const raw = t.values[mode]!;
          const resolved = resolveToken(spec.tokens, t.id, mode);
          const value: VariableValue =
            typeof raw === 'object'
              ? figma.variables.createVariableAlias(byId.get(raw.token)!)
              : t.type === 'color'
                ? {
                    r: parseInt(String(resolved).slice(1, 3), 16) / 255,
                    g: parseInt(String(resolved).slice(3, 5), 16) / 255,
                    b: parseInt(String(resolved).slice(5, 7), 16) / 255,
                  }
                : resolved;
          const modeId = modes.get(mode)!;
          await checkpoint(`value:${t.id}:${mode}`, () => {
            touch(v);
            if (canonicalJson(v.valuesByMode[modeId]) !== canonicalJson(value))
              v.setValueForMode(modeId, value);
            write(v, 'snapshot', variableSnapshot(v));
          });
        }
        if (!recovery) write(v, 'snapshot', variableSnapshot(v));
      }
      if (!recovery)
        write(
          collection,
          'snapshot',
          canonicalJson({ name: collection.name, modes: collection.modes }),
        );
    }
    for (const token of spec.tokens.typography) {
      let style = styles.find((s) => read(s, 'id') === token.id);
      await checkpoint(`style:${token.id}`, () => {
        touch(style);
        if (!style) {
          style = figma.createTextStyle();
          touch(style);
          write(style, 'id', token.id);
          write(style, 'projectId', input.projectId);
          styles.push(style);
        }
        style.name = token.name;
        style.fontName = { family: token.fontFamily, style: token.fontStyle };
        style.fontSize = token.fontSize;
        style.lineHeight =
          token.lineHeight === 'auto'
            ? { unit: 'AUTO' }
            : { unit: 'PIXELS', value: token.lineHeight };
        style.letterSpacing = { unit: 'PIXELS', value: token.letterSpacing };
        write(style, 'snapshot', styleSnapshot(style));
      });
    }
    let page = figma.root.children.find(
      (p) => read(p, 'designSystemProject') === input.projectId,
    );
    if (spec.components.length)
      await checkpoint('page', () => {
        if (!page) {
          page = figma.createPage();
          touch(page);
          page.name = 'Components';
          write(page, 'designSystemProject', input.projectId);
        }
      });
    if (page) await page.loadAsync();
    active();
    let workspace = page?.children.find((n) => read(n, 'id') === 'workspace');
    if (spec.components.length)
      await checkpoint('workspace', () => {
        if (page && !workspace) {
          touch(page);
          workspace = figma.createFrame();
          touch(workspace);
          workspace.name = 'Workspace';
          workspace.layoutMode = 'VERTICAL';
          workspace.itemSpacing = 48;
          workspace.layoutSizingHorizontal = 'HUG';
          workspace.layoutSizingVertical = 'HUG';
          page.appendChild(workspace);
          write(workspace, 'id', 'workspace');
          write(workspace, 'projectId', input.projectId);
        }
      });
    const registry: ComponentRegistry = {
      projectId: input.projectId,
      components: [...previous.components],
    };
    for (const c of orderComponents(spec.components)) {
      active();
      if (!workspace || workspace.type !== 'FRAME')
        drift('Missing component workspace.');
      const componentWorkspace = workspace;
      let section = workspace.children.find(
        (n) => read(n, 'id') === `category:${c.category}`,
      );
      await checkpoint(`category:${c.category}`, () => {
        if (!section) {
          touch(componentWorkspace);
          section = figma.createFrame();
          touch(section);
          section.name = c.category;
          section.layoutMode = 'VERTICAL';
          section.itemSpacing = 24;
          section.layoutSizingHorizontal = 'HUG';
          section.layoutSizingVertical = 'HUG';
          componentWorkspace.appendChild(section);
          write(section, 'id', `category:${c.category}`);
          write(section, 'projectId', input.projectId);
        }
      });
      if (!section) drift('Missing component category.');
      if (section.type !== 'FRAME') drift('Category identity is not a frame.');
      const categoryFrame = section;
      let set = existingNodes.get(`set:${c.id}`) as
        ComponentSetNode | undefined;
      const variantRecords: ComponentRegistry['components'][number]['variants'] =
        [];
      for (const v of c.variants) {
        const variantName =
          Object.entries(v.values)
            .map(
              ([id, val]) =>
                `${c.properties.find((p) => p.id === id)!.name}=${val}`,
            )
            .join(', ') || `Variant=${v.name}`;
        const prefix = `${v.id}/`;
        const tree = async (
          rawNode: NodeSpecification,
          parent: ChildrenMixin & BaseNode,
          index: number,
          isRoot = false,
        ): Promise<SceneNode> => {
          active();
          const id = isRoot ? v.id : prefix + rawNode.id;
          let node = existingNodes.get(`${c.id}:${id}`);
          const expected = isRoot
            ? 'COMPONENT'
            : rawNode.type === 'component-instance'
              ? 'INSTANCE'
              : rawNode.type.toUpperCase();
          if (node && node.type !== expected)
            drift('Changing component node type requires migration.');
          const source =
            rawNode.type === 'component-instance'
              ? await findVariant(
                  input.projectId,
                  rawNode.componentId,
                  rawNode.variant,
                )
              : undefined;
          await checkpoint(`node:${c.id}:${id}`, async () => {
            const inherited = await dependents(node);
            touch(node, parent, node?.parent, ...inherited);
            if (!node) {
              active();
              node = isRoot
                ? figma.createComponent()
                : rawNode.type === 'frame'
                  ? figma.createFrame()
                  : rawNode.type === 'text'
                    ? figma.createText()
                    : rawNode.type === 'rectangle'
                      ? figma.createRectangle()
                      : source!.createInstance();
              touch(node);
              write(node, 'id', id);
              write(node, 'projectId', input.projectId);
              write(node, 'componentId', c.id);
              existingNodes.set(`${c.id}:${id}`, node);
            }
            if (
              node.parent?.id !== parent.id ||
              parent.children.indexOf(node) !== index
            )
              parent.insertChild(index, node);
            write(node, 'intent', canonicalJson(rawNode));
            const resolved = resolveTokenReferences(rawNode, spec.tokens);
            applyProperties(
              node as
                | FrameNode
                | ComponentNode
                | InstanceNode
                | TextNode
                | RectangleNode,
              resolved,
              'ltr',
            );
            if (isRoot) node.name = variantName;
          });
          if (!node) drift('Missing component node after checkpoint.');
          const boundNode = node;
          await checkpoint(`bindings:${c.id}:${id}`, async () => {
            touch(boundNode);
            if (
              rawNode.type === 'component-instance' &&
              boundNode.type === 'INSTANCE'
            )
              await applyInstance(boundNode, rawNode, input.projectId, active);
            active();
            await applyTokenBindings(
              boundNode,
              rawNode,
              spec.tokens,
              variables,
              styles,
            );
          });
          if ('nodes' in rawNode && 'insertChild' in node)
            for (const [i, child] of rawNode.nodes.entries())
              await tree(child, node, i);
          return node;
        };
        const root = (await tree(
          v.root,
          set ?? section,
          (set ?? section).children.length,
          true,
        )) as ComponentNode;
        await checkpoint(`variant:${c.id}:${v.id}`, () => {
          touch(root, set, categoryFrame, root.parent);
          root.name = variantName;
          if (!set) {
            set = figma.combineAsVariants([root], categoryFrame);
            touch(set);
            write(set, 'id', c.id);
            write(set, 'projectId', input.projectId);
            write(set, 'componentId', c.id);
            set.name = c.name;
            set.layoutMode = 'HORIZONTAL';
            set.itemSpacing = 24;
            set.layoutSizingHorizontal = 'HUG';
            set.layoutSizingVertical = 'HUG';
          } else if (root.parent?.id !== set.id) set.appendChild(root);
        });
        variantRecords.push({
          id: v.id,
          name: v.name,
          nodeId: root.id,
          values: v.values,
        });
      }
      if (!set) throw new Error('Missing component set');
      await checkpoint(`set:${c.id}`, () => {
        touch(set, set?.parent, categoryFrame);
        if (set!.name !== c.name) set!.name = c.name;
        if (set!.parent?.id !== categoryFrame.id)
          categoryFrame.appendChild(set!);
      });
      const propertyKeys: Record<string, string> = {};
      for (const property of c.properties) {
        if (property.type === 'VARIANT') continue;
        let propertyKey = read(set!, `property:${property.id}`);
        const defaultValue =
          property.type === 'INSTANCE_SWAP'
            ? (
                await findVariant(
                  input.projectId,
                  String(property.defaultValue),
                )
              ).id
            : property.defaultValue;
        const targets = c.variants.map((variant) => {
          const root = set!.children.find(
            (n) => read(n, 'id') === variant.id,
          ) as ComponentNode;
          const target =
            variant.root.id === property.targetId
              ? root
              : root.findOne(
                  (n) => read(n, 'id') === `${variant.id}/${property.targetId}`,
                );
          if (!target) throw new Error('Missing property target');
          return target;
        });
        await checkpoint(`property:${c.id}:${property.id}`, async () => {
          const inherited = await dependents(set);
          touch(set, ...inherited, ...targets);
          if (!propertyKey)
            propertyKey = set!.addComponentProperty(
              property.name,
              property.type,
              defaultValue,
            );
          else {
            const current = set!.componentPropertyDefinitions[propertyKey]!;
            if (!current) drift('A component property identity was removed.');
            if (current.type !== property.type) drift('Property type changed.');
            if (
              current.defaultValue !== defaultValue ||
              propertyKey.split('#')[0] !== property.name
            )
              propertyKey = set!.editComponentProperty(propertyKey, {
                name: property.name,
                defaultValue,
              });
          }
          write(set!, `property:${property.id}`, propertyKey);
          for (const target of targets) {
            target.componentPropertyReferences = {
              ...target.componentPropertyReferences,
              [property.type === 'TEXT'
                ? 'characters'
                : property.type === 'BOOLEAN'
                  ? 'visible'
                  : 'mainComponent']: propertyKey,
            };
          }
        });
        propertyKeys[property.id] = read(set!, `property:${property.id}`);
      }
      const usage: string[] = [];
      const countUsage = (n: NodeSpecification) => {
        if (n.type === 'component-instance' && n.componentId === c.id)
          usage.push(n.id);
        if ('nodes' in n) n.nodes.forEach(countUsage);
      };
      spec.pages.forEach((p) =>
        p.screens.forEach((s) => s.nodes.forEach(countUsage)),
      );
      spec.components.forEach((c) =>
        c.variants.forEach((v) => countUsage(v.root)),
      );
      const entry = {
        id: c.id,
        name: c.name,
        category: c.category,
        nodeId: set!.id,
        properties: c.properties,
        propertyKeys,
        variants: variantRecords,
        dependencies: componentDependencies(c),
        usage,
        version: c.version,
      };
      registry.components = registry.components
        .filter((e) => e.id !== c.id)
        .concat(entry);
      await checkpoint(`registry:${c.id}`, () => {
        write(figma.root, key(input.projectId), canonicalJson(registry));
        for (const n of [
          set!,
          ...ownedDescendants(
            set!,
            (n) => read(n, 'projectId') === input.projectId,
          ),
        ])
          write(n, 'snapshot', snapshot(n));
      });
    }
    await checkpoint('manifest', () => {
      if (collection)
        write(
          collection,
          'snapshot',
          canonicalJson({ name: collection.name, modes: collection.modes }),
        );
      write(
        figma.root,
        manifestKey,
        canonicalJson({
          collectionId: collection?.id ?? null,
          variableIds: variables.map((v) => v.id),
          styleIds: styles.map((s) => s.id),
          pageId: page?.id ?? null,
        }),
      );
      write(figma.root, pendingKey, '');
    });
    const missingAssets: {
      localId: string;
      assetId: string;
      status: 'missing';
    }[] = [];
    for (const c of spec.components)
      for (const v of c.variants) {
        const visit = (raw: NodeSpecification, root = false) => {
          if (raw.type === 'frame' && raw.assetId) {
            const node = existingNodes.get(
              `${c.id}:${root ? v.id : `${v.id}/${raw.id}`}`,
            );
            const resolved = node ? read(node, 'assetResolution') : '';
            if (
              !resolved ||
              !(JSON.parse(resolved) as { hash: string | null }).hash
            )
              missingAssets.push({
                localId: raw.id,
                assetId: raw.assetId,
                status: 'missing',
              });
          }
          if ('nodes' in raw) raw.nodes.forEach((n) => visit(n));
        };
        visit(v.root, true);
      }
    const result = await readVariables(input.projectId);
    return {
      ...registry,
      missingAssets,
      assetsComplete: missingAssets.length === 0,
      variables: result,
      componentCount: registry.components.reduce(
        (n, c) => n + c.variants.length,
        0,
      ),
      variableCount: result.variables.length,
    };
  } finally {
    if (!recovery) renderState.busy = false;
  }
}
