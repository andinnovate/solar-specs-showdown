const { execSync } = require('child_process');
const { existsSync, renameSync } = require('fs');
const { join } = require('path');

const cwd = process.cwd();
const bunLocks = [
  { from: join(cwd, 'bun.lockb'), to: join(cwd, 'bun.lockb.bak') },
  { from: join(cwd, 'bun.lock'), to: join(cwd, 'bun.lock.bak') },
];

const moved = [];

try {
  for (const lock of bunLocks) {
    if (existsSync(lock.from)) {
      if (existsSync(lock.to)) {
        throw new Error(`Refusing to overwrite existing backup: ${lock.to}`);
      }
      renameSync(lock.from, lock.to);
      moved.push(lock);
    }
  }

  execSync('npx update-browserslist-db@latest', {
    stdio: 'inherit',
    env: {
      ...process.env,
      BROWSERSLIST_FORCE_PACKAGE_MANAGER: 'npm',
    },
  });
} finally {
  for (const lock of moved.reverse()) {
    if (existsSync(lock.to)) {
      renameSync(lock.to, lock.from);
    }
  }
}
