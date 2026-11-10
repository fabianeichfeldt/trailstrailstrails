// Umami credentials for the report CLIs: env → macOS keychain → `gh variable get UMAMI_WEBSITE_ID`.
import { execFileSync } from 'node:child_process';

export const KEYCHAIN_HELP = 'Add credentials with: security add-generic-password -s trailradar-umami -a <username> -w   (or set UMAMI_USERNAME / UMAMI_PASSWORD / UMAMI_WEBSITE_ID)';

const run = (cmd, args) => {
  try { return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; }
};

function keychainUsername() {
  const out = run('security', ['find-generic-password', '-s', 'trailradar-umami']);
  return /"acct"<blob>="([^"]*)"/.exec(out)?.[1] ?? '';
}

export function resolveCredentials() {
  const username = process.env.UMAMI_USERNAME || keychainUsername();
  const password = process.env.UMAMI_PASSWORD || (username && run('security', ['find-generic-password', '-s', 'trailradar-umami', '-a', username, '-w']));
  // `security add-generic-password ... -w` without a TTY (e.g. Claude Code's `!`) stores an empty password.
  if (username && !password && !process.env.UMAMI_PASSWORD && keychainUsername()) {
    throw new Error('Keychain item "trailradar-umami" has an empty password. Re-add it in a normal Terminal window: security add-generic-password -U -s trailradar-umami -a ' + username + ' -w');
  }
  const websiteId = process.env.UMAMI_WEBSITE_ID || run('gh', ['variable', 'get', 'UMAMI_WEBSITE_ID']);
  const missing = [!username && 'UMAMI_USERNAME', !password && 'UMAMI_PASSWORD', !websiteId && 'UMAMI_WEBSITE_ID'].filter(Boolean);
  if (missing.length) throw new Error(`Missing ${missing.join(', ')}. ${KEYCHAIN_HELP}`);
  return { username, password, websiteId };
}
