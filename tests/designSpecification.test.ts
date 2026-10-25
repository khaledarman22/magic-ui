import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { expect, it } from 'vitest';
import {
  designSpecificationSchema,
  migrateDesignSpecification,
  validateDesignSpecification,
  flattenScreen,
  planRender,
} from '../packages/shared/src/index.js';
import { sampleSpecification } from './fixtures/sampleSpecification.js';

it('accepts v1 and migrates without changing intent', () => {
  expect(validateDesignSpecification(sampleSpecification())).toEqual({
    valid: true,
    errors: [],
  });
  expect(migrateDesignSpecification(sampleSpecification())).toEqual(
    sampleSpecification(),
  );
  expect(() => migrateDesignSpecification({ schemaVersion: '2.0.0' })).toThrow(
    'Only Design Specification',
  );
});
it.each([
  ['schemaVersion', 2, 'schemaVersion'],
  ['projectId', '../escape', 'projectId'],
  ['pages.0.id', '', 'pages[0].id'],
  ['pages.0.screens.0.direction', 'up', 'pages[0].screens[0].direction'],
  ['pages.0.screens.0.layout.width', -1, 'pages[0].screens[0].layout.width'],
  [
    'pages.0.screens.0.layout.padding',
    12,
    'pages[0].screens[0].layout.padding',
  ],
  [
    'pages.0.screens.0.nodes.0.fontFamily',
    '',
    'pages[0].screens[0].nodes[0].fontFamily',
  ],
  [
    'pages.0.screens.0.nodes.0.fontSize',
    0,
    'pages[0].screens[0].nodes[0].fontSize',
  ],
  [
    'pages.0.screens.0.nodes.0.styling.opacity',
    2,
    'pages[0].screens[0].nodes[0].styling.opacity',
  ],
  [
    'pages.0.screens.0.nodes.0.styling.fills.0.color',
    'red',
    'pages[0].screens[0].nodes[0].styling.fills[0].color',
  ],
  [
    'pages.0.screens.0.nodes.0.lineHeight',
    -1,
    'pages[0].screens[0].nodes[0].lineHeight',
  ],
  [
    'pages.0.screens.0.nodes.0.textAlign',
    'up',
    'pages[0].screens[0].nodes[0].textAlign',
  ],
  ['pages.0.screens.0.nodes.0.id', 'home', 'pages[0].screens[0].nodes[0].id'],
  [
    'pages.0.screens.0.layout.width',
    'fill',
    'pages[0].screens[0].layout.width',
  ],
])('reports precise path for %s', (path, value, expected) => {
  const spec = sampleSpecification();
  const parts = path.split('.');
  let target = spec as unknown as Record<string, unknown>;
  for (const part of parts.slice(0, -1))
    target = target[part] as Record<string, unknown>;
  target[parts.at(-1)!] = value;
  expect(
    validateDesignSpecification(spec).errors.map((error) => error.path),
  ).toContain(expected);
});
it('generates the checked-in JSON schema from the same Zod contract', async () => {
  expect(
    JSON.parse(
      await readFile('packages/shared/design-spec.schema.json', 'utf8'),
    ),
  ).toEqual(z.toJSONSchema(designSpecificationSchema, { io: 'input' }));
});
it('plans creates, unchanged, one changed property and retained orphans independently of Figma', () => {
  const screen = sampleSpecification().pages[0]!.screens[0]!;
  const first = planRender(screen, []);
  expect(first.operations.map((operation) => operation.action)).toEqual(
    Array(7).fill('create'),
  );
  const existing = flattenScreen(screen).map((entry) => ({
    id: entry.id,
    nodeId: `figma-${entry.id}`,
    intent: entry.intent,
  }));
  expect(
    planRender(screen, existing).operations.every(
      (operation) => operation.action === 'unchanged',
    ),
  ).toBe(true);
  screen.nodes[0]!.name = 'Changed';
  expect(
    planRender(screen, existing)
      .operations.filter((operation) => operation.action === 'update')
      .map((operation) => operation.id),
  ).toEqual(['header']);
  screen.nodes.pop();
  expect(
    planRender(screen, existing).orphanedNodes.map((node) => node.id),
  ).toEqual(['button', 'button-label']);
});
