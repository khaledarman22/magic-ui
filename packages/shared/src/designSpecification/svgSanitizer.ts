// A deliberately small SVG subset. Reconstruct XML from allowlisted elements and
// attributes; never pass through arbitrary markup, CSS, entities or URL references.
const elements = new Set([
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
]);
const attributes = new Set([
  'width',
  'height',
  'viewBox',
  'x',
  'y',
  'x1',
  'x2',
  'y1',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'd',
  'points',
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'fill-rule',
  'clip-rule',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'transform',
]);
export function sanitizeSvg(source: string): string {
  if (
    source.length > 1024 * 1024 ||
    /<!DOCTYPE|<!ENTITY|<!\[CDATA\[/i.test(source)
  )
    throw new Error('Unsupported SVG declarations or size.');
  const cleaned = source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<(script|style|foreignObject)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  const stack: string[] = [];
  let elementCount = 0;
  let output = '',
    cursor = 0,
    root = false;
  for (const match of cleaned.matchAll(/<[^>]*>/g)) {
    if (cleaned.slice(cursor, match.index).trim())
      throw new Error('SVG text content is unsupported.');
    cursor = match.index! + match[0].length;
    const tag = /^<(\/)?([A-Za-z][\w:-]*)([\s\S]*?)(\/)?\s*>$/.exec(match[0]);
    if (!tag) throw new Error('Malformed SVG.');
    if (++elementCount > 10000 || stack.length > 32)
      throw new Error('SVG complexity limit exceeded.');
    const name = tag[2]!;
    if (!elements.has(name))
      throw new Error(`Unsupported SVG element: ${name}`);
    if (tag[1]) {
      if (tag[3]!.trim() || tag[4] || stack.pop() !== name)
        throw new Error('Unbalanced SVG.');
      output += `</${name}>`;
      continue;
    }
    if (!stack.length) {
      if (root || name !== 'svg') throw new Error('Expected one SVG root.');
      root = true;
    }
    const attrs = tag[3]!;
    let position = 0,
      safe = '';
    const seen = new Set<string>();
    for (const attribute of attrs.matchAll(
      /\s+([\w:-]+)\s*=\s*(["'])(.*?)\2/gs,
    )) {
      if (attrs.slice(position, attribute.index).trim())
        throw new Error('Malformed SVG attributes.');
      position = attribute.index! + attribute[0].length;
      const key = attribute[1]!,
        value = attribute[3]!;
      if (seen.has(key)) throw new Error('Duplicate SVG attribute.');
      seen.add(key);
      if (!attributes.has(key)) continue;
      if (/[<>&"']|url\s*\(|(?:javascript|data|https?):/i.test(value)) continue;
      if (
        (key === 'fill' || key === 'stroke') &&
        !/^(?:#[0-9a-fA-F]{3,8}|none|currentColor|[a-zA-Z]+|rgba?\([\d\s.,%]+\))$/.test(
          value,
        )
      )
        continue;
      safe += ` ${key}="${value}"`;
    }
    if (attrs.slice(position).trim())
      throw new Error('Malformed SVG attributes.');
    output += `<${name}${name === 'svg' ? ' xmlns="http://www.w3.org/2000/svg"' : ''}${safe}${tag[4] ? '/' : ''}>`;
    if (!tag[4]) stack.push(name);
  }
  if (!root || stack.length || cleaned.slice(cursor).trim())
    throw new Error('Malformed SVG document.');
  return output;
}
