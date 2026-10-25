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

export function createMcpServer(bridge: BridgeServer) {
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
