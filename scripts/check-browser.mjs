import process from 'node:process';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'node:net';

const port = process.env.PLAYWRIGHT_PORT ?? '3015';
const probe = createServer();
await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(Number(port), '127.0.0.1', resolve); });
await new Promise(resolve => probe.close(resolve));
const env = { ...process.env, APP_MODE: 'demo', AI_MODE: 'mock', OCR_MODE: 'mock', PLAYWRIGHT_PORT: port, SAFETY_E2E_EXTERNAL_SERVER: '1', SAFETY_ENABLE_TEST_FIXTURES: '1', SAFETY_TEST_TOKEN: randomBytes(32).toString('hex') };
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', port], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let serverOutput = '';
server.stdout.on('data', value => { serverOutput += String(value); });
server.stderr.on('data', value => { serverOutput += String(value); });
let spawnError;
server.on('error', error => { spawnError = error; });
try {
  for (let attempt = 0; attempt < 240 && !serverOutput.includes('Ready in'); attempt++) {
    if (spawnError) throw spawnError;
    if (server.exitCode !== null) throw new Error(serverOutput);
    await delay(250);
  }
  if (!serverOutput.includes('Ready in')) throw new Error('Test server did not start.');
  process.stdout.write(`Isolated browser checks on 127.0.0.1:${port}\n`);
  const runner = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)], { env, windowsHide: true, stdio: 'inherit' });
  process.exitCode = await new Promise((resolve, reject) => { runner.once('error', reject); runner.once('exit', code => resolve(code ?? 1)); });
} finally {
  if (server.exitCode === null && server.pid) {
    const exited = new Promise(resolve => server.once('exit', resolve));
    server.kill();
    await exited;
  }
}
