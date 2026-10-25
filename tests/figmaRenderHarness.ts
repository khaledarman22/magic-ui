// Test-only Figma surface. The production renderer itself runs inside an isolated VM.
import { buildSync } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { vi } from 'vitest';
import type {
  RenderDesignInput,
  RenderDesignResult,
} from '../packages/shared/src/index.js';
const bundle = buildSync({
  entryPoints: ['packages/plugin/src/designRenderer.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'renderer',
  target: 'es2017',
  minify: true,
  legalComments: 'none',
  write: false,
}).outputFiles[0]!.text;
export function createRenderHarness() {
  let nextId = 0;
  let writes = 0;
  class HarnessNode {
    [key: string]: unknown;
    id = `1:${++nextId}`;
    name = 'New node';
    parent: HarnessNode | null = null;
    children: HarnessNode[] = [];
    data = new Map<string, string>();
    x = 0;
    y = 0;
    width = 100;
    height = 100;
    layoutMode = 'NONE';
    layoutSizingHorizontal = 'FIXED';
    layoutSizingVertical = 'FIXED';
    layoutPositioning = 'AUTO';
    fills: unknown[] = [];
    strokes: unknown[] = [];
    strokeWeight = 1;
    opacity = 1;
    cornerRadius = 0;
    visible = true;
    fontName: unknown = { family: 'Inter', style: 'Regular' };
    constructor(public type: string) {}
    getSharedPluginData(ns: string, key: string) {
      return this.data.get(`${ns}/${key}`) ?? '';
    }
    setSharedPluginData(ns: string, key: string, value: string) {
      writes++;
      this.data.set(`${ns}/${key}`, value);
    }
    resize(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
    insertChild(index: number, node: HarnessNode) {
      writes++;
      if (node.parent)
        node.parent.children.splice(node.parent.children.indexOf(node), 1);
      this.children.splice(index, 0, node);
      node.parent = this;
    }
    findAll(predicate: (node: HarnessNode) => boolean): HarnessNode[] {
      return this.children.flatMap((child) => [
        ...(predicate(child) ? [child] : []),
        ...child.findAll(predicate),
      ]);
    }
  }
  const page = new HarnessNode('PAGE');
  page.id = '0:1';
  const create = (type: string) => {
    const node = new Proxy(new HarnessNode(type), {
      set(target, key, value: unknown) {
        writes++;
        return Reflect.set(target, key, value);
      },
    });
    page.insertChild(page.children.length, node);
    return node;
  };
  const api = {
    getNodeByIdAsync: vi.fn(
      async (id: string) => page.findAll((node) => node.id === id)[0] ?? null,
    ),
    mixed: Symbol('mixed'),
    currentPage: page,
    createFrame: vi.fn(() => create('FRAME')),
    createText: vi.fn(() => create('TEXT')),
    createRectangle: vi.fn(() => create('RECTANGLE')),
    loadFontAsync: vi.fn(
      async (_font: { family: string; style: string }) => {},
    ),
  };
  const context = {
    figma: api,
    renderer: undefined as unknown as {
      renderDesign: (
        input: RenderDesignInput,
        cancelled: () => boolean,
      ) => Promise<RenderDesignResult>;
    },
  };
  runInNewContext(bundle, context, {
    contextCodeGeneration: { strings: false, wasm: false },
  });
  return {
    api,
    page,
    render: (input: RenderDesignInput, cancelled = () => false) =>
      context.renderer.renderDesign(input, cancelled),
    get writes() {
      return writes;
    },
    all: () => page.findAll(() => true),
  };
}
