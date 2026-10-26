import {
  canonicalJson,
  designSpecificationSchema,
  designSystemStepIds,
  failure,
  MagicUiError,
  systemRecoveryStateSchema,
  systemRecoveryStorageSchema,
  type SystemRecoveryState,
  type SystemRecoveryInput,
  type SystemRecoveryResult,
  type SystemResource,
} from '@magic-ui/shared';
import {
  readIdentity as read,
  writeIdentity as write,
  drift,
  renderState,
} from './designSystemIdentity';
import { snapshot } from './designRenderer';
import { renderDesignSystem } from './designSystemRenderer';

export type SystemRecoveryResource =
  BaseNode | Variable | VariableCollection | TextStyle;
const guardKey = 'systemRecoveryGuard';
const stateKey = (projectId: string) => `system-recovery:${projectId}`;
function readState(projectId: string): SystemRecoveryState | undefined {
  try {
    const saved = read(figma.root, stateKey(projectId));
    if (!saved) return undefined;
    const value: unknown = JSON.parse(saved);
    const storage = systemRecoveryStorageSchema.safeParse(value);
    if (!storage.success) {
      const state = systemRecoveryStateSchema.parse(value);
      designSpecificationSchema.parse(JSON.parse(state.specification));
      return state;
    }
    let data = '';
    for (let i = 0; i < storage.data.parts; i++) {
      const part = read(
        figma.root,
        `${stateKey(projectId)}:${storage.data.slot}:${i}`,
      );
      if (!part) drift('Design-system checkpoint fragment is missing.');
      data += part;
    }
    const state = systemRecoveryStateSchema.parse(JSON.parse(data));
    designSpecificationSchema.parse(JSON.parse(state.specification));
    return state;
  } catch (error) {
    if (error instanceof MagicUiError) throw error;
    drift(
      'Design-system checkpoint is invalid; no recovery writes were authorized.',
    );
  }
}
function persistState(projectId: string, state: SystemRecoveryState) {
  const key = stateKey(projectId);
  let slot: 0 | 1 = 0;
  const previous = read(figma.root, key);
  if (previous) {
    const parsed = systemRecoveryStorageSchema.safeParse(JSON.parse(previous));
    if (parsed.success) slot = parsed.data.slot === 0 ? 1 : 0;
  }
  const data = canonicalJson(state),
    parts = Math.ceil(data.length / 8000);
  if (parts > 512)
    throw new MagicUiError(
      failure(
        'MESSAGE_TOO_LARGE',
        'Design-system checkpoint exceeds its storage budget.',
      ),
    );
  // Each fragment is at most 32 KiB UTF-8, below Figma's per-value limit.
  // Publish the pointer last so a failed fragment write leaves the old state readable.
  for (let i = 0; i < parts; i++)
    write(
      figma.root,
      `${key}:${slot}:${i}`,
      data.slice(i * 8000, (i + 1) * 8000),
    );
  write(figma.root, key, canonicalJson({ version: 1, slot, parts }));
}
function resourceSnapshot(resource: SystemRecoveryResource): string {
  let properties: unknown;
  if ('resolvedType' in resource)
    properties = {
      name: resource.name,
      type: resource.resolvedType,
      values: resource.valuesByMode,
      collection: resource.variableCollectionId,
    };
  else if ('modes' in resource)
    properties = { name: resource.name, modes: resource.modes };
  else if ('fontSize' in resource && !('parent' in resource))
    properties = {
      name: resource.name,
      fontName: resource.fontName,
      fontSize: resource.fontSize,
      lineHeight: resource.lineHeight,
      letterSpacing: resource.letterSpacing,
    };
  else if ('type' in resource && resource.type === 'PAGE')
    properties = {
      name: resource.name,
      children: resource.children.map((n) => n.id),
    };
  else properties = snapshot(resource as SceneNode);
  return canonicalJson({
    properties,
    identity: [
      'id',
      'projectId',
      'componentId',
      'designSystemProject',
      'intent',
      ...resource
        .getSharedPluginDataKeys('magic_ui')
        .filter((key) => key.startsWith('property:'))
        .sort(),
    ].map((key) => [key, read(resource, key)]),
  });
}
async function resources(projectId: string) {
  const result = new Map<
    string,
    { descriptor: SystemResource; resource: SystemRecoveryResource }
  >();
  const put = (
    kind: SystemResource['kind'],
    resource: SystemRecoveryResource,
  ) =>
    result.set(`${kind}:${resource.id}`, {
      descriptor: { kind, id: resource.id },
      resource,
    });
  for (const variable of await figma.variables.getLocalVariablesAsync())
    if (read(variable, 'projectId') === projectId) put('variable', variable);
  for (const collection of await figma.variables.getLocalVariableCollectionsAsync())
    if (read(collection, 'projectId') === projectId)
      put('collection', collection);
  for (const style of await figma.getLocalTextStylesAsync())
    if (read(style, 'projectId') === projectId) put('style', style);
  for (const page of figma.root.children) {
    await page.loadAsync();
    if (read(page, 'designSystemProject') === projectId) put('node', page);
    const visit = (n: SceneNode) => {
      if (read(n, 'projectId') === projectId && !read(n, 'screenId'))
        put('node', n);
      if (n.type !== 'INSTANCE' && 'children' in n) n.children.forEach(visit);
    };
    page.children.forEach(visit);
  }
  return result;
}
class CheckpointReached extends Error {
  constructor(readonly stepId: string) {
    super('Checkpoint persisted');
  }
}
export class DesignSystemRecovery {
  readonly plan: string[];
  readonly fresh: boolean;
  private touched = new Set<string>();
  private executingStep = '';
  private initialSnapshots: Map<string, string> | undefined;
  private before = new Map<
    string,
    { descriptor: SystemResource; resource: SystemRecoveryResource }
  >();
  touch(resource: SystemRecoveryResource) {
    const previous = [...this.before.values()].find(
      (item) => item.resource.id === resource.id,
    );
    if (
      previous &&
      !this.touched.has(resource.id) &&
      read(resource, guardKey) !== resourceSnapshot(resource)
    )
      drift(`Resource changed before its write: ${resource.id}`);
    this.touched.add(resource.id);
  }
  private constructor(
    readonly input: SystemRecoveryInput,
    readonly state: SystemRecoveryState,
    fresh: boolean,
  ) {
    this.plan = designSystemStepIds(input.specification);
    const savedPlan = designSystemStepIds(
      designSpecificationSchema.parse(JSON.parse(state.specification)),
    );
    if (
      state.completed.length > savedPlan.length ||
      state.completed.some((key, i) => key !== savedPlan[i]) ||
      new Set(state.resources.map((r) => `${r.kind}:${r.id}`)).size !==
        state.resources.length
    )
      drift(
        'Invalid design-system checkpoint sequence or duplicate resource mapping.',
      );
    this.fresh = fresh;
  }
  static async open(input: SystemRecoveryInput) {
    const previous = readState(input.projectId);
    const documentId = read(figma.root, 'documentId');
    if (documentId && documentId !== input.documentId)
      drift('Design-system operation belongs to another document.');
    if (figma.currentPage.id !== input.pageId)
      throw new MagicUiError(
        failure('PAGE_CHANGED', 'Select the original target page.'),
      );
    if (previous)
      await new DesignSystemRecovery(input, previous, false).validate();
    if (
      input.expectedCompletedSteps > 0 &&
      previous?.operationId !== input.operationId
    )
      drift(
        'The saved Figma checkpoint is missing or belongs to a newer operation.',
      );
    if (previous?.operationId === input.operationId) {
      if (
        previous.specification !== canonicalJson(input.specification) ||
        previous.pageId !== input.pageId ||
        previous.documentId !== input.documentId
      )
        drift(
          'Cannot change the scope or frozen specification of a design-system operation.',
        );
      return new DesignSystemRecovery(
        input,
        previous,
        !previous.preflightPassed,
      );
    }
    if (
      previous?.status === 'running' ||
      read(figma.root, `design-system-pending:${input.projectId}`)
    )
      drift(
        'Resume the recorded design-system operation; legacy partial writes without checkpoints need explicit inspection.',
      );
    const recovery = new DesignSystemRecovery(
      input,
      {
        operationId: input.operationId,
        documentId: input.documentId,
        pageId: input.pageId,
        specification: canonicalJson(input.specification),
        completed: [],
        preflightPassed: false,
        registry: read(figma.root, `design-system:${input.projectId}`),
        manifest: read(figma.root, `design-system-manifest:${input.projectId}`),
        resources: [],
        status: 'running',
      },
      true,
    );
    recovery.initialSnapshots = new Map(
      [...(await resources(input.projectId))].map(([key, item]) => [
        key,
        resourceSnapshot(item.resource),
      ]),
    );
    return recovery;
  }
  async validate() {
    if (
      read(figma.root, `design-system:${this.input.projectId}`) !==
        this.state.registry ||
      read(figma.root, `design-system-manifest:${this.input.projectId}`) !==
        this.state.manifest
    )
      drift(
        'Design-system registry or manifest changed outside the checkpoint.',
      );
    const current = await resources(this.input.projectId);
    const expected = new Set(
      this.state.resources.map((r) => `${r.kind}:${r.id}`),
    );
    if (
      current.size !== expected.size ||
      [...current.keys()].some((key) => !expected.has(key))
    )
      throw new MagicUiError({
        ...failure(
          'DRIFT_DETECTED',
          'Design-system resource was added, removed or its ownership changed during interruption. No writes performed.',
        ),
        details: {
          missing: [...expected]
            .filter((key) => !current.has(key))
            .slice(0, 20),
          added: [...current.keys()]
            .filter((key) => !expected.has(key))
            .slice(0, 20),
        },
      });
    for (const { resource, descriptor } of current.values()) {
      const expected = read(resource, guardKey),
        actual = resourceSnapshot(resource);
      if (expected !== actual)
        throw new MagicUiError({
          ...failure(
            'DRIFT_DETECTED',
            `Design-system resource changed manually: ${read(resource, 'id') || resource.id}. Restore the checkpoint state before resuming.`,
          ),
          details: {
            resource: descriptor,
            expectedSnapshot: expected.slice(0, 6000),
            actualSnapshot: actual.slice(0, 6000),
            truncated: expected.length > 6000 || actual.length > 6000,
          },
        });
    }
  }
  private async capture(stepId?: string) {
    const current = await resources(this.input.projectId);
    if (this.before.size || this.touched.size) {
      if (
        (!this.executingStep.startsWith('registry:') &&
          read(figma.root, `design-system:${this.input.projectId}`) !==
            this.state.registry) ||
        (this.executingStep !== 'manifest' &&
          read(figma.root, `design-system-manifest:${this.input.projectId}`) !==
            this.state.manifest)
      )
        drift('Registry metadata changed during an unrelated checkpoint.');
      for (const [key, { resource }] of current) {
        if (
          !this.touched.has(resource.id) &&
          (!this.before.has(key) ||
            read(resource, guardKey) !== resourceSnapshot(resource))
        )
          drift(
            'An unrelated design-system resource changed during a checkpoint. Its baseline was not accepted.',
          );
      }
      for (const key of this.before.keys())
        if (!current.has(key))
          drift('A design-system resource disappeared during a checkpoint.');
    }
    if (stepId) this.state.completed.push(stepId);
    this.state.registry = read(
      figma.root,
      `design-system:${this.input.projectId}`,
    );
    this.state.manifest = read(
      figma.root,
      `design-system-manifest:${this.input.projectId}`,
    );
    this.state.resources = [...current.values()].map(
      ({ descriptor, resource }) => {
        write(resource, guardKey, resourceSnapshot(resource));
        return descriptor;
      },
    );
    persistState(this.input.projectId, this.state);
  }
  async step(id: string, action: () => void | Promise<void>) {
    if (this.state.completed.includes(id)) return;
    if (this.plan[this.state.completed.length] !== id)
      throw new MagicUiError(
        failure('INTERNAL_ERROR', `Unexpected design-system step ${id}.`),
      );
    if (this.initialSnapshots) {
      const current = await resources(this.input.projectId);
      if (
        current.size !== this.initialSnapshots.size ||
        [...current].some(
          ([key, item]) =>
            this.initialSnapshots!.get(key) !== resourceSnapshot(item.resource),
        )
      )
        drift(
          'Design-system changed during initial preflight; no baseline was accepted.',
        );
      await this.capture();
      write(figma.root, 'documentId', this.input.documentId);
      this.initialSnapshots = undefined;
    }
    await this.validate();
    if (figma.currentPage.id !== this.input.pageId)
      throw new MagicUiError(
        failure('PAGE_CHANGED', 'Target page changed before checkpoint.'),
      );
    this.executingStep = id;
    this.state.preflightPassed = true;
    this.before = await resources(this.input.projectId);
    this.touched.clear();
    try {
      await action();
    } catch (error) {
      // Persist the actual partial result, not a fictional completed step.
      // Stable identities are assigned immediately after resource allocation.
      await this.capture();
      throw error;
    }
    await this.capture(id);
    throw new CheckpointReached(id);
  }
  async finish() {
    await this.validate();
    this.state.status = 'completed';
    persistState(this.input.projectId, this.state);
  }
}
export async function advanceDesignSystem(
  input: SystemRecoveryInput,
  cancelled: () => boolean,
): Promise<SystemRecoveryResult> {
  if (renderState.busy)
    throw new MagicUiError(
      failure('SESSION_BUSY', 'Another document write is running.', true),
    );
  renderState.busy = true;
  try {
    if (cancelled())
      throw new MagicUiError(
        failure('CANCELLED', 'Cancelled before next checkpoint.'),
      );
    const recovery = await DesignSystemRecovery.open(input);
    const result = (
      stepId: string | null,
      done: boolean,
      value: SystemRecoveryResult['result'] = null,
    ): SystemRecoveryResult => ({
      operationId: input.operationId,
      stepId,
      completedSteps: recovery.state.completed.length,
      totalSteps: recovery.plan.length,
      done,
      result: value,
    });
    if (recovery.state.completed.length < input.expectedCompletedSteps)
      drift('Figma checkpoint is behind the local journal.');
    if (recovery.state.completed.length > input.expectedCompletedSteps)
      return result(
        recovery.state.completed[recovery.state.completed.length - 1]!,
        false,
      );
    try {
      const rendered = await renderDesignSystem(
        {
          projectId: input.projectId,
          pageId: input.pageId,
          specification: input.specification,
          operationId: input.operationId,
        },
        cancelled,
        recovery,
      );
      await recovery.finish();
      return result(null, true, rendered);
    } catch (error) {
      if (error instanceof CheckpointReached)
        return result(error.stepId, false);
      throw error;
    }
  } finally {
    renderState.busy = false;
  }
}
