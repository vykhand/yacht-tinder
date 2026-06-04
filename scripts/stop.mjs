/**
 * Cross-platform "stop the app" — kills whatever is listening on the port.
 * Works on Windows, macOS and Linux with no dependencies.
 *
 *   npm run stop            # frees port 3000
 *   npm run stop 4000       # frees port 4000
 */
import { execSync } from 'node:child_process';

const port = process.argv[2] || process.env.PORT || '3000';
const isWin = process.platform === 'win32';

function findPids() {
  try {
    if (isWin) {
      const out = execSync('netstat -ano -p tcp', { encoding: 'utf8' });
      const re = new RegExp(`:${port}\\b`);
      return [
        ...new Set(
          out
            .split(/\r?\n/)
            .filter((l) => re.test(l) && /LISTENING/i.test(l))
            .map((l) => l.trim().split(/\s+/).pop())
            .filter((pid) => pid && pid !== '0'),
        ),
      ];
    }
    // macOS / Linux
    const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: 'utf8' });
    return [...new Set(out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean))];
  } catch {
    return []; // no match (or tool returned non-zero) → nothing to kill
  }
}

const pids = findPids();
if (pids.length === 0) {
  console.log(`✓ Nothing is listening on port ${port} — already stopped.`);
  process.exit(0);
}

for (const pid of pids) {
  try {
    if (isWin) execSync(`taskkill /PID ${pid} /T /F`);
    else process.kill(Number(pid), 'SIGTERM');
    console.log(`✓ Stopped process ${pid} (port ${port}).`);
  } catch (e) {
    console.warn(`! Could not stop ${pid}: ${e instanceof Error ? e.message : e}`);
  }
}
