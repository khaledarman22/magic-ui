import { readerInputSchema, readerChunkSchema, readerToolSchema, exportPackageSchema, exportAssetSchema, exportResultSchema } from '@magic-ui/shared';
import { exportDesignPackage, exportAsset } from './figmaExport.js';
import {
  designSystemToolSchema,
  designSystemResultSchema,
  readDesignSystemToolSchema,
  componentRegistrySchema,
  variablesResultSchema,
  findComponentSchema,
  findComponentResultSchema,
  componentSimilarity,
} from '@magic-ui/shared';
import { DesignWorkspace } from './designWorkspace.js';
import {
  initializeProjectSchema,
  initializeProjectResultSchema,
  validateDesignToolSchema,
  validationResultSchema,
  validateDesignSpecification,
  renderDesignToolSchema,
  renderDesignResultSchema,
} from '@magic-ui/shared';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  connectionStatusInputSchema,
  connectionStatusSchema,
  createFrameToolSchema,
  readNodeToolSchema,
  nodeSnapshotSchema,
  MagicUiError,
  failure,
  REQUEST_TIMEOUT_MS,
  type Command,
} from '@magic-ui/shared';
import type { BridgeServer } from './bridgeServer.js';

export function createMcpServer(
  bridge: BridgeServer,
  workspace = new DesignWorkspace(
    process.env.MAGIC_UI_WORKSPACE_ROOT ?? process.cwd(),
  ),
) {
  const server = new McpServer({ name: 'magic-ui', version: '0.1.0' });
  server.registerTool(
    'magic_ui_get_connection_status',
    {
      description:
        'Read the connected Figma session and current page. Use these identifiers for subsequent operations.',
      inputSchema: connectionStatusInputSchema,
      outputSchema: connectionStatusSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        permission: 'read',
        timeoutMs: REQUEST_TIMEOUT_MS,
        errorCodes: [],
      },
    },
    () => {
      const status = connectionStatusSchema.parse(bridge.status());
      return {
        content: [{ type: 'text', text: JSON.stringify(status) }],
        structuredContent: status,
      };
    },
  );
  async function execute(
    sessionId: string,
    command: Command,
    signal: AbortSignal,
  ) {
    try {
      const response = await bridge.request(sessionId, command, signal);
      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(response.result) },
        ],
        structuredContent: response.result,
      };
    } catch (error) {
      const detail =
        error instanceof MagicUiError
          ? error.error
          : failure(
              'INTERNAL_ERROR',
              'Command failed. Inspect Figma before retrying.',
            );
      return {
        isError: true,
        content: [{ type: 'text' as const, text: JSON.stringify(detail) }],
      };
    }
  }
  const sharedErrors = [
    'INVALID_INPUT',
    'NOT_CONNECTED',
    'SESSION_MISMATCH',
    'TIMEOUT',
    'CANCELLED',
    'INTERNAL_ERROR',
  ];
  if (!bridge.readOnly) server.registerTool(
    'magic_ui_create_frame',
    {
      description:
        'Create one frame in the explicitly selected session and current page. After a timeout, inspect Figma before retrying to avoid duplicates.',
      inputSchema: createFrameToolSchema,
      outputSchema: nodeSnapshotSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: {
        permission: 'write',
        timeoutMs: REQUEST_TIMEOUT_MS,
        errorCodes: [...sharedErrors, 'PAGE_CHANGED'],
      },
    },
    ({ sessionId, ...input }, extra) =>
      execute(sessionId, { command: 'createFrame', input }, extra.signal),
  );
  server.registerTool(
    'magic_ui_read_node',
    {
      description:
        'Read basic node identity and geometry from an explicitly selected Figma session.',
      inputSchema: readNodeToolSchema,
      outputSchema: nodeSnapshotSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        permission: 'read',
        timeoutMs: REQUEST_TIMEOUT_MS,
        errorCodes: [...sharedErrors, 'NODE_NOT_FOUND'],
      },
    },
    ({ sessionId, ...input }, extra) =>
      execute(sessionId, { command: 'readNode', input }, extra.signal),
  );
  async function localResult<T extends Record<string, unknown>>(
    action: () => Promise<T> | T,
  ) {
    try {
      const result = await action();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        structuredContent: result,
      };
    } catch (error) {
      const detail =
        error instanceof MagicUiError
          ? error.error
          : failure(
              'WORKSPACE_ERROR',
              'Workspace operation failed. Check the allowed root, project files and permissions. Existing files are never overwritten.',
            );
      return {
        isError: true,
        content: [{ type: 'text' as const, text: JSON.stringify(detail) }],
      };
    }
  }
  if (!bridge.readOnly) server.registerTool(
    'magic_ui_initialize_project',
    {
      description:
        'Create <ProjectName>-Design with project.json and design-spec.json inside MAGIC_UI_WORKSPACE_ROOT (defaults to server working directory). Existing directories and project IDs are refused.',
      inputSchema: initializeProjectSchema,
      outputSchema: initializeProjectResultSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: {
        permission: 'write',
        timeoutMs: REQUEST_TIMEOUT_MS,
        errorCodes: ['INVALID_INPUT', 'WORKSPACE_ERROR', 'CANCELLED'],
      },
    },
    (input, extra) =>
      localResult(() => {
        if (extra.signal.aborted)
          throw new MagicUiError(failure('CANCELLED', 'Request cancelled.'));
        return workspace.initialize(input);
      }),
  );
  server.registerTool(
    'magic_ui_validate_design_spec',
    {
      description:
        'Validate a Design Specification v1 locally, including identity and layout relationships. Returns field paths; no Figma connection is needed.',
      inputSchema: validateDesignToolSchema,
      outputSchema: validationResultSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        permission: 'read',
        timeoutMs: REQUEST_TIMEOUT_MS,
        errorCodes: ['INVALID_INPUT'],
      },
    },
    ({ specification }) =>
      localResult(() => validateDesignSpecification(specification)),
  );
  if (!bridge.readOnly) server.registerTool(
    'magic_ui_render_design',
    {
      description:
        'Read project design-spec.json from the allowed workspace and render one screen into the explicitly selected current Figma page. Reuses stable IDs, reports orphans without deleting, and refuses manual drift before writing.',
      inputSchema: renderDesignToolSchema,
      outputSchema: renderDesignResultSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        permission: 'write',
        timeoutMs: REQUEST_TIMEOUT_MS,
        errorCodes: [
          ...sharedErrors,
          'PAGE_CHANGED',
          'SESSION_BUSY',
          'FONT_UNAVAILABLE',
          'FIGMA_MODE_LIMIT',
          'DRIFT_DETECTED',
          'MESSAGE_TOO_LARGE',
          'PROJECT_NOT_FOUND',
          'WORKSPACE_ERROR',
          'UNSUPPORTED_SCHEMA_VERSION',
        ],
      },
    },
    async ({ sessionId, ...input }, extra) => {
      try {
        const specification = await workspace.readSpecification(
          input.projectId,
        );
        return execute(
          sessionId,
          { command: 'renderDesign', input: { ...input, specification } },
          extra.signal,
        );
      } catch (error) {
        return localResult(() => {
          throw error;
        });
      }
    },
  );

  const annotations = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  };
  if (!bridge.readOnly) server.registerTool(
    'magic_ui_render_design_system',
    {
      description:
        'Render project tokens, typography styles and explicit component variants in dependency order. Persist the returned component registry locally. Requires an explicit active page and session.',
      inputSchema: designSystemToolSchema,
      outputSchema: designSystemResultSchema,
      annotations: { ...annotations, readOnlyHint: false },
      _meta: {
        permission: 'write',
        timeoutMs: REQUEST_TIMEOUT_MS,
        errorCodes: [
          ...sharedErrors,
          'PAGE_CHANGED',
          'DRIFT_DETECTED',
          'FONT_UNAVAILABLE',
          'FIGMA_MODE_LIMIT',
          'WORKSPACE_ERROR',
          'MESSAGE_TOO_LARGE',
        ],
      },
    },
    ({ sessionId, ...input }, extra) =>
      localResult(async () => {
        const specification = await workspace.readSpecification(
          input.projectId,
        );
        const response = await bridge.request(
          sessionId,
          { command: 'renderDesignSystem', input: { ...input, specification } },
          extra.signal,
        );
        if (response.command !== 'renderDesignSystem')
          throw new Error('Unexpected response');
        await workspace.writeRegistry(
          componentRegistrySchema.parse({
            projectId: input.projectId,
            components: response.result.components,
          }),
        );
        return response.result;
      }),
  );
  server.registerTool(
    'magic_ui_find_component',
    {
      description:
        'Search the local component registry by name, category and property similarity before proposing a new component. Does not require Figma.',
      inputSchema: findComponentSchema,
      outputSchema: findComponentResultSchema,
      annotations,
      _meta: {
        permission: 'read',
        timeoutMs: REQUEST_TIMEOUT_MS,
        errorCodes: ['WORKSPACE_ERROR', 'PROJECT_NOT_FOUND'],
      },
    },
    (input) =>
      localResult(async () => {
        const registry = await workspace.readRegistry(input.projectId);
        return {
          matches: registry.components
            .filter((c) => !input.category || c.category === input.category)
            .map((component) => ({
              component,
              similarity: componentSimilarity(input, component),
            }))
            .filter(
              (m) =>
                !input.name ||
                m.similarity > 0.3 ||
                m.component.name
                  .toLowerCase()
                  .includes(input.name.toLowerCase()),
            )
            .sort((a, b) => b.similarity - a.similarity),
        };
      }),
  );
  server.registerTool(
    'magic_ui_read_components',
    {
      description:
        'Read the project component registry stored in the explicitly selected Figma document.',
      inputSchema: readDesignSystemToolSchema,
      outputSchema: componentRegistrySchema,
      annotations,
      _meta: {
        permission: 'read',
        timeoutMs: REQUEST_TIMEOUT_MS,
        errorCodes: sharedErrors,
      },
    },
    ({ sessionId, ...input }, extra) =>
      execute(sessionId, { command: 'readComponents', input }, extra.signal),
  );
  server.registerTool(
    'magic_ui_read_variables',
    {
      description:
        'Read actual local Figma variables and modes owned by this project.',
      inputSchema: readDesignSystemToolSchema,
      outputSchema: variablesResultSchema,
      annotations,
      _meta: {
        permission: 'read',
        timeoutMs: REQUEST_TIMEOUT_MS,
        errorCodes: sharedErrors,
      },
    },
    ({ sessionId, ...input }, extra) =>
      execute(sessionId, { command: 'readVariables', input }, extra.signal),
  );
  const readTools = { magic_ui_read_document: 'document', magic_ui_list_pages: 'pages', magic_ui_read_page: 'page', magic_ui_read_selection: 'selection', magic_ui_read_styles: 'styles' } as const;
  for (const [name, scope] of Object.entries(readTools)) server.registerTool(name, {
    description: `Read Figma ${scope} without document writes. Returns a JSON fragment and nextCursor; repeat the identical scope with that cursor, concatenate data, then parse JSON. read_page accepts a page or subtree nodeId.`,
    inputSchema: readerToolSchema.omit({scope:true}), outputSchema: readerChunkSchema, annotations,
    _meta: {permission:'read', timeoutMs:REQUEST_TIMEOUT_MS, errorCodes:[...sharedErrors,'INVALID_CURSOR','NODE_NOT_FOUND','MESSAGE_TOO_LARGE']},
  }, ({sessionId,...input},extra)=>execute(sessionId,{command:'readFigma',input:readerInputSchema.parse({...input,scope})},extra.signal));
  const exportRoot=process.env.MAGIC_UI_WORKSPACE_ROOT ?? process.cwd();
  server.registerTool('magic_ui_export_asset', {
    description:'Export PNG or SVG without modifying Figma. Writes to a new private figma-export directory under MAGIC_UI_WORKSPACE_ROOT. SVG retains its vector dimensions; scale applies to PNG.',
    inputSchema:exportAssetSchema,outputSchema:exportResultSchema,annotations,
    _meta:{permission:'read',timeoutMs:REQUEST_TIMEOUT_MS,errorCodes:[...sharedErrors,'WORKSPACE_ERROR','MESSAGE_TOO_LARGE']},
  },(input,extra)=>localResult(()=>exportAsset(bridge,exportRoot,input,extra.signal)));
  server.registerTool('magic_ui_export_design_package', {
    description:'Extract the specified page or subtree into a framework-independent figma-export package, including raw source, normalized design specification, assets, previews and loss reports. Does not modify Figma. Output uses a new private directory under MAGIC_UI_WORKSPACE_ROOT.',
    inputSchema:exportPackageSchema,outputSchema:exportResultSchema,annotations,
    _meta:{permission:'read',timeoutMs:REQUEST_TIMEOUT_MS,errorCodes:[...sharedErrors,'WORKSPACE_ERROR','MESSAGE_TOO_LARGE']},
  },(input,extra)=>localResult(()=>exportDesignPackage(bridge,exportRoot,input,extra.signal)));
  return server;
}

export async function listRegisteredTools(bridge: BridgeServer) {
  const server = createMcpServer(bridge);
  const client = new Client({ name: 'magic-ui-selftest', version: '0.1.0' });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    return (await client.listTools()).tools.map((tool) => tool.name);
  } finally {
    await client.close();
    await server.close();
  }
}
