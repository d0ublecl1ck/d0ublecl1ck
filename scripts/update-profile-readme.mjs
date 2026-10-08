import { readFile, writeFile } from 'node:fs/promises';

const USER = 'd0ublecl1ck';
const TOKEN = process.env.GITHUB_TOKEN;
const README = 'README.md';

const headers = {
  accept: 'application/vnd.github+json',
  'user-agent': 'profile-readme-updater',
  ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
};

async function api(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

const day = (iso) => String(iso).slice(0, 10);

function replaceBlock(md, marker, lines) {
  const re = new RegExp(`(<!-- ${marker} starts -->)[\\s\\S]*?(<!-- ${marker} ends -->)`);
  if (!re.test(md)) throw new Error(`marker not found: ${marker}`);
  return md.replace(re, `$1\n${lines}\n$2`);
}

const repos = (await api(`/users/${USER}/repos?per_page=100&sort=pushed`))
  .filter((r) => !r.fork && !r.archived && r.name !== USER);

// 更新栏：最近有推送的仓库（pushed_at）
const byPushed = [...repos].sort((a, b) => String(b.pushed_at).localeCompare(String(a.pushed_at)));
const recentLines = byPushed.slice(0, 6)
  .map((r) => '• [' + r.name + '](' + r.html_url + ') — ' + day(r.pushed_at))
  .join('<br>');

// 创建栏：最近新建的仓库（created_at，与 release 无关）
const byCreated = [...repos].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
const createdLines = byCreated.length
  ? byCreated.slice(0, 6)
      .map((r) => '• [' + r.name + '](' + r.html_url + ') — ' + day(r.created_at))
      .join('<br>')
  : '• 暂无新建';

let md = await readFile(README, 'utf8');
md = replaceBlock(md, 'recent_releases', createdLines);
md = replaceBlock(md, 'recent_updates', recentLines);
await writeFile(README, md);
console.log('README updated: ' + Math.min(6, byCreated.length) + ' created, ' + Math.min(6, byPushed.length) + ' updated');
