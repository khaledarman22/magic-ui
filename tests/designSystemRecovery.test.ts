import { expect, it } from 'vitest';
import raw from '../scripts/samples/phase-3.design-spec.json';
import {
  designSpecificationSchema,
  designSystemStepIds,
  type SystemRecoveryInput,
} from '../packages/shared/src/index.js';
import { createRenderHarness } from './figmaRenderHarness.js';
function setup() {
  const harness = createRenderHarness();
  const input: SystemRecoveryInput = {
    projectId: raw.projectId,
    pageId: '0:1',
    operationId: 'system-operation',
    documentId: 'test-document',
    expectedCompletedSteps: 0,
    specification: designSpecificationSchema.parse(raw),
  };
  const advance = async () => {
    const response = await harness.execute({
      command: 'advanceDesignSystem',
      input,
    });
    if (response.command !== 'advanceDesignSystem')
      throw new Error('Unexpected response');
    input.expectedCompletedSteps = response.result.completedSteps;
    return response.result;
  };
  const finish = async () => {
    for (let i = 0; i < 300; i++) {
      const result = await advance();
      if (result.done) return result.result!;
    }
    throw new Error('No completion');
  };
  return { harness, input, advance, finish };
}
it('checkpoints each resource and node, validates live Figma and replays without duplicates', async () => {
  const { harness, input, advance, finish } = setup();
  const plan = designSystemStepIds(input.specification);
  for (const id of plan) expect((await advance()).stepId).toBe(id);
  const first = await finish();
  expect(first.componentCount).toBe(6);
  expect(first.variableCount).toBe(8);
  const ids = harness.document.findAll(() => true).map((n) => n.id);
  expect(await finish()).toEqual(first);
  expect(harness.document.findAll(() => true).map((n) => n.id)).toEqual(ids);
  expect(harness.collections).toHaveLength(1);
});
it('resumes a partial mode allocation and a failed component node without duplicating them', async () => {
  const { harness, advance, finish } = setup();
  expect((await advance()).stepId).toBe('collection');
  const collection = harness.collections[0]!;
  const addMode = collection.addMode.bind(collection);
  collection.addMode = () => {
    throw new Error('Limited to 1 modes only');
  };
  await advance();
  await expect(advance()).rejects.toMatchObject({
    error: { code: 'FIGMA_MODE_LIMIT' },
  });
  collection.addMode = addMode;
  await advance();
  const createText = harness.api.createText;
  harness.api.createText.mockImplementationOnce(() => {
    throw new Error('Interrupted text creation');
  });
  let failed = false;
  for (let i = 0; i < 150; i++) {
    try {
      await advance();
    } catch (error) {
      expect(String(error)).toContain('Interrupted text creation');
      failed = true;
      break;
    }
  }
  expect(failed).toBe(true);
  harness.api.createText = createText;
  const partialIds = harness.document.findAll(() => true).map((n) => n.id);
  const result = await finish();
  expect(result.componentCount).toBe(6);
  expect(harness.document.findAll(() => true).map((n) => n.id)).toEqual(
    expect.arrayContaining(partialIds),
  );
  expect(harness.collections).toHaveLength(1);
});
it('refuses manual token drift and missing checkpointed nodes without recreating or overwriting', async () => {
  const { harness, advance, finish } = setup();
  for (let i = 0; i < 15; i++) await advance();
  const variable = harness.variables[0]!;
  const name = variable.name;
  variable.name = 'Manual';
  await expect(advance()).rejects.toMatchObject({
    error: { code: 'DRIFT_DETECTED' },
  });
  expect(variable.name).toBe('Manual');
  variable.name = name;
  await finish();
  const page = harness.document.children.find((n) => n.name === 'Components')!;
  const removed = page.children[0]!;
  page.children = [];
  await expect(advance()).rejects.toMatchObject({
    error: { code: 'DRIFT_DETECTED' },
  });
  expect(page.children).toHaveLength(0);
  page.children = [removed];
  await finish();
});
it('acknowledges a lost response before executing the next step and freezes the original spec', async () => {
  const { harness, input, advance } = setup();
  const first = await advance();
  input.expectedCompletedSteps = 0;
  const writes = harness.writes;
  expect(await advance()).toEqual(first);
  expect(harness.writes).toBe(writes);
  input.specification.tokens.values[0]!.values.light = '#010203';
  await expect(
    harness.execute({ command: 'advanceDesignSystem', input }),
  ).rejects.toMatchObject({ error: { code: 'DRIFT_DETECTED' } });
});

it('resumes a partially applied variable setter without applying it twice', async () => {
  const { harness, advance, finish } = setup();
  for (let i = 0; i < 11; i++) await advance();
  const variable = harness.variables[0]!,
    setter = variable.setValueForMode.bind(variable);
  let calls = 0;
  variable.setValueForMode = (id, value) => {
    calls++;
    setter(id, value);
    throw new Error('Setter interrupted after mutation');
  };
  await expect(advance()).rejects.toThrow('Setter interrupted after mutation');
  expect(calls).toBe(1);
  const identity = variable.id;
  await advance();
  expect(calls).toBe(1);
  variable.setValueForMode = setter;
  await finish();
  expect(harness.variables[0]!.id).toBe(identity);
});
it('does not turn failed legacy preflight into permission to overwrite on a retry', async () => {
  const { harness, input, advance } = setup();
  await harness.execute({
    command: 'renderDesignSystem',
    input: {
      projectId: input.projectId,
      pageId: input.pageId,
      specification: input.specification,
    },
  });
  const originalName = harness.variables[0]!.name;
  harness.variables[0]!.name = 'Manual legacy name';
  for (let i = 0; i < 2; i++)
    await expect(advance()).rejects.toMatchObject({
      error: { code: 'DRIFT_DETECTED' },
    });
  expect(harness.variables[0]!.name).toBe('Manual legacy name');
  harness.variables[0]!.name = originalName;
  expect((await advance()).stepId).toBe('collection');
});
it('rejects concurrent writes and unrelated manual changes during an asynchronous checkpoint', async () => {
  const { harness, input, advance } = setup();
  const first = advance();
  await expect(
    harness.execute({ command: 'advanceDesignSystem', input }),
  ).rejects.toMatchObject({ error: { code: 'SESSION_BUSY' } });
  await first;
  // The font loader is an actual awaited preflight boundary in the production renderer.
  const loader = harness.api.loadFontAsync;
  loader.mockImplementationOnce(async () => {
    harness.collections[0]!.name = 'Manual during preflight';
  });
  await expect(advance()).rejects.toMatchObject({
    error: { code: 'DRIFT_DETECTED' },
  });
  expect(harness.collections[0]!.name).toBe('Manual during preflight');
});

it('keeps the previous checkpoint readable when writing a storage fragment fails', async () => {
  const { harness, input, advance } = setup();
  await advance();
  const key = `system-recovery:${input.projectId}`;
  const pointer = harness.document.getSharedPluginData('magic_ui', key);
  const write = harness.document.setSharedPluginData.bind(harness.document);
  let failed = false;
  harness.document.setSharedPluginData = (namespace, name, value) => {
    if (!failed && name.startsWith(`${key}:`)) {
      failed = true;
      throw new Error('Fragment write failed');
    }
    write(namespace, name, value);
  };
  await expect(advance()).rejects.toThrow('Fragment write failed');
  expect(harness.document.getSharedPluginData('magic_ui', key)).toBe(pointer);
  harness.document.setSharedPluginData = write;
  harness.resetRuntime();
  expect((await advance()).stepId).toBe('mode:light');
  expect(harness.collections).toHaveLength(1);
});
