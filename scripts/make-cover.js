import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mediaDir = path.resolve(__dirname, '../docs/media');

export async function renderVideoCoverWithBadge(browserInstance) {
  const browser = browserInstance || (await chromium.launch({ headless: true }));
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const coverPath = path.join(mediaDir, 'video-cover.png');
  const base64 = fs.readFileSync(coverPath).toString('base64');

  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { width: 1440px; height: 900px; overflow: hidden; background: #000; position: relative; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; }
        .bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: brightness(0.92); }
        .scrim { position: absolute; inset: 0; background: radial-gradient(circle at center, rgba(15,23,42,0.18) 0%, rgba(15,23,42,0.48) 100%); }
        .center-box { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 20px; }
        .play-btn { width: 96px; height: 96px; border-radius: 50%; background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(12px); border: 2.5px solid rgba(255, 255, 255, 0.4); display: flex; align-items: center; justify-content: center; box-shadow: 0 20px 45px -10px rgba(0, 0, 0, 0.65), 0 0 35px rgba(56, 189, 248, 0.3); }
        .play-icon { width: 0; height: 0; border-top: 18px solid transparent; border-bottom: 18px solid transparent; border-left: 30px solid #38bdf8; margin-left: 8px; }
        .badge { background: rgba(15, 23, 42, 0.94); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.28); color: #fff; font-size: 14px; font-weight: 600; padding: 9px 26px; border-radius: 9999px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); letter-spacing: 0.3px; }
      </style>
    </head>
    <body>
      <img class="bg" src="data:image/png;base64,${base64}" />
      <div class="scrim"></div>
      <div class="center-box">
        <div class="play-btn">
          <div class="play-icon"></div>
        </div>
        <div class="badge">▶ 点击播放完整产品演示视频 (37秒 / 1080P)</div>
      </div>
    </body>
    </html>
  `);

  await page.waitForTimeout(300);
  await page.screenshot({ path: coverPath });
  await context.close();
  if (!browserInstance) await browser.close();
  console.log('✅ video-cover.png 封面卡片绘制完成！');
}

if (process.argv[1] && process.argv[1].endsWith('make-cover.js')) {
  renderVideoCoverWithBadge();
}
