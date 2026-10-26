// SHA-256 over bytes, shared with the sandboxed Plugin (no Node/Web Crypto there).
export function sha256(bytes: Uint8Array): string {
  const primes: number[] = [];
  for (let n = 2; primes.length < 64; n++)
    if (!primes.some((p) => p * p <= n && n % p === 0)) primes.push(n);
  const h = primes
    .slice(0, 8)
    .map((p) => ((Math.sqrt(p) % 1) * 0x100000000) | 0);
  const k = primes.map((p) => ((Math.cbrt(p) % 1) * 0x100000000) | 0);
  const data = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
  data.set(bytes);
  data[bytes.length] = 128;
  const view = new DataView(data.buffer);
  view.setUint32(data.length - 8, Math.floor(bytes.length / 0x20000000));
  view.setUint32(data.length - 4, bytes.length * 8);
  const rotr = (n: number, b: number) => (n >>> b) | (n << (32 - b));
  const w = new Int32Array(64);
  for (let offset = 0; offset < data.length; offset += 64) {
    for (let i = 0; i < 64; i++) {
      if (i < 16) w[i] = view.getInt32(offset + i * 4);
      else {
        const a = w[i - 15]!,
          b = w[i - 2]!;
        w[i] =
          (w[i - 16]! +
            (rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3)) +
            w[i - 7]! +
            (rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10))) |
          0;
      }
    }
    let [a, b, c, d, e, f, g, j] = h as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    for (let i = 0; i < 64; i++) {
      const t1 =
        (j +
          (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) +
          ((e & f) ^ (~e & g)) +
          k[i]! +
          w[i]!) |
        0;
      const t2 =
        ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) +
          ((a & b) ^ (a & c) ^ (b & c))) |
        0;
      j = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    [a, b, c, d, e, f, g, j].forEach((value, i) => {
      h[i] = (h[i]! + value) | 0;
    });
  }
  return h.map((n) => (n >>> 0).toString(16).padStart(8, '0')).join('');
}
