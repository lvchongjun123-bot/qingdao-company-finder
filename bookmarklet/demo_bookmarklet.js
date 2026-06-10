/**
 * 演示：Puppeteer 打开高德搜索 + 注入打分脚本 + 截图
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BOOKMARKLET_JS = path.join(__dirname, 'bookmarklet.js');
const SCREENSHOT_PATH = path.join(__dirname, 'demo_result.png');

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log('[1/5] Launching browser...');
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  console.log('[2/5] Opening amap search...');
  await page.goto('https://www.amap.com/search?query=%E7%A7%91%E6%8A%80%E6%9C%89%E9%99%90%E5%85%AC%E5%8F%B8&city=370200', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  console.log('[3/5] Waiting for search results...');
  await sleep(5000);

  console.log('[4/5] Injecting bookmarklet...');
  const scriptContent = fs.readFileSync(BOOKMARKLET_JS, 'utf-8');
  await page.evaluate(function(script) {
    var s = document.createElement('script');
    s.textContent = script;
    document.body.appendChild(s);
  }, scriptContent);

  await sleep(3000);

  // 检查面板
  const resultInfo = await page.evaluate(function() {
    var p = document.getElementById('cf-pnl');
    var t = document.getElementById('cf-title');
    return {
      visible: !!p,
      title: t ? t.textContent : 'N/A'
    };
  });
  console.log('  Panel visible:', resultInfo.visible);
  console.log('  Result:', resultInfo.title);

  console.log('[5/5] Taking screenshot...');
  await page.screenshot({ path: SCREENSHOT_PATH });
  console.log('  Saved:', SCREENSHOT_PATH);

  console.log('\n[DONE] Browser stays open. Press Ctrl+C to close.');
  await new Promise(() => {});
})().catch(err => {
  console.error('[ERR]', err.message);
  process.exit(1);
});
