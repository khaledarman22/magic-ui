import { expect, it } from 'vitest';
import sample from '../scripts/samples/phase-3.design-spec.json';
import {
  designSpecificationSchema,
  resolveToken,
  orderComponents,
  componentSimilarity,
  validateDesignSpecification,
} from '../packages/shared/src/index.js';
import { createRenderHarness } from './figmaRenderHarness.js';
const specification = () =>
  designSpecificationSchema.parse(structuredClone(sample));
it('resolves semantic aliases in each mode and rejects missing, cyclic and mistyped references', () => {
  const spec = specification();
  expect(resolveToken(spec.tokens, 'color.surface', 'light')).toBe('#FFFFFF');
  expect(resolveToken(spec.tokens, 'color.surface', 'dark')).toBe('#151923');
  for (const value of [{ token: 'absent' }, { token: 'color.surface' }, 12]) {
    const broken = specification();
    broken.tokens.values.find((t) => t.id === 'color.surface')!.values.light =
      value;
    expect(validateDesignSpecification(broken).valid).toBe(false);
  }
  const broken = specification();
  broken.pages[0]!.screens[0]!.layout.width = { token: 'color.surface' };
  expect(validateDesignSpecification(broken).valid).toBe(false);
  delete broken.tokens.values[0]!.values.dark;
  expect(validateDesignSpecification(broken).valid).toBe(false);
});
it('orders inferred component dependencies and rejects cycles, duplicates and undeclared variant combinations', () => {
  const spec = specification();
  expect(
    orderComponents([...spec.components].reverse()).map((c) => c.id),
  ).toEqual(['button', 'card', 'input']);
  spec.components[0]!.dependencies = ['card'];
  expect(() => orderComponents(spec.components)).toThrow('Circular');
  const duplicate = specification();
  duplicate.components.push(duplicate.components[0]!);
  expect(validateDesignSpecification(duplicate).valid).toBe(false);
  const invalid = specification();
  const instance = invalid.pages[0]!.screens[0]!.nodes[0]!;
  if (instance.type !== 'component-instance') throw new Error();
  instance.overrides = { size: 'Small', state: 'Disabled' };
  expect(validateDesignSpecification(invalid).valid).toBe(false);
});
it('warns about similar components using names and properties', () => {
  const spec = specification(),
    c = structuredClone(spec.components[0]!);
  c.id = 'button-copy';
  spec.components.push(c);
  expect(componentSimilarity(c, spec.components[0]!)).toBe(1);
  expect(validateDesignSpecification(spec).warnings?.[0]).toContain(
    'button-copy',
  );
});
it('renders real production handlers twice, appends a variant to the existing set, binds variables and refuses manual drift', async () => {
  const h = createRenderHarness(),
    spec = specification();
  const render = () =>
    h.execute({
      command: 'renderDesignSystem',
      input: { projectId: spec.projectId, pageId: '0:1', specification: spec },
    });
  const first = await render();
  if (first.command !== 'renderDesignSystem') throw new Error();
  expect(first.result.variableCount).toBe(8);
  expect(first.result.componentCount).toBe(6);
  const second = await render();
  expect(second).toEqual(first);
  const screen = () =>
    h.render({
      projectId: spec.projectId,
      pageId: '0:1',
      screenId: 'home',
      specification: spec,
    });
  const a = await screen(),
    b = await screen();
  expect(b.created).toBe(0);
  expect(b.mapping).toEqual(a.mapping);
  expect(h.all().filter((n) => n.type === 'INSTANCE')).toHaveLength(3);
  const variant = structuredClone(spec.components[0]!.variants[0]!);
  variant.id = 'secondary-sm-default';
  variant.values = { type: 'Secondary', size: 'Small', state: 'Default' };
  spec.components[0]!.variants.push(variant);
  const extended = await render();
  if (extended.command !== 'renderDesignSystem') throw new Error();
  expect(
    extended.result.components.find((c) => c.id === 'button')!.nodeId,
  ).toBe(first.result.components.find((c) => c.id === 'button')!.nodeId);
  expect(extended.result.componentCount).toBe(7);
  expect(h.collections).toHaveLength(1);
  expect(
    h.document
      .findAll((n) => n.type === 'TEXT')
      .some(
        (n) =>
          Array.isArray(n.fills) &&
          JSON.stringify(n.fills).includes('VARIABLE_ALIAS'),
      ),
  ).toBe(true);
  h.variables[0]!.name = 'Manual';
  await expect(render()).rejects.toMatchObject({
    error: { code: 'DRIFT_DETECTED' },
  });
});
it('refuses cancelled, stale-page, concurrent and incomplete renders without duplicating resources', async () => {
  const h = createRenderHarness(),
    spec = specification();
  const command = {
    command: 'renderDesignSystem' as const,
    input: { projectId: spec.projectId, pageId: '0:1', specification: spec },
  };
  await expect(h.execute(command, () => true)).rejects.toMatchObject({
    error: { code: 'CANCELLED' },
  });
  expect(h.collections).toHaveLength(0);
  await expect(
    h.execute({ ...command, input: { ...command.input, pageId: 'wrong' } }),
  ).rejects.toMatchObject({ error: { code: 'PAGE_CHANGED' } });
  const first = h.execute(command);
  await expect(h.execute(command)).rejects.toMatchObject({
    error: { code: 'SESSION_BUSY' },
  });
  await first;
  h.variables.pop();
  await expect(h.execute(command)).rejects.toMatchObject({
    error: { code: 'DRIFT_DETECTED' },
  });
  expect(h.collections).toHaveLength(1);
});
it('refuses partial design system writes on retry and missing systems before screen creation', async () => {
  const h = createRenderHarness(),
    spec = specification();
  await expect(
    h.render({
      projectId: spec.projectId,
      pageId: '0:1',
      screenId: 'home',
      specification: spec,
    }),
  ).rejects.toMatchObject({ error: { code: 'INVALID_INPUT' } });
  expect(h.all()).toHaveLength(0);
  h.api.variables.createVariable = () => {
    throw new Error('Figma failure');
  };
  const command = {
    command: 'renderDesignSystem' as const,
    input: { projectId: spec.projectId, pageId: '0:1', specification: spec },
  };
  await expect(h.execute(command)).rejects.toThrow('Figma failure');
  await expect(h.execute(command)).rejects.toMatchObject({
    error: { code: 'DRIFT_DETECTED' },
  });
  expect(h.collections).toHaveLength(1);
});

