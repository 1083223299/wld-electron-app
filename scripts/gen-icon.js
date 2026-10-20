const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const crcTable = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makePng(size, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const px = pixels(x, y);
      const off = y * (size * 4 + 1) + 1 + x * 4;
      raw[off] = px[0];
      raw[off + 1] = px[1];
      raw[off + 2] = px[2];
      raw[off + 3] = px[3];
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function draw(size) {
  return (x, y) => {
    const cx = size / 2 - 0.5;
    const cy = size / 2 - 0.5;
    const dx = x - cx;
    const dy = y - cy;
    const r = size / 2 - 1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > r) return [0, 0, 0, 0];
    const aa = Math.min(1, (r - dist) / 1.2);
    const t = (x + y) / (size * 2);
    const cr = Math.round(79 + (123 - 79) * t);
    const cg = Math.round(140 + (92 - 140) * t);
    const cb = Math.round(255 + (255 - 255) * t);
    const inside =
      Math.abs(dx) < size * 0.28 && dy < size * 0.22 && dy > -size * 0.26;
    if (inside) return [255, 255, 255, Math.round(255 * aa)];
    return [cr, cg, cb, Math.round(255 * aa)];
  };
}

/**
 * 创建一个图标(ICO)文件的Buffer
 * @param {Array} entries - 图标条目数组，每个条目包含size和png属性
 * @returns {Buffer} - 生成的ICO文件Buffer
 */
function makeIco(entries) {
  // 创建ICO文件头，共6字节
  const header = Buffer.alloc(6);
  // 写入ICO文件保留字段，必须为0
  header.writeUInt16LE(0, 0);
  // 写入图像类型，1表示图标
  header.writeUInt16LE(1, 2);
  // 写入图像数量，等于entries数组的长度
  header.writeUInt16LE(entries.length, 4);

  const dirs = []; // 存储图标目录项
  const datas = []; // 存储图标数据
  // 计算数据部分的起始偏移量
  let offset = 6 + entries.length * 16;
  // 遍历每个图标条目
  entries.forEach((e) => {
    // 创建图标目录项，每个目录项16字节
    const dir = Buffer.alloc(16);
    // 设置图标宽度，如果大于等于256则设为0
    dir[0] = e.size >= 256 ? 0 : e.size;
    // 设置图标高度，如果大于等于256则设为0
    dir[1] = e.size >= 256 ? 0 : e.size;
    // 设置颜色数，0表示使用默认颜色数
    dir[4] = 1;
    // 设置保留字段，必须为0
    dir[6] = 32;
    // 写入PNG数据长度
    dir.writeUInt32LE(e.png.length, 8);
    // 写入PNG数据在文件中的偏移量
    dir.writeUInt32LE(offset, 12);
    // 更新下一个数据的偏移量
    offset += e.png.length;
    // 将目录项添加到dirs数组
    dirs.push(dir);
    // 将PNG数据添加到datas数组
    datas.push(e.png);
  });
  // 合并header、dirs和datas，返回完整的ICO文件Buffer
  return Buffer.concat([header, ...dirs, ...datas]);
}

const outDir = path.join(__dirname, '..', 'src', 'assets', 'images');
[16, 32].forEach((s) => {
  const file = `tray-${s}.png`;
  fs.writeFileSync(path.join(outDir, file), makePng(s, draw(s)));
  console.log('written', file);
});
const sizes = [16, 32, 48, 256];
fs.writeFileSync(
  path.join(outDir, 'app.ico'), 
  makeIco(sizes.map((s) => ({ size: s, png: makePng(s, draw(s)) })))
);
console.log('written app.ico'); 
