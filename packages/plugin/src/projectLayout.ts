import {
  basicMockupSources,
  type Command,
  type CommandResult,
  MagicUiError,
  failure,
  canonicalJson,
  sha256,
} from '@magic-ui/shared';
import {
  readIdentity as read,
  writeIdentity as write,
  drift,
  renderState,
} from './designSystemIdentity';
import { snapshot } from './designRenderer';
export function pageWorkspace(
  page: PageNode,
  projectId: string,
): FrameNode | undefined {
  const nodes = page.children.filter(
    (n) => read(n, 'id') === 'workspace' && read(n, 'projectId') === projectId,
  );
  if (nodes.length > 1 || (nodes[0] && nodes[0].type !== 'FRAME'))
    drift('Invalid workspace identity.');
  return nodes[0] as FrameNode | undefined;
}
export async function ensureProjectPage(
  projectId: string,
  id: string,
  name: string,
) {
  const matches = figma.root.children.filter((p) =>
    id === 'components'
      ? read(p, 'designSystemProject') === projectId
      : read(p, 'projectId') === projectId &&
        (read(p, 'projectPageId') === id ||
          (id === 'trash' && read(p, 'role') === 'trash')),
  );
  if (matches.length > 1) drift('Duplicate project page identity.');
  let page = matches[0];
  const key = `projectPage:${projectId}:${id}`,
    bound = read(figma.root, key);
  if (page && read(page, 'projectPageStatus') === 'pending')
    drift(
      'Project page initialization was interrupted; inspect the existing page before retrying.',
    );
  if (bound && page?.id !== bound)
    drift('Project page was removed or its identity changed.');
  if (!page) {
    page = figma.createPage();
    write(page, 'projectId', projectId);
    write(page, 'projectPageId', id);
    write(page, 'id', id);
    if (id === 'components') write(page, 'designSystemProject', projectId);
    if (id === 'trash') write(page, 'role', 'trash');
    write(figma.root, key, page.id);
    write(page, 'projectPageStatus', 'pending');
    page.name = name;
  }
  await page.loadAsync();
  let workspace = pageWorkspace(page, projectId);
  const workspaceId = read(page, 'workspaceId');
  if (workspaceId && workspace?.id !== workspaceId)
    drift('Project workspace was removed or moved.');
  if (!workspace) {
    workspace = figma.createFrame();
    write(workspace, 'id', 'workspace');
    write(workspace, 'workspaceStatus', 'pending');
    write(workspace, 'projectId', projectId);
    page.appendChild(workspace);
    workspace.name = 'Main Workspace';
    workspace.layoutMode = 'VERTICAL';
    workspace.itemSpacing = 48;
    workspace.layoutSizingHorizontal = 'HUG';
    workspace.layoutSizingVertical = 'HUG';
    workspace.fills = [];
    write(page, 'workspaceId', workspace.id);
    write(workspace, 'workspaceStatus', 'ready');
  }
  if (read(workspace, 'workspaceStatus') === 'pending')
    drift(
      'Workspace initialization was interrupted. Inspect the existing frame.',
    );
  write(page, 'projectPageStatus', 'ready');
  return { page, workspace };
}
function active(pageId: string, cancelled: () => boolean) {
  if (cancelled()) throw new MagicUiError(failure('CANCELLED', 'Cancelled.'));
  if (figma.currentPage.id !== pageId)
    throw new MagicUiError(
      failure('PAGE_CHANGED', 'Select the original page.'),
    );
}
export async function prepareProject(
  input: Extract<Command, { command: 'projectLayout' }>['input'],
  cancelled: () => boolean,
): Promise<Extract<CommandResult, { command: 'projectLayout' }>['result']> {
  if (renderState.busy)
    throw new MagicUiError(
      failure('SESSION_BUSY', 'Another write is running.'),
    );
  renderState.busy = true;
  try {
    active(input.pageId, cancelled);
    if (input.specification.projectId !== input.projectId)
      throw new Error('Project mismatch.');
    if (
      input.specification.pages.some(
        (p) => !p.kind || ['components', 'references', 'trash'].includes(p.id),
      )
    )
      throw new Error('Project pages require kind and non-reserved IDs.');
    const pages = [];
    for (const p of [
      ...input.specification.pages.map((p) => ({
        id: p.id,
        name: `${p.kind === 'app' ? 'App' : p.kind === 'website' ? 'Web' : 'Dashboard'} - ${p.name}`,
      })),
      { id: 'components', name: 'Components' },
      { id: 'references', name: 'References' },
      { id: 'trash', name: 'Trash' },
    ]) {
      active(input.pageId, cancelled);
      const { page, workspace } = await ensureProjectPage(
        input.projectId,
        p.id,
        p.name,
      );
      pages.push({ id: p.id, nodeId: page.id, workspaceId: workspace.id });
    }
    return { pages };
  } finally {
    renderState.busy = false;
  }
}
function treeSnapshot(node: SceneNode): string {
  return canonicalJson({
    node: snapshot(node),
    width:
      'layoutSizingHorizontal' in node && node.layoutSizingHorizontal === 'HUG'
        ? undefined
        : node.width,
    height:
      'layoutSizingVertical' in node && node.layoutSizingVertical === 'HUG'
        ? undefined
        : node.height,
    children: 'children' in node ? node.children.map(treeSnapshot) : [],
  });
}
export async function presentScreen(
  input: Extract<Command, { command: 'presentScreen' }>['input'],
  cancelled: () => boolean,
): Promise<Extract<CommandResult, { command: 'presentScreen' }>['result']> {
  if (renderState.busy)
    throw new MagicUiError(
      failure('SESSION_BUSY', 'Another write is running.'),
    );
  renderState.busy = true;
  try {
    active(input.pageId, cancelled);
    const roots = figma.currentPage.findAll(
      (n) =>
        read(n, 'projectId') === input.projectId &&
        read(n, 'screenId') === input.screenId &&
        read(n, 'id') === input.screenId,
    );
    if (roots.length !== 1 || roots[0]!.type !== 'FRAME')
      drift('Expected one original editable screen on this page.');
    const source = roots[0] as FrameNode;
    const sourceBefore = treeSnapshot(source),
      bytes = await source.exportAsync({ format: 'PNG' });
    active(input.pageId, cancelled);
    if (treeSnapshot(source) !== sourceBefore)
      drift('Screen changed during export.');
    const { workspace: components } = await ensureProjectPage(
      input.projectId,
      'components',
      'Components',
    );
    active(input.pageId, cancelled);
    const key = `mockup:${input.device}`,
      bound = read(components, key);
    let component = bound ? await figma.getNodeByIdAsync(bound) : null;
    active(input.pageId, cancelled);
    if (
      bound &&
      (!component ||
        component.type !== 'COMPONENT' ||
        component.parent !== components ||
        read(component, 'mockupDevice') !== input.device)
    )
      drift('Mockup component identity changed.');
    if (
      component &&
      treeSnapshot(component as ComponentNode) !==
        read(component, 'mockupGuard')
    )
      drift('Mockup was edited; preserve it and review the change.');
    if (!component) {
      const c = figma.createComponent();
      component = c;
      write(c, 'projectId', input.projectId);
      write(c, 'mockupDevice', input.device);
      write(c, 'id', `mockup:${input.device}`);
      components.appendChild(c);
      write(components, key, c.id);
      c.name =
        input.device === 'iphone'
          ? 'iPhone / Basic shapes'
          : 'Laptop / Basic shapes';
      const geometry = basicMockupSources[input.device];
      c.resize(geometry.width, geometry.height);
      c.cornerRadius = geometry.cornerRadius;
      c.fills = [{ type: 'SOLID', color: { r: 0.08, g: 0.08, b: 0.09 } }];
      const slot = figma.createRectangle();
      c.appendChild(slot);
      slot.name = 'Screen slot';
      write(slot, 'mockupSlot', 'screen');
      write(slot, 'id', `mockup-slot:${input.device}`);
      slot.x = geometry.insetX;
      slot.y = geometry.insetY;
      slot.resize(
        c.width - geometry.insetX * 2,
        c.height - geometry.insetY - geometry.bottomInset,
      );
      slot.cornerRadius = geometry.screenRadius;
      write(c, 'mockupGuard', treeSnapshot(c));
    }
    if (component.type !== 'COMPONENT') drift('Invalid mockup.');
    const destination =
      pageWorkspace(figma.currentPage, input.projectId) ?? figma.currentPage;
    const presentationKey = `presentation:${input.projectId}:${input.screenId}:${input.device}`,
      existing = read(figma.currentPage, presentationKey);
    let presentation = existing ? await figma.getNodeByIdAsync(existing) : null;
    active(input.pageId, cancelled);
    if (
      existing &&
      (!presentation ||
        presentation.type !== 'FRAME' ||
        presentation.parent !== destination ||
        read(presentation, 'sourceNodeId') !== source.id)
    )
      drift('Presentation identity changed.');
    if (
      presentation &&
      treeSnapshot(presentation as FrameNode) !==
        read(presentation, 'presentationGuard')
    )
      drift('Presentation has manual changes.');
    if (!presentation) {
      const p = figma.createFrame();
      presentation = p;
      destination.appendChild(p);
      write(p, 'sourceNodeId', source.id);
      write(p, 'id', `presentation:${input.screenId}:${input.device}`);
      write(figma.currentPage, presentationKey, p.id);
      p.name = `Presentation / ${source.name}`;
      p.layoutMode = 'VERTICAL';
      p.layoutSizingHorizontal = 'HUG';
      p.layoutSizingVertical = 'HUG';
      p.fills = [];
      const instance = component.createInstance();
      write(
        instance,
        'id',
        `mockup-instance:${input.screenId}:${input.device}`,
      );
      p.appendChild(instance);
    }
    if (presentation.type !== 'FRAME') drift('Invalid presentation.');
    const instance = presentation.children[0];
    if (instance?.type !== 'INSTANCE') drift('Missing mockup instance.');
    const presentationBefore = treeSnapshot(presentation);
    if ((await instance.getMainComponentAsync())?.id !== component.id)
      drift('Presentation uses a different mockup component.');
    active(input.pageId, cancelled);
    if (
      treeSnapshot(presentation) !== presentationBefore ||
      treeSnapshot(source) !== sourceBefore ||
      treeSnapshot(component) !== read(component, 'mockupGuard')
    )
      drift('Presentation, mockup or original changed during preflight.');
    const slot = instance.findOne((n) => read(n, 'mockupSlot') === 'screen');
    if (!slot || !('fills' in slot)) drift('Missing screen slot.');
    const hash = sha256(bytes),
      previousHash = read(presentation, 'sourceHash');
    if (hash !== previousHash) {
      const image = figma.createImage(bytes);
      (slot as RectangleNode).fills = [
        { type: 'IMAGE', imageHash: image.hash, scaleMode: 'FIT' },
      ];
      write(presentation, 'sourceHash', hash);
    }
    write(presentation, 'presentationGuard', treeSnapshot(presentation));
    return {
      componentId: component.id,
      instanceId: instance.id,
      presentationId: presentation.id,
      sourceNodeId: source.id,
      sourceHash: hash,
      mockupSource: 'basic-shapes',
      refresh: 'explicit',
    };
  } finally {
    renderState.busy = false;
  }
}
