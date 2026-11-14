#!/usr/bin/env node
/* 语法检查：对 js/、desktop/、tools/ 下所有 .js 跑 node --check（跨平台，替代 shell 循环） */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const dirs = ['js', 'desktop', 'tools'];
let fail = 0;
let total = 0;

for (const d of dirs) {
  const abs = path.join(ROOT, d);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs).sort()) {
    if (!f.endsWith('.js')) continue;
    const file = path.join(abs, f);
    total++;
    try {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    } catch (e) {
      fail++;
      console.error(`✗ ${d}/${f}`);
      console.error(String(e.stderr || e.message));
    }
  }
}

console.log(`node --check: ${total - fail}/${total} 通过`);
process.exit(fail ? 1 : 0);
