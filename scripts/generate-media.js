import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { execSync } from 'child_process';
import { renderVideoCoverWithBadge } from './make-cover.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const mediaDir = path.join(rootDir, 'docs', 'media');
const tempDir = path.join(rootDir, '.temp_media');

// Ensure directories exist
if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

function run(command) {
  console.log(`> ${command}`);
  execSync(command, { stdio: 'inherit' });
}

// Simple static HTTP server for dist/
function startStaticServer(port = 5199) {
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
  };

  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/' || !path.extname(reqPath)) {
      reqPath = '/index.html';
    }
    const fullPath = path.join(distDir, reqPath);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const ext = path.extname(fullPath);
      res.writeHead(200, {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(fs.readFileSync(fullPath));
    } else {
      const indexHtml = path.join(distDir, 'index.html');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(indexHtml));
    }
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      console.log(`Static server running at http://127.0.0.1:${port}`);
      resolve(server);
    });
  });
}

async function smoothMoveAndClick(page, selector, delayAfter = 400) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: 'visible', timeout: 5000 });
  const box = await el.boundingBox();
  if (box) {
    const targetX = box.x + box.width / 2;
    const targetY = box.y + box.height / 2;
    await page.mouse.move(targetX, targetY, { steps: 8 });
  }
  await el.click();
  if (delayAfter > 0) await page.waitForTimeout(delayAfter);
}

async function smoothType(page, selector, text, delay = 35) {
  const el = page.locator(selector).first();
  await el.click();
  await page.waitForTimeout(100);
  await el.fill('');
  await el.pressSequentially(text, { delay });
  await page.waitForTimeout(150);
}

