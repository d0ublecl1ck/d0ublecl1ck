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

const recentLines = repos.slice(0, 6)
  .map((r) => `• [${r.name}](${r.html_url}) — ${day(r.pushed_at)}`)
  .join('<br>');

const releases = [];
for (const r of repos.slice(0, 20)) {
  try {
    const rel = await api(`/repos/${USER}/${r.name}/releases/latest`);
    if (rel?.tag_name) {
      releases.push({ repo: r.name, tag: rel.tag_name, at: rel.published_at });
    }
  } catch {
    // repo without releases -> 404, skip
  }
}
releases.sort((a, b) => String(b.at).localeCompare(String(a.at)));

const releaseLines = releases.length
  ? releases.slice(0, 6)
      .map((x) => `• [${x.repo} ${x.tag}](https://github.com/${USER}/${x.repo}/releases/tag/${x.tag}) — ${day(x.at)}`)
      .join('<br>')
  : '• 暂无发布';

let md = await readFile(README, 'utf8');
md = replaceBlock(md, 'recent_releases', releaseLines);
md = replaceBlock(md, 'recent_updates', recentLines);
await writeFile(README, md);
console.log('README updated: ' + releases.length + ' releases, ' + Math.min(6, repos.length) + ' recent repos');

