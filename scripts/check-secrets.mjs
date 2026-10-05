import { execFileSync } from 'node:child_process';

const revisions = execFileSync('git', ['rev-list', '--all'], {
  encoding: 'utf8',
}).trim().split(/\r?\n/).filter(Boolean);

const findings = [];

function gitGrep(revision, pattern) {
  try {
    return execFileSync(
      'git',
      ['grep', '-l', '-I', '-E', '-e', pattern, revision, '--', '.', ':(exclude)pnpm-lock.yaml'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim().split(/\r?\n/).filter(Boolean).map((match) =>
      match.startsWith(`${revision}:`) ? match.slice(revision.length + 1) : match,
    );
  } catch (error) {
    if (error.status === 1) return [];
    throw error;
  }
}

for (const revision of revisions) {
  const shortRevision = revision.slice(0, 12);

  for (const file of gitGrep(
    revision,
    'eyJ[A-Za-z0-9_-]+\\.eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+',
  )) {
    findings.push(`${shortRevision}: JWT-shaped value in ${file}`);
  }

  for (const file of gitGrep(
    revision,
    'process\\.env\\.JWT_SECRET[[:space:]]*(\\|\\||\\?\\?)',
  )) {
    findings.push(`${shortRevision}: JWT_SECRET fallback in ${file}`);
  }

  for (const file of gitGrep(revision, '-----BEGIN [A-Z ]*PRIVATE KEY-----')) {
    findings.push(`${shortRevision}: private key in ${file}`);
  }

  const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', revision], {
    encoding: 'utf8',
  }).trim().split(/\r?\n/).filter(Boolean);

  for (const file of paths) {
    if (/(^|\/)(cookies?\.txt|cookies?\.[^/]+|[^/]+\.cookies?)$/i.test(file)) {
      findings.push(`${shortRevision}: cookie artifact ${file}`);
    }
  }
}

if (findings.length > 0) {
  console.error('Secret hygiene check failed:');
  for (const finding of [...new Set(findings)]) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Secret hygiene check passed across ${revisions.length} reachable commits.`);
