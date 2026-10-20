import { execSync } from 'child_process';
import { rmSync, existsSync } from 'fs';
import { join } from 'path';

function run(command, cwd) {
  console.log(`> ${command}`);
  execSync(command, { stdio: 'inherit', cwd });
}

const rootDir = process.cwd();
const distDir = join(rootDir, 'dist');

try {
  console.log('1. 正在运行测试与类型构建检查...');
  run('npm test', rootDir);
  run('npm run build', rootDir);

  console.log('2. 准备发布到 GitHub Pages (gh-pages 分支)...');
  const gitInDist = join(distDir, '.git');
  if (existsSync(gitInDist)) {
    rmSync(gitInDist, { recursive: true, force: true });
  }

  run('git init', distDir);
  run('git branch -M gh-pages', distDir);
  run('git add -A', distDir);
  run('git commit -m "deploy: update SellerDesk AI website"', distDir);
  run('git remote add origin https://github.com/yaohaoliang141-max/sellerdesk-ai.git', distDir);
  run('git push -f origin gh-pages', distDir);

  // Clean up .git in dist
  rmSync(gitInDist, { recursive: true, force: true });

  console.log('\n✅ 部署发布完成！');
  console.log('网站访问地址: https://yaohaoliang141-max.github.io/sellerdesk-ai/');
} catch (error) {
  console.error('\n❌ 部署失败:', error.message);
  process.exit(1);
}
