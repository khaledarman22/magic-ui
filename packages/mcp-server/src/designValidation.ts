import {
  componentRegistrySchema,
  designValidationReportSchema,
  type DesignCheck,
  type DesignValidationReport,
  type FigmaExtraction,
  type ValidationEvidence,
} from '@magic-ui/shared';

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function bounds(value: unknown) {
  const b = object(value);
  return ['x', 'y', 'width', 'height'].every(
    (k) => typeof b[k] === 'number' && Number.isFinite(b[k]),
  )
    ? {
        x: b.x as number,
        y: b.y as number,
        width: b.width as number,
        height: b.height as number,
      }
    : undefined;
}

/** Checks observed structure only. Never mutates nodes or guesses missing metrics. */
export function validateFigmaDesign(
  data: FigmaExtraction,
  scope = 'document',
): DesignValidationReport {
  const report: DesignValidationReport = {
    scope,
    nodeCount: data.nodes.length,
    passed: [],
    failed: [],
    warnings: [],
    unverified: [],
    consistency: 'Sequential snapshot; concurrent edits are not locked.',
  };
  const add = (
    status: 'passed' | 'failed' | 'warnings' | 'unverified',
    check: DesignCheck['check'],
    code: string,
    message: string,
    nodeId?: string,
  ) => {
    report[status].push({
      check,
      code,
      message,
      ...(nodeId ? { nodeId } : {}),
    });
  };
  const nodes = new Map(data.nodes.map((n) => [n.id, n]));
  const identities = new Map<string, string>();
  let components = 0,
    frames = 0,
    texts = 0,
    instances = 0;
  for (const n of data.nodes) {
    const p = n.properties;
    if (n.identity.assetChild === 'missing' && p.visible !== false)
      add(
        'failed',
        'assets',
        'MISSING_ASSET_BINDING',
        'The rendered asset is explicitly marked missing by Magic UI.',
        n.id,
      );
    if (n.type === 'COMPONENT' || n.type === 'COMPONENT_SET') {
      components++;
      const stableId = n.identity.id;
      if (stableId && n.identity.projectId) {
        const key = `${n.identity.projectId}:${stableId}`;
        if (identities.has(key))
          add(
            'failed',
            'components',
            'DUPLICATE_COMPONENT',
            `Stable component identity duplicates ${identities.get(key)}.`,
            n.id,
          );
        else {
          identities.set(key, n.id);
          add(
            'passed',
            'components',
            'COMPONENT_IDENTITY',
            'Component has a unique scoped stable identity.',
            n.id,
          );
        }
      } else
        add(
          'warnings',
          'components',
          'UNMANAGED_COMPONENT',
          'No Magic UI identity; display names do not establish duplicates.',
          n.id,
        );
    }
    if ('layoutMode' in p) {
      frames++;
      const auto = p.layoutMode === 'HORIZONTAL' || p.layoutMode === 'VERTICAL';
      if (!auto && p.layoutMode !== 'NONE' && p.layoutMode !== 'GRID')
        add(
          'failed',
          'auto-layout',
          'INVALID_LAYOUT_MODE',
          'Unrecognized layout mode.',
          n.id,
        );
      else if (p.layoutMode === 'GRID')
        add(
          'unverified',
          'auto-layout',
          'GRID_LAYOUT',
          'Grid layout is outside the current structural validator.',
          n.id,
        );
      else {
        let invalid = false;
        for (const key of [
          'paddingTop',
          'paddingRight',
          'paddingBottom',
          'paddingLeft',
        ]) {
          if (
            auto &&
            (typeof p[key] !== 'number' ||
              !Number.isFinite(p[key]) ||
              p[key] < 0)
          ) {
            add(
              'failed',
              'auto-layout',
              'INVALID_PADDING',
              `${key} must be finite and nonnegative.`,
              n.id,
            );
            invalid = true;
          }
        }
        // Negative spacing is supported by Figma; it is not inherently an error.
        if (
          auto &&
          (typeof p.itemSpacing !== 'number' || !Number.isFinite(p.itemSpacing))
        ) {
          add(
            'failed',
            'auto-layout',
            'INVALID_SPACING',
            'Auto-layout spacing must be finite.',
            n.id,
          );
          invalid = true;
        }
        if (!invalid)
          add(
            'passed',
            'auto-layout',
            'LAYOUT_FIELDS',
            'Observed layout fields are structurally valid.',
            n.id,
          );
      }
    }
    if (
      p.layoutSizingHorizontal === 'FILL' ||
      p.layoutSizingVertical === 'FILL'
    ) {
      const parent = n.parentId ? nodes.get(n.parentId) : undefined;
      if (!parent)
        add(
          'unverified',
          'auto-layout',
          'PARENT_OUTSIDE_SCOPE',
          'Cannot verify fill sizing without its parent.',
          n.id,
        );
      else if (
        !['HORIZONTAL', 'VERTICAL', 'GRID'].includes(
          String(parent.properties.layoutMode),
        ) ||
        p.layoutPositioning === 'ABSOLUTE'
      )
        add(
          'failed',
          'auto-layout',
          'INVALID_FILL_PARENT',
          'Fill sizing requires flow placement in an auto-layout parent.',
          n.id,
        );
    }
    if (n.type === 'TEXT') {
      texts++;
      if (typeof p.hasMissingFont === 'boolean')
        add(
          p.hasMissingFont ? 'failed' : 'passed',
          'fonts',
          p.hasMissingFont ? 'MISSING_FONT' : 'FONTS_AVAILABLE',
          p.hasMissingFont
            ? 'Figma reports missing fonts.'
            : 'Figma reports all node fonts available.',
          n.id,
        );
      else
        add(
          'unverified',
          'fonts',
          'FONT_AVAILABILITY_UNKNOWN',
          'Font availability was not supplied by Figma.',
          n.id,
        );
      let clipped = false;
      const box = bounds(p.absoluteBoundingBox);
      const ancestors = new Set<string>();
      const lineage: FigmaExtraction['nodes'] = [];
      let parentId = n.parentId;
      while (parentId && nodes.has(parentId) && !ancestors.has(parentId)) {
        ancestors.add(parentId);
        const parent = nodes.get(parentId)!;
        lineage.push(parent);
        parentId = parent.parentId;
      }
      const rotated = [n, ...lineage].some(
        (item) => Number(item.properties.rotation ?? 0) !== 0,
      );
      const hidden = [n, ...lineage].some(
        (item) => item.properties.visible === false,
      );
      const missingAncestor = !!parentId && parentId !== data.document.id;
      const clipping = lineage.filter(
        (item) => item.properties.clipsContent === true,
      );
      const incompleteBounds =
        !box ||
        clipping.some((item) => !bounds(item.properties.absoluteBoundingBox));
      if (!rotated && !hidden && box) {
        for (const ancestor of clipping) {
          const clip = bounds(ancestor.properties.absoluteBoundingBox);
          if (
            clip &&
            (box.x < clip.x - 0.5 ||
              box.y < clip.y - 0.5 ||
              box.x + box.width > clip.x + clip.width + 0.5 ||
              box.y + box.height > clip.y + clip.height + 0.5)
          ) {
            add(
              'failed',
              'text-overflow',
              'TEXT_OUTSIDE_CLIP',
              `Text bounds exceed clipping ancestor ${ancestor.id}.`,
              n.id,
            );
            clipped = true;
            break;
          }
        }
      }
      if (rotated || hidden || missingAncestor || incompleteBounds)
        add(
          'unverified',
          'text-overflow',
          'TEXT_CLIP_GEOMETRY_UNVERIFIED',
          'Clipping comparison needs visible, unrotated text and complete ancestor bounds.',
          n.id,
        );
      if (
        p.textAutoResize === 'NONE' ||
        p.textAutoResize === 'TRUNCATE' ||
        p.textTruncation === 'ENDING'
      )
        add(
          'unverified',
          'text-overflow',
          'FIXED_TEXT_METRICS',
          'Internal glyph overflow/truncation needs visual inspection; no mutation-based measurement is used.',
          n.id,
        );
      else if (!box)
        add(
          'unverified',
          'text-overflow',
          'TEXT_BOUNDS_UNKNOWN',
          'No text bounds available.',
          n.id,
        );
      else if (
        !clipped &&
        !rotated &&
        !hidden &&
        !missingAncestor &&
        !incompleteBounds
      )
        add(
          'passed',
          'text-overflow',
          'TEXT_CLIP_BOUNDS',
          'Text bounds fit the observed axis-aligned clipping ancestors; glyph appearance is not compared.',
          n.id,
        );
    }
    if (n.type === 'INSTANCE') {
      instances++;
      if (p.mainComponentId === null)
        add(
          'failed',
          'instances',
          'BROKEN_INSTANCE',
          'Figma could not resolve the main component.',
          n.id,
        );
      else if (typeof p.mainComponentId === 'string')
        add(
          'passed',
          'instances',
          'MAIN_COMPONENT_RESOLVED',
          'Figma resolved the main component, including external components.',
          n.id,
        );
      else
        add(
          'unverified',
          'instances',
          'INSTANCE_NOT_RESOLVED',
          'Main-component evidence is unavailable.',
          n.id,
        );
    }
    checkReferences(n.validation, n.id);
  }
  function checkReferences(
    evidence: ValidationEvidence | undefined,
    nodeId?: string,
  ) {
    if (!evidence) {
      add(
        'unverified',
        'tokens',
        'REFERENCE_EVIDENCE_MISSING',
        'Variable references were not resolved by Figma.',
        nodeId,
      );
      add(
        'unverified',
        'assets',
        'ASSET_EVIDENCE_MISSING',
        'Image references were not resolved by Figma.',
        nodeId,
      );
      return;
    }
    for (const r of evidence.references) {
      const check =
        r.kind === 'variable'
          ? 'tokens'
          : r.kind === 'image'
            ? 'assets'
            : 'components';
      add(
        r.status === 'missing'
          ? 'failed'
          : r.status === 'resolved'
            ? 'passed'
            : 'unverified',
        check,
        `${r.kind.toUpperCase()}_${r.status.toUpperCase()}`,
        `${r.kind} reference ${r.id}: ${r.status}.`,
        nodeId,
      );
    }
  }
  checkReferences(data.validation);
  for (const raw of data.registries) {
    const parsed = componentRegistrySchema.safeParse(raw);
    if (!parsed.success) {
      add(
        'failed',
        'components',
        'INVALID_COMPONENT_REGISTRY',
        'Component registry is invalid or contains duplicate identities.',
      );
      continue;
    }
    for (const component of parsed.data.components) {
      for (const target of [component, ...component.variants]) {
        const found = nodes.get(target.nodeId);
        if (!found)
          add(
            scope === 'document' ? 'failed' : 'unverified',
            'components',
            'COMPONENT_TARGET_MISSING',
            `Registry target ${target.id} is absent from this scope.`,
            target.nodeId,
          );
        else if (
          !['COMPONENT', 'COMPONENT_SET'].includes(found.type) ||
          found.identity.id !== target.id ||
          found.identity.projectId !== parsed.data.projectId
        )
          add(
            'failed',
            'components',
            'COMPONENT_TARGET_MISMATCH',
            'Registry target type or stable identity does not match.',
            found.id,
          );
      }
    }
  }
  for (const [check, count] of [
    ['components', components],
    ['auto-layout', frames],
    ['fonts', texts],
    ['text-overflow', texts],
    ['instances', instances],
  ] as const)
    if (count === 0 && !report.failed.some((i) => i.check === check))
      add(
        'unverified',
        check,
        'NO_APPLICABLE_NODES',
        'No applicable nodes in the selected scope.',
      );
  for (const check of ['tokens', 'assets'] as const)
    if (
      ![...report.passed, ...report.failed, ...report.unverified].some(
        (i) => i.check === check,
      )
    )
      add(
        'passed',
        check,
        'NO_REFERENCES',
        'The inspected scope contains no references to resolve.',
      );
  add(
    'unverified',
    'visual',
    'VISUAL_COMPARISON_UNAVAILABLE',
    'No visual comparison engine is installed. Structural checks do not prove visual correctness.',
  );
  return designValidationReportSchema.parse(report);
}
