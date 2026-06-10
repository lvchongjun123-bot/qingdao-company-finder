// test_search.js — 自动化测试黄岛区搜索
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,  // 可见模式，方便看过程
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--no-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({width: 1400, height: 900});

  // 收集所有日志
  const logs = [];
  page.on('console', msg => {
    const txt = msg.text();
    logs.push(txt);
    console.log('[CONSOLE]', txt);
  });
  page.on('pageerror', err => console.log('[PAGE ERROR]', err.message));

  console.log('[*] Loading page...');
  await page.goto('http://localhost:8080/map_selector.html', {waitUntil: 'networkidle2', timeout: 15000});
  console.log('[*] Page loaded, waiting 5s for AMap to init...');
  await new Promise(r => setTimeout(r, 5000));

  // 检查地图是否加载
  var state = await page.evaluate(() => {
    var mapEl = document.getElementById('map');
    var tip = document.getElementById('tip').textContent;
    var barBtns = document.querySelectorAll('#bar button').length;
    return {mapExists: !!mapEl, tip: tip.substring(0,80), barBtns: barBtns};
  });
  console.log('[*] Page state:', JSON.stringify(state));

  // Screenshot 1: initial state
  await page.screenshot({path: 'E:/my_claude_projects/test_01_initial.png'});
  console.log('[*] Screenshot 1: initial state saved');

  // 确保行政区模式选中 + 黄岛区勾选
  await page.evaluate(() => {
    // Select "行政区" mode
    var modeBtns = document.querySelectorAll('.btn-mode');
    modeBtns.forEach(b => b.classList.remove('on'));
    modeBtns[0].classList.add('on');
    // mode = 'dist'
  });
  console.log('[*] Set mode to 行政区');

  // 点击 "开始搜索"
  console.log('[*] Clicking 开始搜索...');
  await page.click('#btnGo');
  console.log('[*] Search started, waiting...');

  // 等待搜索结果（轮询检查）- REST API 搜索需要更长时间
  for (var i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 1000));
    var progress = await page.evaluate(() => {
      var tip = document.getElementById('tip').textContent;
      var progText = document.getElementById('progText').textContent;
      var isSearching = document.getElementById('btnGo').textContent.includes('搜索中');
      var btnCancelVisible = document.getElementById('btnCancel').style.display !== 'none';
      return {tip: tip.substring(0,100), prog: progText.substring(0,100), isSearching: isSearching, cancelVisible: btnCancelVisible};
    });
    console.log('  [' + (i+1) + 's]', JSON.stringify(progress));

    if (!progress.isSearching && !progress.cancelVisible) {
      console.log('[*] Search appears complete!');
      break;
    }
  }

  // Screenshot 2: results
  await page.screenshot({path: 'E:/my_claude_projects/test_02_results.png'});
  console.log('[*] Screenshot 2: results saved');

  // 收集搜索结果
  var results = await page.evaluate(() => {
    var title = document.getElementById('resTitle').textContent;
    var listItems = document.querySelectorAll('.rrow').length;
    var first5 = [];
    var rows = document.querySelectorAll('.rn');
    for (var i = 0; i < Math.min(5, rows.length); i++) {
      first5.push(rows[i].textContent.trim());
    }
    var csvBtn = document.getElementById('btnCsv').disabled ? 'disabled' : 'enabled';
    return {title: title, total: listItems, first5: first5, csvBtn: csvBtn};
  });
  console.log('[*] Results:', JSON.stringify(results, null, 2));

  // 如果有结果，导出CSV
  if (results.total > 0 && results.csvBtn === 'enabled') {
    console.log('[*] Exporting CSV...');
    await page.click('#btnCsv');
    await new Promise(r => setTimeout(r, 2000));
    console.log('[*] CSV export clicked');
  }

  console.log('[*] TEST COMPLETE');
  console.log('[*] Logs collected:', logs.length);

  // Keep browser open for a few sec to see results
  await new Promise(r => setTimeout(r, 3000));
  await browser.close();
  console.log('[*] Browser closed');
})();
