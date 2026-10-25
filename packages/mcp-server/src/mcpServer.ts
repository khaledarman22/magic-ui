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
  server.registerTool(
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
  server.registerTool(
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
  server.registerTool(
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