it('detects duplicate registry identities and preserves property identity when display names change', async () => {
  const { componentRegistrySchema } =
    await import('../packages/shared/src/index.js');
  const h = createRenderHarness(),
    spec = specification();
  const render = () =>
    h.execute({
      command: 'renderDesignSystem',
      input: { projectId: spec.projectId, pageId: '0:1', specification: spec },
    });
  const first = await render();
  if (first.command !== 'renderDesignSystem') throw new Error();
  expect(
    componentRegistrySchema.safeParse({
      projectId: spec.projectId,
      components: [first.result.components[0], first.result.components[0]],
    }).success,
  ).toBe(false);
  const button = first.result.components.find((c) => c.id === 'button')!,
    key = button.propertyKeys.label!;
  const set = h.document.findOne((n) => n.id === button.nodeId)!;
  // Test surface models the API's stable property suffix across display-name edits.
  set.editComponentProperty = (
    oldKey: string,
    value: { defaultValue: string | boolean; name?: string },
  ) => {
    const next = value.name ? `${value.name}#${oldKey.split('#')[1]}` : oldKey;
    const definition = set.componentPropertyDefinitions[oldKey]!;
    delete set.componentPropertyDefinitions[oldKey];
    set.componentPropertyDefinitions[next] = {
      ...definition,
      defaultValue: value.defaultValue,
    };
    for (const instance of h.document.findAll(
      (n) => n.type === 'INSTANCE' && n.mainComponent?.parent?.id === set.id,
    )) {
      const value = instance.componentProperties[oldKey];
      if (value) {
        delete instance.componentProperties[oldKey];
        instance.componentProperties[next] = value;
      }
    }
    return next;
  };
  spec.components[0]!.properties.find((p) => p.id === 'label')!.name =
    'Caption';
  const renamed = await render();
  if (renamed.command !== 'renderDesignSystem') throw new Error();
  expect(
    renamed.result.components
      .find((c) => c.id === 'button')!
      .propertyKeys.label!.split('#')[1],
  ).toBe(key.split('#')[1]);
  expect(Object.keys(set.componentPropertyDefinitions)).toHaveLength(2);
});
it('accepts mode-resolved paint changes while preserving binding drift detection', async () => {
  const h = createRenderHarness(),
    spec = specification();
  await h.execute({
    command: 'renderDesignSystem',
    input: { projectId: spec.projectId, pageId: '0:1', specification: spec },
  });
  const input = {
    projectId: spec.projectId,
    pageId: '0:1',
    screenId: 'home',
    specification: spec,
  };
  const first = await h.render(input);
  const root = h.all().find((n) => n.id === first.mapping[0]!.nodeId)!;
  const paint = root.fills[0] as Record<string, unknown>;
  root.fills = [{ ...paint, color: { r: 0.1, g: 0.1, b: 0.1 } }];
  expect((await h.render(input)).created).toBe(0);
  root.fills = [
    {
      ...paint,
      boundVariables: {
        color: { type: 'VARIABLE_ALIAS', id: 'manually-changed' },
      },
    },
  ];
  await expect(h.render(input)).rejects.toMatchObject({
    error: { code: 'DRIFT_DETECTED' },
  });
});
it('reports Figma mode capacity errors explicitly and retains the partial collection safely', async () => {
  const h = createRenderHarness(),
    spec = specification();
  const create = h.api.variables.createVariableCollection;
  h.api.variables.createVariableCollection = (name: string) => {
    const collection = create(name);
    collection.addMode = () => {
      throw new Error('in addMode: Limited to 1 modes only');
    };
    return collection;
  };
  await expect(
    h.execute({
      command: 'renderDesignSystem',
      input: { projectId: spec.projectId, pageId: '0:1', specification: spec },
    }),
  ).rejects.toMatchObject({ error: { code: 'FIGMA_MODE_LIMIT' } });
  expect(h.collections).toHaveLength(1);
  expect(h.variables).toHaveLength(0);
});
