import { expect, it } from 'vitest';
import {
  extractionSchema,
  type RawFigmaNode,
} from '../packages/shared/src/index.js';
import { validateFigmaDesign } from '../packages/mcp-server/src/designValidation.js';
const node = (
  id: string,
  type: string,
  properties: Record<string, unknown> = {},
): RawFigmaNode => ({
  id,
  name: id,
  type,
  parentId: null,
  childIds: [],
  properties,
  identity: {},
  validation: { references: [] },
});
const extraction = (nodes: RawFigmaNode[], registries: unknown[] = []) =>
  extractionSchema.parse({
    document: { id: '0:0', name: 'Fixture' },
    roots: ['0:1'],
    nodes,
    variables: [],
    collections: [],
    styles: [],
    registries,
    validation: { references: [] },
  });
it('reports every structural failure category and never claims visual comparison', () => {
  const a = node('1:1', 'COMPONENT');
  a.identity = { projectId: 'project', id: 'button' };
  const b = node('1:2', 'COMPONENT');
  b.identity = { ...a.identity };
  const frame = node('1:3', 'FRAME', {
    layoutMode: 'VERTICAL',
    paddingTop: -1,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    itemSpacing: 8,
    clipsContent: true,
    absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
  });
  const text = node('1:4', 'TEXT', {
    hasMissingFont: true,
    textAutoResize: 'NONE',
    absoluteBoundingBox: { x: 90, y: 0, width: 30, height: 20 },
  });
  text.parentId = frame.id;
  const instance = node('1:5', 'INSTANCE', { mainComponentId: null });
  instance.validation = {
    references: [
      { kind: 'variable', id: 'missing-token', status: 'missing' },
      { kind: 'image', id: 'missing-image', status: 'missing' },
    ],
  };
  const registry = {
    projectId: 'project',
    components: [
      {
        id: 'deleted',
        name: 'Deleted',
        category: 'control',
        nodeId: '1:99',
        properties: [],
        variants: [],
        dependencies: [],
        usage: [],
        version: 1,
      },
    ],
  };
  const report = validateFigmaDesign(
    extraction([a, b, frame, text, instance], [registry]),
  );
  expect(report.failed.map((x) => x.code)).toEqual(
    expect.arrayContaining([
      'DUPLICATE_COMPONENT',
      'COMPONENT_TARGET_MISSING',
      'INVALID_PADDING',
      'TEXT_OUTSIDE_CLIP',
      'MISSING_FONT',
      'BROKEN_INSTANCE',
      'VARIABLE_MISSING',
      'IMAGE_MISSING',
    ]),
  );
  expect(report.unverified.map((x) => x.code)).toEqual(
    expect.arrayContaining([
      'FIXED_TEXT_METRICS',
      'VISUAL_COMPARISON_UNAVAILABLE',
    ]),
  );
  expect(report.passed.some((x) => x.check === 'visual')).toBe(false);
});
it('does not mistake same names, remote components, negative spacing, or out-of-scope dependencies for failures', () => {
  const frame = node('1:1', 'FRAME', {
    layoutMode: 'HORIZONTAL',
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    itemSpacing: -8,
  });
  const instance = node('1:2', 'INSTANCE', { mainComponentId: 'remote:1' });
  const a = node('1:3', 'COMPONENT');
  a.name = 'Same name';
  const b = node('1:4', 'COMPONENT');
  b.name = a.name;
  const report = validateFigmaDesign(
    extraction([frame, instance, a, b]),
    frame.id,
  );
  expect(report.failed).toEqual([]);
  expect(
    report.warnings.filter((x) => x.code === 'UNMANAGED_COMPONENT'),
  ).toHaveLength(2);
  expect(report.passed.some((x) => x.code === 'MAIN_COMPONENT_RESOLVED')).toBe(
    true,
  );
});
it('retains missing evidence, invalid registry, fill-parent errors and resolver failures honestly', () => {
  const frame = node('1:1', 'FRAME', { layoutMode: 'NONE' });
  const child = node('1:2', 'TEXT', { layoutSizingHorizontal: 'FILL' });
  child.parentId = frame.id;
  delete child.validation;
  frame.validation = {
    references: [
      { kind: 'variable', id: 'remote:token', status: 'unverified' },
    ],
  };
  const report = validateFigmaDesign(
    extraction([frame, child], [{ components: [{}, {}] }]),
  );
  expect(report.failed.map((x) => x.code)).toEqual(
    expect.arrayContaining([
      'INVALID_COMPONENT_REGISTRY',
      'INVALID_FILL_PARENT',
    ]),
  );
  expect(report.unverified.map((x) => x.code)).toEqual(
    expect.arrayContaining([
      'FONT_AVAILABILITY_UNKNOWN',
      'REFERENCE_EVIDENCE_MISSING',
      'VARIABLE_UNVERIFIED',
    ]),
  );
});
it('detects explicit missing asset bindings but ignores resolved hidden labels', () => {
  const missing = node('1:1', 'TEXT', { visible: true });
  missing.identity.assetChild = 'missing';
  const restored = node('1:2', 'TEXT', { visible: false });
  restored.identity.assetChild = 'missing';
  const report = validateFigmaDesign(extraction([missing, restored]));
  expect(
    report.failed
      .filter((i) => i.code === 'MISSING_ASSET_BINDING')
      .map((i) => i.nodeId),
  ).toEqual(['1:1']);
});
it('does not claim clipping verification for rotated text or missing ancestors', () => {
  const text = node('1:1', 'TEXT', {
    rotation: 25,
    hasMissingFont: false,
    absoluteBoundingBox: { x: 0, y: 0, width: 10, height: 10 },
  });
  text.parentId = 'outside';
  const report = validateFigmaDesign(extraction([text]), text.id);
  expect(report.passed.some((i) => i.code === 'TEXT_CLIP_BOUNDS')).toBe(false);
  expect(
    report.unverified.some((i) => i.code === 'TEXT_CLIP_GEOMETRY_UNVERIFIED'),
  ).toBe(true);
});
