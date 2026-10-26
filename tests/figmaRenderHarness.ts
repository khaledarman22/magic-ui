// Test-only Figma surface. The production renderer itself runs inside an isolated VM.
import { buildSync } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { vi } from 'vitest';
import type {
  RenderDesignInput,
  RenderDesignResult,
  Command,
  CommandResult,
} from '../packages/shared/src/index.js';
const bundle = buildSync({
  entryPoints: ['packages/plugin/src/pluginCommandHandlers.ts'],
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
    boundVariables: Record<string, { type: string; id: string }> = {};
    componentPropertyReferences: Record<string, string> = {};
    private propertyDefinitions: Record<
      string,
      { type: string; defaultValue: string | boolean }
    > = {};
    get componentPropertyDefinitions() {
      if (this.type === 'COMPONENT' && this.parent?.type === 'COMPONENT_SET')
        throw new Error(
          'Can only get component property definitions of a component set or non-variant component',
        );
      if (
        this.type === 'COMPONENT_SET' &&
        this.children.some((n) => !n.name.includes('='))
      )
        throw new Error('Component set has existing errors');
      return this.propertyDefinitions;
    }
    componentProperties: Record<
      string,
      { type: string; value: string | boolean }
    > = {};
    mainComponent: HarnessNode | null = null;
    fontName: unknown = { family: 'Inter', style: 'Regular' };
    constructor(public type: string) {}
    getSharedPluginData(ns: string, key: string) {
      return this.data.get(`${ns}/${key}`) ?? '';
    }
    setSharedPluginData(ns: string, key: string, value: string) {
      writes++;
      this.data.set(`${ns}/${key}`, value);
    }
    appendChild(node: HarnessNode) {
      this.insertChild(this.children.length, node);
    }
    findOne(predicate: (n: HarnessNode) => boolean) {
      return this.findAll(predicate)[0] ?? null;
    }
    async loadAsync() {}
    setBoundVariable(field: string, variable: { id: string } | null) {
      if (variable)
        this.boundVariables[field] = {
          type: 'VARIABLE_ALIAS',
          id: variable.id,
        };
      else delete this.boundVariables[field];
    }
    async setTextStyleIdAsync(id: string) {
      this.textStyleId = id;
    }
    addComponentProperty(
      name: string,
      type: string,
      defaultValue: string | boolean,
    ) {
      const key = `${name}#${++nextId}`;
      this.componentPropertyDefinitions[key] = { type, defaultValue };
      return key;
    }
    editComponentProperty(
      key: string,
      value: { defaultValue: string | boolean },
    ) {
      this.componentPropertyDefinitions[key]!.defaultValue = value.defaultValue;
      return key;
    }
    createInstance() {
      const instance = create('INSTANCE');
      instance.mainComponent = this;
      for (const [k, p] of Object.entries(
        this.parent?.componentPropertyDefinitions ?? {},
      ))
        instance.componentProperties[k] = {
          type: p.type,
          value: p.defaultValue,
        };
      return instance;
    }
    async getMainComponentAsync() {
      return this.mainComponent;
    }
    swapComponent(component: HarnessNode) {
      this.mainComponent = component;
    }
    setProperties(properties: Record<string, string | boolean>) {
      for (const [k, v] of Object.entries(properties))
        this.componentProperties[k]!.value = v;
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
  const document = new HarnessNode('DOCUMENT');
  const page = new HarnessNode('PAGE');
  document.appendChild(page);
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
  class HarnessVariable extends HarnessNode {
    valuesByMode: Record<string, unknown> = {};
    constructor(
      name: string,
      public variableCollectionId: string,
      public resolvedType: string,
    ) {
      super('VARIABLE');
      this.name = name;
    }
    setValueForMode(id: string, value: unknown) {
      this.valuesByMode[id] = value;
    }
  }
  class HarnessCollection extends HarnessNode {
    defaultModeId = 'mode-1';
    modes = [{ modeId: 'mode-1', name: 'Mode 1' }];
    renameMode(id: string, name: string) {
      this.modes.find((m) => m.modeId === id)!.name = name;
    }
    addMode(name: string) {
      const id = `mode-${this.modes.length + 1}`;
      this.modes.push({ modeId: id, name });
      return id;
    }
  }
  const variables: HarnessVariable[] = [],
    collections: HarnessCollection[] = [],
    styles: HarnessNode[] = [];
  const api = {
    root: document,
    variables: {
      getLocalVariablesAsync: async () => variables,
      getLocalVariableCollectionsAsync: async () => collections,
      createVariableCollection: (name: string) => {
        const c = new HarnessCollection('COLLECTION');
        c.name = name;
        collections.push(c);
        return c;
      },
      createVariable: (name: string, c: HarnessCollection, type: string) => {
        if (name.includes('.'))
          throw new Error('in createVariable: invalid variable name');
        const v = new HarnessVariable(name, c.id, type);
        variables.push(v);
        return v;
      },
      createVariableAlias: (v: HarnessVariable) => ({
        type: 'VARIABLE_ALIAS',
        id: v.id,
      }),
      setBoundVariableForPaint: (
        p: Record<string, unknown>,
        field: string,
        v: HarnessVariable | null,
      ) => ({
        ...p,
        boundVariables: v
          ? { [field]: { type: 'VARIABLE_ALIAS', id: v.id } }
          : {},
      }),
    },
    getLocalTextStylesAsync: async () => styles,
    createTextStyle: () => {
      const s = new HarnessNode('STYLE');
      styles.push(s);
      return s;
    },
    createPage: () => {
      const p = new HarnessNode('PAGE');
      document.appendChild(p);
      return p;
    },
    createComponent: () => create('COMPONENT'),
    combineAsVariants: (nodes: HarnessNode[], parent: HarnessNode) => {
      const set = create('COMPONENT_SET');
      parent.appendChild(set);
      nodes.forEach((n) => set.appendChild(n));
      return set;
    },
    getNodeByIdAsync: vi.fn(
      async (id: string) =>
        document.findAll((node) => node.id === id)[0] ?? null,
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
      executePluginCommand: (
        command: Command,
        cancelled: () => boolean,
      ) => Promise<CommandResult>;
    },
  };
  runInNewContext(bundle, context, {
    contextCodeGeneration: { strings: false, wasm: false },
  });
  return {
    api,
    page,
    render: (input: RenderDesignInput, cancelled = () => false) =>
      context.renderer
        .executePluginCommand({ command: 'renderDesign', input }, cancelled)
        .then((r) => r.result as RenderDesignResult),
    execute: (command: Command, cancelled = () => false) =>
      context.renderer.executePluginCommand(command, cancelled),
    document,
    variables,
    collections,
    styles,
    get writes() {
      return writes;
    },
    all: () => page.findAll(() => true),
  };
}
