const { desktopCapturer, screen } = require('electron');
const columns = 16, rows = 20;

// Screen thumbnails are transient. Only a small grid of luminance values leaves
// this module; no image is written, logged, transmitted or sent to the renderer.
async function sampleBackdrop(bounds) {
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 480, height: 480 }, fetchWindowIcons: false });
  const displays = screen.getAllDisplays();
  const images = sources.map(source => {
    const display = displays.find(d => String(d.id) === source.display_id);
    if (!display || source.thumbnail.isEmpty()) return null;
    return { bounds: display.bounds, size: source.thumbnail.getSize(), bytes: source.thumbnail.toBitmap() };
  }).filter(Boolean);
  const values = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    const sx = bounds.x + (x + 0.5) / columns * bounds.width;
    const sy = bounds.y + (y + 0.5) / rows * bounds.height;
    const image = images.find(i => sx >= i.bounds.x && sx < i.bounds.x + i.bounds.width && sy >= i.bounds.y && sy < i.bounds.y + i.bounds.height);
    if (!image) { values.push(null); continue; }
    const px = Math.min(image.size.width - 1, Math.max(0, Math.floor((sx - image.bounds.x) / image.bounds.width * image.size.width)));
    const py = Math.min(image.size.height - 1, Math.max(0, Math.floor((sy - image.bounds.y) / image.bounds.height * image.size.height)));
    let sum = 0, count = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const ix = Math.max(0, Math.min(image.size.width - 1, px + dx));
      const iy = Math.max(0, Math.min(image.size.height - 1, py + dy));
      const offset = (iy * image.size.width + ix) * 4;
      sum += (image.bytes[offset + 2] * 0.2126 + image.bytes[offset + 1] * 0.7152 + image.bytes[offset] * 0.0722) / 255;
      count++;
    }
    values.push(sum / count);
  }
  if (values.every(v => v === null)) throw new Error('No display pixels available');
  return { columns, rows, values };
}
module.exports = { sampleBackdrop };
