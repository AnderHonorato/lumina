#!/usr/bin/env node
/** Regenera os assets oficiais do ícone Lumina a partir do desenho autoral. */
const { spawnSync } = require('child_process');
const path = require('path');
const script = path.join(__dirname, 'generate-icon-assets.py');
const result = spawnSync('python3', [script], { stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