async function main() {
  console.log('=== SellerDesk AI 媒体资源生成程序 ===\n');

  // Verify build
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    console.log('正在构建前端资源...');
    run('npm run build');
  }

  const server = await startStaticServer(5199);
  const baseUrl = 'http://127.0.0.1:5199';

  const browser = await chromium.launch({
    headless: true,
  });

  try {
    // ----------------------------------------------------
    // Step A: 制作 5 张高清真实产品截图
    // ----------------------------------------------------
    console.log('\n--- 1. 生成 5 张高清产品截图 ---');
    {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
      });
      const page = await context.newPage();
      await page.goto(baseUrl);
      await page.waitForTimeout(1000);

      // 1. overview.png
      console.log('截取: overview.png (首页仪表盘)');
      await page.screenshot({
        path: path.join(mediaDir, 'overview.png'),
        fullPage: false,
      });

      // 2. orders.png
      console.log('截取: orders.png (销售与采购协同订单)');
      await smoothMoveAndClick(page, 'button:has-text("订单管理")', 600);
      await page.screenshot({
        path: path.join(mediaDir, 'orders.png'),
        fullPage: false,
      });

      // 3. inbox.png (AI 客服工作台与人工审核)
      console.log('截取: inbox.png (AI 客服工作台与人工审核)');
      await smoothMoveAndClick(page, 'button:has-text("AI 客服")', 600);
      const queryBtn = page.locator('button:has-text("什么时候发货？")').first();
      if (await queryBtn.count() > 0) {
        await queryBtn.click();
        await page.waitForTimeout(800);
      }
      await page.screenshot({
        path: path.join(mediaDir, 'inbox.png'),
        fullPage: false,
      });

      // 4. knowledge.png
      console.log('截取: knowledge.png (商品规格与知识库政策)');
      await smoothMoveAndClick(page, 'button:has-text("商品知识库")', 600);
      await page.screenshot({
        path: path.join(mediaDir, 'knowledge.png'),
        fullPage: false,
      });

      await context.close();
    }

    // 5. mobile.png (iPhone 14: 390x844)
    {
      console.log('截取: mobile.png (移动端适配)');
      const mobileContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
      });
      const page = await mobileContext.newPage();
      await page.goto(baseUrl);
      await page.waitForTimeout(800);
      await page.screenshot({
        path: path.join(mediaDir, 'mobile.png'),
        fullPage: false,
      });
      await mobileContext.close();
    }

    // ----------------------------------------------------
    // Step B: 录制 12-14 秒核心业务流程并生成 demo.gif
    // ----------------------------------------------------
    console.log('\n--- 2. 录制核心协同流程 GIF (创建订单 → 关联采购 → 客服研判 → 审核保存) ---');
    const gifVideoDir = path.join(tempDir, 'gif_record');
    if (!fs.existsSync(gifVideoDir)) fs.mkdirSync(gifVideoDir, { recursive: true });

    {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        recordVideo: {
          dir: gifVideoDir,
          size: { width: 1440, height: 900 },
        },
      });
      const page = await context.newPage();
      await page.goto(baseUrl);
      await page.waitForTimeout(600);

      // 1. Click Orders
      await smoothMoveAndClick(page, 'button:has-text("订单管理")', 600);

      // 2. Click 创建新测试订单
      await smoothMoveAndClick(page, 'button:has-text("创建新测试订单")', 600);

      // 3. Fill customer name
      await smoothType(page, 'input[placeholder*="周杰"]', '周小雅', 30);
      await page.waitForTimeout(300);

      // 4. Submit order (立即创建)
      await smoothMoveAndClick(page, 'button[type="submit"]:has-text("立即创建")', 800);

      // 5. Click 前往客服 on the first order
      const goToInboxBtn = page.locator('button[title*="前往客服"]').first();
      await goToInboxBtn.waitFor({ state: 'visible', timeout: 5000 });
      await smoothMoveAndClick(page, 'button[title*="前往客服"]', 800);

      // 6. Click preset scenario: 什么时候发货？
      await smoothMoveAndClick(page, 'button:has-text("什么时候发货？")', 1000);

      // 7. Check the review checkbox
      const reviewLabel = page.locator('label:has-text("我已人工核验无误")').first();
      await reviewLabel.waitFor({ state: 'visible', timeout: 5000 });
      await smoothMoveAndClick(page, 'label:has-text("我已人工核验无误")', 800);

      // 8. Click 保存模拟回复
      await smoothMoveAndClick(page, 'button:has-text("保存模拟回复")', 1200);

      await page.waitForTimeout(600);
      await context.close();
    }

    // Convert recorded webm to GIF
    const gifVideoFiles = fs.readdirSync(gifVideoDir).filter((f) => f.endsWith('.webm'));
    if (gifVideoFiles.length > 0) {
      const rawVideo = path.join(gifVideoDir, gifVideoFiles[0]);
      const targetGif = path.join(mediaDir, 'demo.gif');
      console.log(`正在使用 ffmpeg 优化转换高质量 GIF: ${targetGif}`);

      const ffmpegCmd = `ffmpeg -y -i "${rawVideo}" -vf "fps=14,scale=1024:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" "${targetGif}"`;
      run(ffmpegCmd);

      const gifStats = fs.statSync(targetGif);
      console.log(`✅ demo.gif 生成成功！大小: ${(gifStats.size / (1024 * 1024)).toFixed(2)} MB`);
    }

    // ----------------------------------------------------
    // Step C: 录制 45-55 秒完整产品演示视频 demo.mp4
    // ----------------------------------------------------
    console.log('\n--- 3. 录制 45-55 秒完整产品演示视频 demo.mp4 ---');
    const fullVideoDir = path.join(tempDir, 'full_record');
    if (!fs.existsSync(fullVideoDir)) fs.mkdirSync(fullVideoDir, { recursive: true });

    {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        recordVideo: {
          dir: fullVideoDir,
          size: { width: 1440, height: 900 },
        },
      });
      const page = await context.newPage();
      await page.goto(baseUrl);

      // 0-8s: Overview Dashboard
      console.log('视频章节 1/5: 总览仪表盘');
      await page.waitForTimeout(1500);
      await page.mouse.move(350, 180, { steps: 12 });
      await page.waitForTimeout(800);
      await page.mouse.move(650, 180, { steps: 12 });
      await page.waitForTimeout(800);
      await page.mouse.move(950, 180, { steps: 12 });
      await page.waitForTimeout(800);
      await page.mouse.move(700, 480, { steps: 12 });
      await page.waitForTimeout(2000);

      // 8-22s: Orders & Procurement
      console.log('视频章节 2/5: 订单与采购供应链协同');
      await smoothMoveAndClick(page, 'button:has-text("订单管理")', 1200);

      // Mouse over orders table
      await page.mouse.move(700, 320, { steps: 12 });
      await page.waitForTimeout(1200);

      // Click create order
      await smoothMoveAndClick(page, 'button:has-text("创建新测试订单")', 800);
      await smoothType(page, 'input[placeholder*="周杰"]', '陈建国', 35);
      await page.waitForTimeout(600);
      await smoothMoveAndClick(page, 'button[type="submit"]:has-text("立即创建")', 1200);

      // 22-42s: AI Inbox Copilot & Human Review
      console.log('视频章节 3/5: AI 客服工作台、研判与人工审核');
      await smoothMoveAndClick(page, 'button[title*="前往客服"]', 1200);

      // View order context
      await page.mouse.move(1250, 260, { steps: 12 });
      await page.waitForTimeout(1200);

      // Click quick question: 什么时候发货？
      await smoothMoveAndClick(page, 'button:has-text("什么时候发货？")', 1500);

      // Hover over warning banner
      await page.mouse.wheel(0, 150);
      await page.waitForTimeout(1200);

      // Check Human Review confirmation checkbox
      await smoothMoveAndClick(page, 'label:has-text("我已人工核验无误")', 1000);

      // Click save reply
      await smoothMoveAndClick(page, 'button:has-text("保存模拟回复")', 1500);

      // Query another scenario: 支持开具发票吗？
      const invoiceBtn = page.locator('button:has-text("支持开具发票吗？")').first();
      if (await invoiceBtn.count() > 0) {
        await smoothMoveAndClick(page, 'button:has-text("支持开具发票吗？")', 1500);
        await page.waitForTimeout(1500);
      }

      // 42-50s: Knowledge Base
      console.log('视频章节 4/5: 商品知识库与规则政策');
      await smoothMoveAndClick(page, 'button:has-text("商品知识库")', 1500);
      await page.mouse.move(500, 350, { steps: 12 });
      await page.waitForTimeout(1200);

      // Click 发货与时效规则 tab
      const shippingTab = page.locator('button:has-text("发货与时效规则")').first();
      if (await shippingTab.count() > 0) {
        await smoothMoveAndClick(page, 'button:has-text("发货与时效规则")', 1500);
      }

      // Click 退换货政策 tab
      const returnTab = page.locator('button:has-text("退换货政策")').first();
      if (await returnTab.count() > 0) {
        await smoothMoveAndClick(page, 'button:has-text("退换货政策")', 1500);
      }

      // 50-55s: Settings & Conclusion
      console.log('视频章节 5/5: 系统设置与品牌结语');
      await smoothMoveAndClick(page, 'button:has-text("系统设置")', 1500);
      await page.waitForTimeout(2500);

      await context.close();
    }

    // Convert recorded webm to MP4
    const fullVideoFiles = fs.readdirSync(fullVideoDir).filter((f) => f.endsWith('.webm'));
    if (fullVideoFiles.length > 0) {
      const rawFullVideo = path.join(fullVideoDir, fullVideoFiles[0]);
      const targetMp4 = path.join(mediaDir, 'demo.mp4');
      console.log(`正在使用 ffmpeg 转换标准 H.264 MP4: ${targetMp4}`);

      const ffmpegMp4Cmd = `ffmpeg -y -i "${rawFullVideo}" -c:v libx264 -pix_fmt yuv420p -crf 23 -preset fast -movflags +faststart "${targetMp4}"`;
      run(ffmpegMp4Cmd);

      const mp4Stats = fs.statSync(targetMp4);
      console.log(`✅ demo.mp4 生成成功！大小: ${(mp4Stats.size / (1024 * 1024)).toFixed(2)} MB`);

      // ----------------------------------------------------
      // Step D: 生成精美视频封面图 video-cover.png
      // ----------------------------------------------------
      console.log('\n--- 4. 生成视频封面图 video-cover.png ---');
      const targetCover = path.join(mediaDir, 'video-cover.png');
      const extractFrameCmd = `ffmpeg -y -ss 00:00:28 -i "${targetMp4}" -vframes 1 "${targetCover}"`;
      run(extractFrameCmd);
      await renderVideoCoverWithBadge(browser);
      console.log(`✅ video-cover.png 封面生成完成！`);
    }

    console.log('\n=============================================');
    console.log('🎉 所有真实媒体资源已成功生成并存入 docs/media/！');
    console.log('=============================================');

  } finally {
    await browser.close();
    server.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('媒体生成失败:', err);
  process.exit(1);
});
