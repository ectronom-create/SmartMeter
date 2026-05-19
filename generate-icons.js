// Script to generate PWA icons as PNG files in /public
// Run: node generate-icons.js
import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#1a7f37');
  grad.addColorStop(1, '#0550ae');
  ctx.fillStyle = grad;

  const r = size * 0.18;
  ctx.beginPath();
  ctx.moveTo(r, 0); ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'white';
  ctx.font = `bold ${size * 0.52}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚡', size / 2, size / 2 + size * 0.03);

  return canvas.toBuffer('image/png');
}

[192, 512].forEach(size => {
  const buf = generateIcon(size);
  const outPath = path.join(__dirname, 'public', `icon-${size}.png`);
  writeFileSync(outPath, buf);
  console.log(`✓ Created icon-${size}.png`);
});
