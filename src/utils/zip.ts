export type ZipEntryInput = {
  name: string;
  data: Uint8Array;
  date?: Date;
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let crc = i;
    for (let j = 0; j < 8; j += 1) {
      crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[i] = crc >>> 0;
  }
  return table;
})();

const crc32 = (data: Uint8Array) => {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const toDosDateTime = (value?: Date) => {
  const date = value ?? new Date();
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);
  const dosTime = ((hours & 0x1f) << 11) | ((minutes & 0x3f) << 5) | (seconds & 0x1f);
  const dosDate = (((year - 1980) & 0x7f) << 9) | ((month & 0x0f) << 5) | (day & 0x1f);
  return { dosTime, dosDate };
};

const writeU16 = (view: DataView, offset: number, value: number) => {
  view.setUint16(offset, value & 0xffff, true);
};

const writeU32 = (view: DataView, offset: number, value: number) => {
  view.setUint32(offset, value >>> 0, true);
};

const createLocalHeader = (opts: {
  fileNameLength: number;
  crc: number;
  size: number;
  dosTime: number;
  dosDate: number;
}) => {
  const buffer = new ArrayBuffer(30);
  const view = new DataView(buffer);
  writeU32(view, 0, 0x04034b50);
  writeU16(view, 4, 20);
  writeU16(view, 6, 0x0800);
  writeU16(view, 8, 0);
  writeU16(view, 10, opts.dosTime);
  writeU16(view, 12, opts.dosDate);
  writeU32(view, 14, opts.crc);
  writeU32(view, 18, opts.size);
  writeU32(view, 22, opts.size);
  writeU16(view, 26, opts.fileNameLength);
  writeU16(view, 28, 0);
  return new Uint8Array(buffer);
};

const createCentralHeader = (opts: {
  fileNameLength: number;
  crc: number;
  size: number;
  dosTime: number;
  dosDate: number;
  localHeaderOffset: number;
}) => {
  const buffer = new ArrayBuffer(46);
  const view = new DataView(buffer);
  writeU32(view, 0, 0x02014b50);
  writeU16(view, 4, 20);
  writeU16(view, 6, 20);
  writeU16(view, 8, 0x0800);
  writeU16(view, 10, 0);
  writeU16(view, 12, opts.dosTime);
  writeU16(view, 14, opts.dosDate);
  writeU32(view, 16, opts.crc);
  writeU32(view, 20, opts.size);
  writeU32(view, 24, opts.size);
  writeU16(view, 28, opts.fileNameLength);
  writeU16(view, 30, 0);
  writeU16(view, 32, 0);
  writeU16(view, 34, 0);
  writeU16(view, 36, 0);
  writeU32(view, 38, 0);
  writeU32(view, 42, opts.localHeaderOffset);
  return new Uint8Array(buffer);
};

const createEndOfCentralDirectory = (opts: {
  entryCount: number;
  centralSize: number;
  centralOffset: number;
}) => {
  const buffer = new ArrayBuffer(22);
  const view = new DataView(buffer);
  writeU32(view, 0, 0x06054b50);
  writeU16(view, 4, 0);
  writeU16(view, 6, 0);
  writeU16(view, 8, opts.entryCount);
  writeU16(view, 10, opts.entryCount);
  writeU32(view, 12, opts.centralSize);
  writeU32(view, 16, opts.centralOffset);
  writeU16(view, 20, 0);
  return new Uint8Array(buffer);
};

export function createZipBlob(entries: ZipEntryInput[]) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;
  let centralSize = 0;

  entries.forEach((entry) => {
    const name = String(entry.name || "").replace(/\\/g, "/").replace(/^\/+/, "");
    const nameBytes = encoder.encode(name);
    const data = entry.data;
    const { dosTime, dosDate } = toDosDateTime(entry.date);
    const crc = crc32(data);
    const size = data.length;

    const localHeader = createLocalHeader({
      fileNameLength: nameBytes.length,
      crc,
      size,
      dosTime,
      dosDate,
    });
    localParts.push(localHeader, nameBytes, data);

    const centralHeader = createCentralHeader({
      fileNameLength: nameBytes.length,
      crc,
      size,
      dosTime,
      dosDate,
      localHeaderOffset: localOffset,
    });
    centralParts.push(centralHeader, nameBytes);
    centralSize += centralHeader.length + nameBytes.length;

    localOffset += localHeader.length + nameBytes.length + size;
  });

  const end = createEndOfCentralDirectory({
    entryCount: entries.length,
    centralSize,
    centralOffset: localOffset,
  });

  const toArrayBuffer = (value: Uint8Array) => {
    const out = new Uint8Array(value.byteLength);
    out.set(value);
    return out.buffer;
  };

  const parts = [...localParts, ...centralParts, end].map(toArrayBuffer);
  return new Blob(parts, { type: "application/zip" });
}
