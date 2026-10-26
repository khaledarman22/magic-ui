import {
  canonicalJson,
  failure,
  MagicUiError,
  type NodeSpecification,
  type Tokens,
} from '@magic-ui/shared';
export const renderState = { busy: false };
export const readIdentity = (
  node: { getSharedPluginData(ns: string, key: string): string },
  key: string,
) => node.getSharedPluginData('magic_ui', key);
export function writeIdentity(
  node: {
    getSharedPluginData(ns: string, key: string): string;
    setSharedPluginData(ns: string, key: string, value: string): void;
  },
  key: string,
  value: string,
) {
  if (readIdentity(node, key) !== value)
    node.setSharedPluginData('magic_ui', key, value);
}
export function drift(message: string): never {
  throw new MagicUiError(failure('DRIFT_DETECTED', message));
}
export async function projectVariables(projectId: string) {
  return (await figma.variables.getLocalVariablesAsync()).filter(
    (v) => readIdentity(v, 'projectId') === projectId,
  );
}
export async function applyTokenBindings(
  node: SceneNode,
  spec: NodeSpecification,
  tokens: Tokens,
  variables: Variable[],
  styles: TextStyle[],
) {
  const byId = new Map(variables.map((v) => [readIdentity(v, 'id'), v]));
  const bind = (field: VariableBindableNodeField, value: unknown) => {
    const id =
      value && typeof value === 'object' && 'token' in value
        ? String(value.token)
        : undefined;
    const variable = id ? byId.get(id) : undefined;
    if (id && !variable)
      throw new MagicUiError(
        failure('INVALID_INPUT', `Render design system first: ${id}`),
      );
    if (
      'setBoundVariable' in node &&
      node.boundVariables?.[field]?.id !== variable?.id
    )
      node.setBoundVariable(field, variable ?? null);
  };
  const l = spec.layout;
  bind('width', l.width);
  bind('height', l.height);
  if (node.type === 'INSTANCE') return;
  bind('opacity', spec.styling.opacity);
  bind('strokeWeight', spec.styling.strokeWeight);
  if (node.type !== 'TEXT') {
    for (const field of [
      'topLeftRadius',
      'topRightRadius',
      'bottomLeftRadius',
      'bottomRightRadius',
    ] as const)
      bind(field, spec.styling.cornerRadius);
  }
  if ('paddingTop' in node) {
    bind('paddingTop', l.padding.top);
    bind('paddingRight', l.padding.right);
    bind('paddingBottom', l.padding.bottom);
    bind('paddingLeft', l.padding.left);
    bind('itemSpacing', l.itemSpacing);
  }
  for (const key of ['fills', 'strokes'] as const) {
    if (!(key in node)) continue;
    const target = node as GeometryMixin;
    const paints = target[key];
    if (paints === figma.mixed) continue;
    const next = paints.map((p, i) => {
      const color = spec.styling[key][i]?.color;
      return p.type === 'SOLID'
        ? figma.variables.setBoundVariableForPaint(
            p,
            'color',
            typeof color === 'object' ? (byId.get(color.token) ?? null) : null,
          )
        : p;
    });
    if (canonicalJson(next) !== canonicalJson(paints)) target[key] = next;
  }
  if (node.type === 'TEXT' && spec.type === 'text') {
    const style = spec.typography
      ? styles.find((s) => readIdentity(s, 'id') === spec.typography)
      : undefined;
    if (spec.typography && !style)
      throw new MagicUiError(
        failure('INVALID_INPUT', 'Render typography styles first.'),
      );
    if (style && node.textStyleId !== style.id)
      await node.setTextStyleIdAsync(style.id);
    else if (!style && node.textStyleId && node.textStyleId !== figma.mixed)
      await node.setTextStyleIdAsync('');
    const textBind = (field: VariableBindableTextField, value: unknown) => {
      const variable =
        value && typeof value === 'object' && 'token' in value
          ? byId.get(String(value.token))
          : undefined;
      if (!variable && spec.typography) return;
      const current = node.boundVariables?.[field];
      if (
        (Array.isArray(current) ? current[0]?.id : undefined) !== variable?.id
      )
        node.setBoundVariable(field, variable ?? null);
    };
    textBind('fontSize', spec.fontSize);
    textBind('fontFamily', spec.fontFamily);
    textBind('fontStyle', spec.fontStyle);
    bind('characters', spec.content);
    textBind('lineHeight', spec.lineHeight);
    textBind('letterSpacing', spec.letterSpacing);
  }
  void tokens;
}
