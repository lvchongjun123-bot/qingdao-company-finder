const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--no-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({width: 1400, height: 900});

  const logs = [];
  page.on('console', function(msg) {
    var t = msg.text();
    logs.push(t);
    if (t.length < 180) console.log('  [C]', t);
  });
  page.on('pageerror', function(err) { console.log('  [ERR]', err.message); });

  var LIVE = 'https://lvchongjun123-bot.github.io/qingdao-company-finder/';

  console.log('[*] Loading live site...');
  await page.goto(LIVE, {waitUntil: 'networkidle2', timeout: 30000});
  console.log('[*] Page loaded, waiting 5s for AMap...');
  await new Promise(r => setTimeout(r, 5000));

  // 初始状态
  var init = await page.evaluate(function() {
    var map = document.getElementById('map');
    var tip = document.getElementById('tip');
    return {
      mapExists: !!map,
      tip: tip ? tip.textContent.substring(0, 80) : 'N/A',
      barBtns: document.querySelectorAll('#bar button').length,
    };
  });
  console.log('[*] Init:', JSON.stringify(init));

  if (!init.mapExists) { console.log('[FAIL] Map not loaded'); await browser.close(); return; }

  // 选行政区模式 + 黄岛
  await page.evaluate(function() {
    var modes = document.querySelectorAll('.btn-mode');
    modes.forEach(function(b) { b.classList.remove('on'); });
    if (modes[0]) modes[0].classList.add('on');
    var cbs = document.querySelectorAll('#distDrop input[type=checkbox]');
    cbs.forEach(function(cb) { cb.checked = false; });
    if (cbs.length > 0) cbs[0].checked = true;
  });
  console.log('[*] Mode: dist, district selected');

  // 截图初始
  await page.screenshot({path: 'tests/test_live_init.png'});

  // 开始搜索
  console.log('[*] Clicking search...');
  await page.click('#btnGo');

  // 等搜索完成
  var result = null;
  for (var i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 2000));
    var s = await page.evaluate(function() {
      var tip = document.getElementById('tip').textContent;
      var prog = document.getElementById('progText').textContent;
      var canc = document.getElementById('btnCancel');
      return {
        tip: tip.substring(0, 100),
        prog: prog.substring(0, 80),
        cancelVisible: canc ? canc.style.display !== 'none' : false,
      };
    });
    console.log('  [' + ((i+1)*2) + 's] ' + s.tip + ' | ' + s.prog);
    if (s.tip.indexOf('[OK]') >= 0 || s.tip.indexOf('0结果') >= 0) {
      result = s;
      break;
    }
    if (!s.cancelVisible && i > 5) {
      // 可能完成了
      result = s;
      break;
    }
  }

  // 截图结果
  await page.screenshot({path: 'tests/test_live_results.png'});
  console.log('[*] Screenshot saved');

  // 获取详情
  var detail = await page.evaluate(function() {
    var title = document.getElementById('resTitle').textContent;
    var rows = document.querySelectorAll('.rrow').length;
    var pagination = document.getElementById('pagination').textContent.substring(0, 80);
    var first3 = [];
    var rns = document.querySelectorAll('.rn');
    for (var i = 0; i < Math.min(3, rns.length); i++) first3.push(rns[i].textContent.replace(/\s+/g, ' ').trim());
    var csvDisabled = document.getElementById('btnCsv').disabled;
    return {title: title, rows: rows, pagination: pagination, first3: first3, csvDisabled: csvDisabled};
  });
  console.log('[*] Result:', JSON.stringify(detail, null, 2));

  // 检查错误
  var errLogs = logs.filter(function(l) {
    return l.indexOf('REST err') >= 0 || l.indexOf('Error') >= 0 || l.indexOf('CUQPS') >= 0;
  });
  if (errLogs.length) {
    console.log('[*] Error logs (' + errLogs.length + '):');
    errLogs.slice(0, 10).forEach(function(l) { console.log('   ', l.substring(0, 150)); });
  }

  if (detail.rows === 0) {
    console.log('\n[FAIL] 0 results on live site!');
  } else {
    console.log('\n[OK] ' + detail.title + ' | ' + detail.rows + ' visible rows');
  }

  await browser.close();
})();
