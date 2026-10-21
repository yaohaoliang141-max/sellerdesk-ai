import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mediaDir = path.resolve(__dirname, '../docs/media');

export async function renderVideoCoverWithBadge(browserInstance, durationSec = 52) {
  const browser = browserInstance || (await chromium.launch({ headless: true }));
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const coverPath = path.join(mediaDir, 'video-cover.png');
  if (!fs.existsSync(coverPath)) {
    console.warn('Cover file does not exist yet:', coverPath);
    return;
  }
  const base64 = fs.readFileSync(coverPath).toString('base64');

  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { width: 1920px; height: 1080px; overflow: hidden; background: #000; position: relative; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; }
        .bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: brightness(0.92); }
        .scrim { position: absolute; inset: 0; background: radial-gradient(circle at center, rgba(15,23,42,0.18) 0%, rgba(15,23,42,0.52) 100%); }
        .center-box { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 24px; }
        .play-btn { width: 110px; height: 110px; border-radius: 50%; background: rgba(15, 23, 42, 0.92); backdrop-filter: blur(14px); border: 3px solid rgba(255, 255, 255, 0.45); display: flex; align-items: center; justify-content: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.75), 0 0 40px rgba(56, 189, 248, 0.35); }
        .play-icon { width: 0; height: 0; border-top: 20px solid transparent; border-bottom: 20px solid transparent; border-left: 34px solid #38bdf8; margin-left: 8px; }
        .badge { background: rgba(15, 23, 42, 0.94); backdrop-filter: blur(12px); border: 1.5px solid rgba(255, 255, 255, 0.3); color: #fff; font-size: 16px; font-weight: 600; padding: 12px 32px; border-radius: 9999px; box-shadow: 0 15px 30px -5px rgba(0, 0, 0, 0.55); letter-spacing: 0.4px; }
      </style>
    </head>
    <body>
      <img class="bg" src="data:image/png;base64,${base64}" />
      <div class="scrim"></div>
      <div class="center-box">
        <div class="play-btn">
          <div class="play-icon"></div>
        </div>
        <div class="badge">▶ 点击播放产品演示视频 (真实 1080P Full HD · ${durationSec}秒)</div>
      </div>
    </body>
    </html>
  `);

  await page.waitForTimeout(300);
  await page.screenshot({ path: coverPath });
  await context.close();
  if (!browserInstance) await browser.close();
  console.log('✅ video-cover.png 封面卡片绘制完成！(1080P 高清标准)');
}

if (process.argv[1] && process.argv[1].endsWith('make-cover.js')) {
  renderVideoCoverWithBadge();
}
