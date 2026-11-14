#!/usr/bin/env node
/* 版本号一致性工具
 * 用法：
 *   node tools/set-version.js 2.3.0     把代码文件的版本号同步为 2.3.0
 *   node tools/set-version.js --check   仅校验是否一致（CI 使用）
 *
 * 自动同步：manifest.json / package.json / package-lock.json（仅根与 packages[""] 两处，
 * 不碰依赖自己的版本号）/ newtab.html 的 meta[app-version]。
 * 文档（README 等）里的版本叙述由人工维护，脚本只列出旧版本提及处供核对。
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(ROOT, p), s, 'utf8');
const SEMVER = /^\d+\.\d+\.\d+$/;

function collect() {
  const map = {};
  map['manifest.json'] = JSON.parse(read('manifest.json')).version || '';
  map['package.json'] = JSON.parse(read('package.json')).version || '';
  const lock = JSON.parse(read('package-lock.json'));
  map['package-lock.json (root)'] = lock.version || '';
  map['package-lock.json ("")'] = (lock.packages && lock.packages[''] && lock.packages[''].version) || '';
  const m = read('newtab.html').match(/<meta name="app-version" content="([^"]+)"/);
  map['newtab.html (meta)'] = m ? m[1] : '';
  return map;
}

function main() {
  const arg = process.argv[2];
  if (!arg || arg === '--check') {
    const vals = collect();
    for (const [k, v] of Object.entries(vals)) console.log(`  ${k.padEnd(26)} ${v || '(缺失)'}`);
    const uniq = [...new Set(Object.values(vals))];
    if (uniq.length !== 1 || !SEMVER.test(uniq[0])) {
      console.error('版本不一致或缺失，请运行：node tools/set-version.js x.y.z');
      process.exit(1);
    }
    console.log('版本一致：v' + uniq[0]);
    return;
  }
  if (!SEMVER.test(arg)) { console.error('版本号格式应为 x.y.z：' + arg); process.exit(1); }

  const from = JSON.parse(read('manifest.json')).version;
  if (arg === from) { console.log('目标与当前一致，无需修改：v' + from); return; }

  const man = JSON.parse(read('manifest.json'));
  man.version = arg;
  write('manifest.json', JSON.stringify(man, null, 2) + '\n');

  const pkg = JSON.parse(read('package.json'));
  pkg.version = arg;
  write('package.json', JSON.stringify(pkg, null, 2) + '\n');

  const lock = JSON.parse(read('package-lock.json'));
  lock.version = arg;
  if (lock.packages && lock.packages['']) lock.packages[''].version = arg;
  write('package-lock.json', JSON.stringify(lock, null, 2) + '\n');

  write('newtab.html', read('newtab.html').replace(
    /(<meta name="app-version" content=")[^"]+(")/, `$1${arg}$2`));

  console.log(`已同步 v${from} → v${arg}：manifest / package / package-lock / newtab.html`);
  for (const doc of ['README.md', '安装说明.md', '桌面版说明.md', '网页版说明.txt']) {
    if (!fs.existsSync(path.join(ROOT, doc))) continue;
    const hits = (read(doc).match(new RegExp(from.replace(/\./g, '\\.'), 'g')) || []).length;
    if (hits) console.log(`  注意：${doc} 中还有 ${hits} 处写着 ${from}，发布叙述请人工核对`);
  }
  console.log('下一步：node tools/pack-dist.js 重新生成交付包');
}

main();
