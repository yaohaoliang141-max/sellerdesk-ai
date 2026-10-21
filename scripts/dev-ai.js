import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('正在同时启动 SellerDesk AI 本地服务与前端开发环境...\n');

// 1. Start AI Proxy Server
const serverProcess = spawn('node', ['server/index.js'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true,
});

// 2. Start Vite Dev Server
const viteProcess = spawn('npx', ['vite'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true,
});

function cleanup() {
  console.log('\n正在停止服务...');
  try {
    serverProcess.kill();
  } catch {}
  try {
    viteProcess.kill();
  } catch {}
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
