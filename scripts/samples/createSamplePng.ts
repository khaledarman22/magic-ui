// Deterministic test/smoke fixture only; never used by production asset handling.
import { deflateSync } from 'node:zlib';
export function createSamplePng(
  width = 256,
  height = 256,
  noise = false,
): Buffer {
  const pixels = Buffer.alloc(height * (width * 3 + 1));
  let seed = 123456789;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      for (let channel = 0; channel < 3; channel++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        pixels[y * (width * 3 + 1) + 1 + x * 3 + channel] = noise
          ? seed >>> 24
          : channel === 0
            ? Math.floor((x / width) * 180) + 40
            : channel === 1
              ? Math.floor((y / height) * 160) + 60
              : 180;
      }
  const chunk = (type: string, data: Buffer) => {
    const name = Buffer.from(type),
      body = Buffer.concat([name, data]);
    let crc = -1;
    for (const byte of body) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const length = Buffer.alloc(4),
      check = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    check.writeUInt32BE((crc ^ -1) >>> 0);
    return Buffer.concat([length, body, check]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
