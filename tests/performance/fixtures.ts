import {
  designSpecificationSchema,
  type FigmaExtraction,
  type NodeSpecification,
} from '../../packages/shared/src/index.js';

// Counts include screen roots. Production keeps its 500-node specification limit.
export function performanceFixtures(total: number) {
  const specifications = [];
  const extractions: FigmaExtraction[] = [];
  for (let offset = 0; offset < total; offset += 500) {
    const count = Math.min(500, total - offset);
    let next = 1;
    const makeNodes = (remaining: number, depth: number): unknown[] => {
      const result: unknown[] = [];
      while (remaining > 0) {
        const size = depth < 5 ? Math.min(remaining, 20) : 1;
        const id = `n-${offset + next++}`;
        result.push({
          id,
          name: id,
          type: size > 1 ? 'frame' : 'rectangle',
          layout: { width: 100, height: 100 },
          ...(size > 1 ? { nodes: makeNodes(size - 1, depth + 1) } : {}),
        });
        remaining -= size;
      }
      return result;
    };
    const spec = designSpecificationSchema.parse({
      schemaVersion: '1.0.0',
      projectId: `bench-${offset}`,
      pages: [
        {
          id: `page-${offset}`,
          name: 'Benchmark',
          screens: [
            {
              id: `screen-${offset}`,
              name: 'Benchmark',
              layout: { width: 1000, height: 1000 },
              nodes: makeNodes(count - 1, 0),
            },
          ],
        },
      ],
    });
    specifications.push(spec);
    const screen = spec.pages[0]!.screens[0]!;
    const extraction: FigmaExtraction = {
      document: { id: 'bench', name: 'Benchmark' },
      roots: [screen.id],
      nodes: [],
      variables: [],
      styles: [],
      collections: [],
      registries: [],
    };
    const visit = (node: NodeSpecification, parentId: string | null) => {
      extraction.nodes.push({
        id: node.id,
        name: node.name,
        type: node.type.toUpperCase(),
        parentId,
        childIds: 'nodes' in node ? node.nodes.map((n) => n.id) : [],
        properties: {
          width: 100,
          height: 100,
          layoutMode: 'NONE',
          fills: [],
          strokes: [],
        },
        identity: { id: node.id },
      });
      if ('nodes' in node) node.nodes.forEach((n) => visit(n, node.id));
    };
    visit({ ...screen, type: 'frame' }, null);
    extractions.push(extraction);
  }
  return { specifications, extractions };
}
