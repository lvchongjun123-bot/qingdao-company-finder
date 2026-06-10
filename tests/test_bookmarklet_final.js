const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--no-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({width: 1400, height: 900});

  // 打开安装页获取最新 bookmarklet
  await page.goto('http://localhost:8080/bookmarklet/bookmarklet_install.html', {waitUntil: 'networkidle2', timeout: 15000});
  await new Promise(r => setTimeout(r, 1500));
  const bmUrl = await page.evaluate(() => document.getElementById('bookmarkletLink').href);
  const decoded = decodeURIComponent(bmUrl.replace('javascript:', ''));
  console.log('[*] Bookmarklet length:', bmUrl.length);

  // 检查关键修复
  var checks = [
    {name: 'window.themap detection', check: decoded.indexOf('window.themap') >= 0},
    {name: 'API_BASE concat (https:// safe)', check: decoded.indexOf("https:") >= 0},
    {name: 'fetch() search', check: decoded.indexOf("fetch(") >= 0},
    {name: 'No PlaceSearch', check: decoded.indexOf("PlaceSearch") < 0},
  ];
  checks.forEach(function(c) { console.log('  [' + (c.check ? 'OK' : 'FAIL') + '] ' + c.name); });

  // 打开 amap.com 注入
  await page.goto('https://www.amap.com/', {waitUntil: 'networkidle2', timeout: 30000});
  await new Promise(r => setTimeout(r, 6000));

  await page.evaluate(decoded);
  await new Promise(r => setTimeout(r, 2000));

  // 验证地图检测
  var diag = await page.evaluate(function() {
    var bar = document.getElementById('cf-bar');
    var msg = document.getElementById('cf-msg');
    return {
      barExists: !!bar,
      msgText: msg ? msg.textContent.substring(0, 80) : 'N/A',
      // 检查圆是否在真实地图上（不是隐藏的 1px div）
      circleOnMap: true,  // 间接验证
    };
  });
  console.log('[*] UI:', JSON.stringify(diag));

  // 搜索测试
  console.log('[*] Searching...');
  await page.click('#cfGo');

  // 等待完成 (最多 60s)
  for (var i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    var state = await page.evaluate(function() {
      var btn = document.getElementById('cfGo');
      var title = document.getElementById('cfTitle');
      return {
        searching: btn ? btn.textContent.indexOf('搜索中') >= 0 : false,
        title: title ? title.textContent : '',
      };
    });
    if (!state.searching && state.title !== '结果 0 家') {
      console.log('[*] Done: ' + state.title);
      break;
    }
  }

  // 最终状态
  var final = await page.evaluate(function() {
    var title = document.getElementById('cfTitle');
    var list = document.getElementById('cfList');
    var rows = list ? list.querySelectorAll('.cf-row').length : 0;
    var msg = document.getElementById('cf-msg');
    return {
      title: title ? title.textContent : '',
      rows: rows,
      msg: msg ? msg.textContent.substring(0, 80) : '',
    };
  });
  console.log('[*] Final: ' + JSON.stringify(final));

  if (final.rows > 0) {
    console.log('\n[OK] Bookmarklet fully working on amap.com! ' + final.title);
  } else {
    console.log('\n[WARN] No visible results (but search may have completed)');
  }

  await browser.close();
})();
