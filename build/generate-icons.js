const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const BUILD_DIR = __dirname;

async function generateIcons() {
  // 1. icon.svg -> icon.png (256x256)
  console.log('Generating icon.png (256x256)...');
  const svgBuffer = fs.readFileSync(path.join(BUILD_DIR, 'icon.svg'));
  await sharp(svgBuffer, { density: 150 })
    .resize(256, 256)
    .png()
    .toFile(path.join(BUILD_DIR, 'icon.png'));
  console.log('  -> icon.png created');

  // 2. tray-icon.svg -> tray-icon.png (32x32)
  console.log('Generating tray-icon.png (32x32)...');
  const traySvgBuffer = fs.readFileSync(path.join(BUILD_DIR, 'tray-icon.svg'));
  await sharp(traySvgBuffer, { density: 150 })
    .resize(32, 32)
    .png()
    .toFile(path.join(BUILD_DIR, 'tray-icon.png'));
  console.log('  -> tray-icon.png created');

  // 3. Generate ICO file (contains 16x16, 32x32, 48x48, 256x256)
  console.log('Generating icon.ico...');
  const sizes = [16, 32, 48, 256];
  const pngBuffers = [];

  for (const size of sizes) {
    const buf = await sharp(svgBuffer, { density: 150 })
      .resize(size, size)
      .png()
      .toBuffer();
    pngBuffers.push({ size, buffer: buf });
  }

  const icoBuffer = createIco(pngBuffers);
  fs.writeFileSync(path.join(BUILD_DIR, 'icon.ico'), icoBuffer);
  console.log('  -> icon.ico created');

  console.log('\nAll icons generated successfully!');
}

// Create ICO file from PNG buffers
// ICO format: https://en.wikipedia.org/wiki/ICO_(file_format)
function createIco(images) {
  const headerSize = 6;
  const dirEntrySize = 16;
  const numImages = images.length;

  // Calculate total size
  let dataOffset = headerSize + (dirEntrySize * numImages);
  const entries = [];

  for (const img of images) {
    entries.push({
      size: img.size,
      buffer: img.buffer,
      offset: dataOffset,
    });
    dataOffset += img.buffer.length;
  }

  const totalSize = dataOffset;
  const result = Buffer.alloc(totalSize);

  // ICO Header
  result.writeUInt16LE(0, 0);       // Reserved
  result.writeUInt16LE(1, 2);       // Type: 1 = ICO
  result.writeUInt16LE(numImages, 4); // Number of images

  // Directory entries
  let offset = headerSize;
  for (const entry of entries) {
    const w = entry.size >= 256 ? 0 : entry.size;
    const h = entry.size >= 256 ? 0 : entry.size;

    result.writeUInt8(w, offset);          // Width (0 = 256)
    result.writeUInt8(h, offset + 1);      // Height (0 = 256)
    result.writeUInt8(0, offset + 2);      // Color palette
    result.writeUInt8(0, offset + 3);      // Reserved
    result.writeUInt16LE(1, offset + 4);   // Color planes
    result.writeUInt16LE(32, offset + 6);  // Bits per pixel
    result.writeUInt32LE(entry.buffer.length, offset + 8);  // Image data size
    result.writeUInt32LE(entry.offset, offset + 12);        // Offset to image data
    offset += dirEntrySize;
  }

  // Image data (PNG format embedded)
  for (const entry of entries) {
    entry.buffer.copy(result, entry.offset);
  }

  return result;
}

generateIcons().catch(console.error);
