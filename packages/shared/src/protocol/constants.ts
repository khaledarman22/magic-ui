import { z } from 'zod';
export const PROTOCOL_VERSION = 1 as const;
export const DEFAULT_BRIDGE_PORT = 3845;
export const REQUEST_TIMEOUT_MS = 10000;
export const HEARTBEAT_INTERVAL_MS = 5000;
export const MAX_MESSAGE_BYTES = 65536;
export const TOOL_NAMES = [
  'magic_ui_get_connection_status',
  'magic_ui_create_frame',
  'magic_ui_read_node',
  'magic_ui_initialize_project',
  'magic_ui_validate_design_spec',
  'magic_ui_render_design',
  'magic_ui_register_asset',
  'magic_ui_prepare_project',
  'magic_ui_present_screen',
  'magic_ui_render_design_system',
  'magic_ui_find_component',
  'magic_ui_read_components',
  'magic_ui_read_variables',
  'magic_ui_read_document',
  'magic_ui_list_pages',
  'magic_ui_read_page',
  'magic_ui_read_selection',
  'magic_ui_read_styles',
  'magic_ui_export_asset',
  'magic_ui_export_design_package',
  'magic_ui_get_sync_status',
  'magic_ui_preview_changes',
  'magic_ui_apply_changes',
  'magic_ui_resume_operation',
  'magic_ui_move_to_trash',
  'magic_ui_restore_from_trash',
  'magic_ui_list_sessions',
  'magic_ui_validate_design',
  'magic_ui_get_performance_report',
] as const;
export const identifierSchema = z.string().min(1).max(256);
export const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const portSchema = z.coerce.number().int().min(1024).max(65535);

// Figma Main does not provide TextEncoder or Node Buffer.
export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes++;
    else if (code < 0x800) bytes += 2;
    else if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      index + 1 < value.length &&
      value.charCodeAt(index + 1) >= 0xdc00 &&
      value.charCodeAt(index + 1) <= 0xdfff
    ) {
      bytes += 4;
      index++;
    } else bytes += 3;
  }
  return bytes;
}
