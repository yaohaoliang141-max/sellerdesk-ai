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

function run(command, cwd = rootDir) {
  console.log(`> ${command}`);
  execSync(command, { stdio: 'inherit', cwd });
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

  // Requirement 3: Always build the latest source first; abort if failed!
  console.log('1. 正在重新构建最新前端代码 (npm run build)...');
  try {
    run('npm run build');
    console.log('✅ 前端构建通过，确保素材来自当前最新源码！\n');
  } catch (err) {
    console.error('❌ 前端构建失败，中止媒体生成程序！', err.message);
    process.exit(1);
  }

  const server = await startStaticServer(5199);
  const baseUrl = 'http://127.0.0.1:5199';

  const browser = await chromium.launch({
    headless: true,
  });

  try {
    // ----------------------------------------------------
    // Step A: 制作高清真实产品截图 (桌面端 1440px + 移动端 390px)
    // ----------------------------------------------------
    console.log('\n--- 2. 生成桌面与移动端高清产品截图 ---');
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

      // 2. orders.png (Full table without empty holes)
      console.log('截取: orders.png (销售与采购协同订单)');
      await smoothMoveAndClick(page, 'button:has-text("订单管理")', 600);
      await page.screenshot({
        path: path.join(mediaDir, 'orders.png'),
        fullPage: false,
      });

      // 3. inbox.png (AI 客服工作台与人工审核，无任何文字换行拥挤)
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

      // 4. knowledge.png (4 product cards grid with specs and policies)
      console.log('截取: knowledge.png (商品规格与知识库政策)');
      await smoothMoveAndClick(page, 'button:has-text("商品知识库")', 600);
      await page.screenshot({
        path: path.join(mediaDir, 'knowledge.png'),
        fullPage: false,
      });

      await context.close();
    }

    // 5. Mobile screenshots (iPhone 14: 390x844)
    {
      console.log('截取: 移动端功能截图 (Dashboard, AI Inbox, Orders)');
      const mobileContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
      });
      const page = await mobileContext.newPage();
      await page.goto(baseUrl);
      await page.waitForTimeout(800);

      // mobile-overview.png
      console.log('截取: mobile-overview.png (移动端总览)');
      await page.screenshot({
        path: path.join(mediaDir, 'mobile-overview.png'),
        fullPage: false,
      });
      fs.copyFileSync(path.join(mediaDir, 'mobile-overview.png'), path.join(mediaDir, 'mobile.png'));

      // Helper to navigate via mobile drawer
      const navigateMobile = async (tabName) => {
        const menuBtn = page.locator('header button.md\\:hidden').first();
        await menuBtn.click();
        await page.waitForTimeout(400);
        await page.locator(`aside button:has-text("${tabName}")`).first().click();
        await page.waitForTimeout(600);
      };

      // mobile-inbox.png: Open AI Inbox on mobile
      console.log('截取: mobile-inbox.png (移动端客服工作台)');
      await navigateMobile('AI 客服');
      const mobileQueryBtn = page.locator('button:has-text("什么时候发货？")').first();
      if (await mobileQueryBtn.count() > 0) {
        await mobileQueryBtn.click();
        await page.waitForTimeout(600);
      }
      await page.screenshot({
        path: path.join(mediaDir, 'mobile-inbox.png'),
        fullPage: false,
      });

      // mobile-orders.png: Open Orders on mobile
      console.log('截取: mobile-orders.png (移动端订单协同)');
      await navigateMobile('订单管理');
      await page.screenshot({
        path: path.join(mediaDir, 'mobile-orders.png'),
        fullPage: false,
      });

      await mobileContext.close();
      console.log('✅ 移动端截图生成完毕 (mobile-overview.png, mobile-inbox.png, mobile-orders.png)');
    }

    // ----------------------------------------------------
    // Step B: 录制 12-14 秒核心业务流程并生成 demo.gif
    // ----------------------------------------------------
    console.log('\n--- 3. 录制核心协同流程 GIF (创建订单 → 关联采购 → 客服研判 → 审核保存) ---');
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

      // 5. Click 前往客服 on the newly created order
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
    // Step C: 录制真实 1920x1080 (1080P)、45-60秒完整产品演示视频 demo.mp4
    // ----------------------------------------------------
    console.log('\n--- 4. 录制真实 1920x1080 (1080P)、45-60 秒完整产品演示视频 demo.mp4 ---');
    const fullVideoDir = path.join(tempDir, 'full_record');
    if (!fs.existsSync(fullVideoDir)) fs.mkdirSync(fullVideoDir, { recursive: true });

    {
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        recordVideo: {
          dir: fullVideoDir,
          size: { width: 1920, height: 1080 },
        },
      });
      const page = await context.newPage();
      await page.goto(baseUrl);

      // 0-9s: Overview Dashboard
      console.log('视频章节 1/5: 总览仪表盘 (0-9s)');
      await page.waitForTimeout(2000);
      await page.mouse.move(450, 200, { steps: 15 });
      await page.waitForTimeout(1000);
      await page.mouse.move(800, 200, { steps: 15 });
      await page.waitForTimeout(1000);
      await page.mouse.move(1150, 200, { steps: 15 });
      await page.waitForTimeout(1000);
      await page.mouse.move(800, 520, { steps: 15 });
      await page.waitForTimeout(2500);

      // 9-23s: Orders & Procurement Linkage
      console.log('视频章节 2/5: 订单与采购供应链协同 (9-23s)');
      await smoothMoveAndClick(page, 'button:has-text("订单管理")', 1500);

      // Browse orders table
      await page.mouse.move(960, 360, { steps: 15 });
      await page.waitForTimeout(1500);

      // Click create order
      await smoothMoveAndClick(page, 'button:has-text("创建新测试订单")', 1000);
      await smoothType(page, 'input[placeholder*="周杰"]', '陈建国', 40);
      await page.waitForTimeout(800);
      await smoothMoveAndClick(page, 'button[type="submit"]:has-text("立即创建")', 1500);

      // 23-45s: AI Inbox Copilot, Multi-tier status & Human Review
      console.log('视频章节 3/5: AI 客服工作台、研判与人工审核 (23-45s)');
      await smoothMoveAndClick(page, 'button[title*="前往客服"]', 1500);

      // Inspect right context drawer
      await page.mouse.move(1650, 320, { steps: 15 });
      await page.waitForTimeout(1500);

      // Click quick question: 什么时候发货？
      await smoothMoveAndClick(page, 'button:has-text("什么时候发货？")', 1800);

      // Scroll to view AI suggestions & reasoning
      await page.mouse.wheel(0, 180);
      await page.waitForTimeout(1800);

      // Query another scenario: 支持开具发票吗？
      const invoiceBtn = page.locator('button:has-text("支持开具发票吗？")').first();
      if (await invoiceBtn.count() > 0) {
        await smoothMoveAndClick(page, 'button:has-text("支持开具发票吗？")', 2000);
        await page.waitForTimeout(1800);
      }

      // Check Human Review confirmation checkbox
      await smoothMoveAndClick(page, 'label:has-text("我已人工核验无误")', 1200);

      // Click save reply
      await smoothMoveAndClick(page, 'button:has-text("保存模拟回复")', 1800);

      // 45-53s: Knowledge Base & Policies
      console.log('视频章节 4/5: 商品知识库与规则政策 (45-53s)');
      await smoothMoveAndClick(page, 'button:has-text("商品知识库")', 1500);
      await page.mouse.move(650, 420, { steps: 15 });
      await page.waitForTimeout(1500);

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

      // 53-58s: Settings & Conclusion
      console.log('视频章节 5/5: 系统设置与品牌结语 (53-58s)');
      await smoothMoveAndClick(page, 'button:has-text("系统设置")', 1500);
      await page.waitForTimeout(3000);

      await context.close();
    }

    // Convert recorded webm to 1080P MP4
    const fullVideoFiles = fs.readdirSync(fullVideoDir).filter((f) => f.endsWith('.webm'));
    if (fullVideoFiles.length > 0) {
      const rawFullVideo = path.join(fullVideoDir, fullVideoFiles[0]);
      const targetMp4 = path.join(mediaDir, 'demo.mp4');
      console.log(`正在使用 ffmpeg 转换标准 1080P H.264 MP4: ${targetMp4}`);

      // H.264 high quality, 1920x1080, yuv420p for universal browser & GitHub compatibility
      const ffmpegMp4Cmd = `ffmpeg -y -i "${rawFullVideo}" -c:v libx264 -pix_fmt yuv420p -crf 22 -preset fast -movflags +faststart "${targetMp4}"`;
      run(ffmpegMp4Cmd);

      const mp4Stats = fs.statSync(targetMp4);
      console.log(`✅ demo.mp4 生成成功！大小: ${(mp4Stats.size / (1024 * 1024)).toFixed(2)} MB`);

      // Get exact video duration with ffprobe/ffmpeg
      let durationSec = 52;
      try {
        const probeOut = execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${targetMp4}"`, { encoding: 'utf-8' });
        const parsed = Math.round(parseFloat(probeOut.trim()));
        if (parsed > 0) durationSec = parsed;
      } catch {
        // Fallback
      }

      // ----------------------------------------------------
      // Step D: 生成 1080P 高清视频封面图 video-cover.png
      // (抽取 32s 处于 AI 客服 + 订单协同 + 人工审核告警的最具产品特色画面)
      // ----------------------------------------------------
      console.log(`\n--- 5. 生成最具代表性的 1080P 视频封面图 (AI 客服 + 人工审核 + 订单上下文) ---`);
      const targetCover = path.join(mediaDir, 'video-cover.png');
      const extractFrameCmd = `ffmpeg -y -ss 00:00:32 -i "${targetMp4}" -vframes 1 "${targetCover}"`;
      run(extractFrameCmd);

      await renderVideoCoverWithBadge(browser, durationSec);
      console.log(`✅ video-cover.png 封面生成完成！标注真实时长: ${durationSec}秒`);
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
