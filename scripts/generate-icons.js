#!/usr/bin/env node
/**
 * Gera o ícone do aplicativo Lumina Notes
 * Cria icon.png e tenta criar icon.ico
 */

const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '../src/renderer/assets');
if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

// SVG do ícone
const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="256" height="256" rx="48" fill="#0f0f13"/>
  <circle cx="128" cy="128" r="96" stroke="#6C63FF" stroke-width="6" fill="none"/>
  <circle cx="128" cy="128" r="80" fill="#6C63FF" fill-opacity="0.08"/>
  <path d="M72 128 Q128 52 184 128 Q128 204 72 128Z" fill="#6C63FF" fill-opacity="0.85"/>
  <circle cx="128" cy="128" r="24" fill="#6C63FF"/>
  <circle cx="128" cy="128" r="12" fill="white" fill-opacity="0.9"/>
</svg>`;

const svgPath = path.join(ASSETS_DIR, 'icon.svg');
fs.writeFileSync(svgPath, svgContent);
console.log('✅ icon.svg criado');

// Criar um PNG simples usando Buffer (sem canvas nativo)
// Usamos um PNG mínimo válido de 256x256 gerado via pure JS
function createSimplePNG() {
  const { createCanvas } = (() => {
    try { return require('canvas'); } 
    catch { return null; }
  })() || {};

  if (createCanvas) {
    const canvas = createCanvas(256, 256);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#0f0f13';
    roundRect(ctx, 0, 0, 256, 256, 48);
    ctx.fill();

    // Outer circle
    ctx.strokeStyle = '#6C63FF';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(128, 128, 96, 0, Math.PI * 2);
    ctx.stroke();

    // Glow circle
    ctx.fillStyle = 'rgba(108, 99, 255, 0.08)';
    ctx.beginPath();
    ctx.arc(128, 128, 80, 0, Math.PI * 2);
    ctx.fill();

    // Leaf/eye shape
    ctx.fillStyle = 'rgba(108, 99, 255, 0.85)';
    ctx.beginPath();
    ctx.moveTo(72, 128);
    ctx.quadraticCurveTo(128, 52, 184, 128);
    ctx.quadraticCurveTo(128, 204, 72, 128);
    ctx.fill();

    // Center dot
    ctx.fillStyle = '#6C63FF';
    ctx.beginPath();
    ctx.arc(128, 128, 24, 0, Math.PI * 2);
    ctx.fill();

    // Inner dot
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(128, 128, 12, 0, Math.PI * 2);
    ctx.fill();

    const pngBuffer = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(ASSETS_DIR, 'icon.png'), pngBuffer);
    console.log('✅ icon.png criado com canvas');
    return true;
  }
  return false;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Fallback: copiar um PNG mínimo válido (1x1 transparente escalado)
// PNG 256x256 roxo sólido como fallback
function createFallbackPNG() {
  // PNG válido de 16x16 roxo - será usado como placeholder
  const png16 = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR length + type
    0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x10, // 16x16
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x91, 0x68, // bit depth, color, etc
    0x36, 0x00, 0x00, 0x00, 0x4B, 0x49, 0x44, 0x41, // IDAT
    0x54, 0x78, 0x9C, 0x62, 0x6C, 0x60, 0xF8, 0xFF, // IDAT data start
    0xFF, 0x3F, 0x03, 0x30, 0xC0, 0xFF, 0xFF, 0xFF,
    0x3F, 0x03, 0x18, 0x18, 0x18, 0xC0, 0x00, 0x00,
    0x00, 0x00, 0xFF, 0xFF, 0xFF, 0x3F, 0x03, 0x18,
    0x18, 0x18, 0xC0, 0x00, 0x00, 0x00, 0x00, 0xFF,
    0xFF, 0xFF, 0x3F, 0x03, 0x18, 0x18, 0x18, 0xC0,
    0x00, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0x3F,
    0x00, 0x00, 0x86, 0xD5, 0x16, 0xB6, 0x00, 0x00,
    0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42,
    0x60, 0x82
  ]);

  fs.writeFileSync(path.join(ASSETS_DIR, 'icon.png'), png16);
  console.log('⚠️  icon.png criado (placeholder - instale canvas para PNG real)');
}

if (!createSimplePNG()) {
  createFallbackPNG();
}

// Criar .ico placeholder (cópia do PNG com extensão .ico - electron aceita PNG como ícone no dev)
const pngData = fs.readFileSync(path.join(ASSETS_DIR, 'icon.png'));
fs.writeFileSync(path.join(ASSETS_DIR, 'icon.ico'), pngData);
console.log('✅ icon.ico criado');

console.log('\n📁 Assets em:', ASSETS_DIR);
console.log('🎉 Ícones gerados com sucesso!\n');
