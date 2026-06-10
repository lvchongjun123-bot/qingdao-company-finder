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
    if (t.length < 150) console.log('  [C]', t);
  });
  page.on('pageerror', function(err) { console.log('  [ERR]', err.message); });

  // Step 1: 从 GitHub Pages 获取最新书签代码
  console.log('[*] Step 1: Fetching bookmarklet from GitHub Pages...');
  await page.goto('https://lvchongjun123-bot.github.io/qingdao-company-finder/bookmarklet/bookmarklet_install.html', {waitUntil: 'networkidle2', timeout: 30000});
  await new Promise(r => setTimeout(r, 2000));

  var installInfo = await page.evaluate(function() {
    var link = document.getElementById('bookmarkletLink');
    return {
      hrefExists: !!link,
      hrefStart: link ? link.href.substring(0, 50) : 'NONE',
    };
  });
  console.log('[*] Install page link:', JSON.stringify(installInfo));

  if (!installInfo.hrefExists || installInfo.hrefStart === 'javascript:void(0)') {
    console.log('[FAIL] Bookmarklet link not generated! Check XHR for bookmarklet.js');
    await browser.close();
    return;
  }

  var bmUrl = await page.evaluate(function() { return document.getElementById('bookmarkletLink').href; });
  var decoded = decodeURIComponent(bmUrl.replace('javascript:', ''));
  console.log('[*] Bookmarklet decoded length:', decoded.length);

  // 关键检查
  var checks = [
    {name: 'REST API URL', ok: decoded.indexOf('restapi.amap.com') >= 0},
    {name: 'fetch() call', ok: decoded.indexOf('fetch(') >= 0},
    {name: 'window.themap', ok: decoded.indexOf('window.themap') >= 0},
    {name: 'No PlaceSearch', ok: decoded.indexOf('PlaceSearch') < 0},
    {name: 'WS_KEY present', ok: decoded.indexOf('b756c2d47e44c7a36768bd8f2d2d7665') >= 0},
  ];
  console.log('[*] Code checks:');
  checks.forEach(function(c) { console.log('    [' + (c.ok ? 'OK' : 'FAIL') + '] ' + c.name); });
  var allCodeOk = checks.every(function(c) { return c.ok; });
  if (!allCodeOk) { console.log('[FAIL] Generated bookmarklet has issues'); await browser.close(); return; }

  // Step 2: 打开高德正版地图
  console.log('\n[*] Step 2: Opening amap.com...');
  await page.goto('https://www.amap.com/', {waitUntil: 'networkidle2', timeout: 30000});
  await new Promise(r => setTimeout(r, 6000));

  var amapState = await page.evaluate(function() {
    return {
      hasAMap: typeof window.AMap !== 'undefined',
      hasThemap: !!window.themap,
      title: document.title,
    };
  });
  console.log('[*] amap.com state:', JSON.stringify(amapState));

  // Step 3: 注入书签
  console.log('[*] Step 3: Injecting bookmarklet...');
  try {
    await page.evaluate(decoded);
    console.log('[*] Injection: no error');
  } catch(e) {
    console.log('[ERR] Injection threw:', e.message);
  }
  await new Promise(r => setTimeout(r, 2000));

  // Step 4: 检查 UI
  console.log('[*] Step 4: Checking UI...');
  var ui = await page.evaluate(function() {
    var bar = document.getElementById('cf-bar');
    var msg = document.getElementById('cf-msg');
    return {
      barExists: !!bar,
      msgText: msg ? msg.textContent.substring(0, 80) : 'N/A',
      cfFlag: window.__CF,
    };
  });
  console.log('[*] UI:', JSON.stringify(ui));

  if (!ui.barExists) {
    console.log('[FAIL] Bookmarklet UI did not appear!');
    await page.screenshot({path: 'tests/test_bm_fail.png'});
    await browser.close();
    return;
  }

  await page.screenshot({path: 'tests/test_bm_01_ui.png'});
  console.log('[*] Screenshot: UI saved');

  // Step 5: 设置半径 10km
  console.log('[*] Step 5: Setting radius to 10km...');
  await page.evaluate(function() {
    var btns = document.querySelectorAll('.cf-r');
    btns.forEach(function(b) { if (b.dataset.r === '10') b.click(); });
  });

  // Step 6: 点击搜索
  console.log('[*] Step 6: Clicking search...');
  await page.click('#cfGo');

  // Step 7: 等待搜索完成
  console.log('[*] Step 7: Waiting for search...');
  var finalState = null;
  for (var i = 0; i < 45; i++) {
    await new Promise(r => setTimeout(r, 2000));
    var s = await page.evaluate(function() {
      var btn = document.getElementById('cfGo');
      var title = document.getElementById('cfTitle');
      var progText = document.getElementById('cfProgText');
      var msg = document.getElementById('cf-msg');
      var list = document.getElementById('cfList');
      return {
        btnText: btn ? btn.textContent : '',
        title: title ? title.textContent : '',
        prog: progText ? progText.textContent : '',
        msg: msg ? msg.textContent.substring(0, 80) : '',
        rows: list ? list.querySelectorAll('.cf-row').length : 0,
      };
    });
    console.log('  [' + ((i+1)*2) + 's] btn=' + s.btnText + ' | title=' + s.title + ' | prog=' + s.prog + ' | rows=' + s.rows);

    if (s.btnText === '搜索区域内公司' && s.title !== '结果 0 家') {
      console.log('[*] Search completed with results!');
      finalState = s;
      break;
    }
    if (s.btnText === '搜索区域内公司' && s.title === '结果 0 家' && s.rows === 0 && i > 8) {
      console.log('[*] Search finished with 0 results');
      finalState = s;
      break;
    }
  }

  if (!finalState) {
    finalState = await page.evaluate(function() {
      var btn = document.getElementById('cfGo');
      var title = document.getElementById('cfTitle');
      var list = document.getElementById('cfList');
      var msg = document.getElementById('cf-msg');
      return {
        btnText: btn ? btn.textContent : '',
        title: title ? title.textContent : '',
        msg: msg ? msg.textContent.substring(0, 80) : '',
        rows: list ? list.querySelectorAll('.cf-row').length : 0,
      };
    });
    console.log('[*] Timeout final:', JSON.stringify(finalState));
  }

  // Step 8: 截图 + 报告
  await page.screenshot({path: 'tests/test_bm_02_results.png'});
  console.log('[*] Screenshot: results saved');

  var restLogs = logs.filter(function(l) {
    return l.indexOf('REST') >= 0 || l.indexOf('restapi') >= 0 || l.indexOf('CUQPS') >= 0;
  });
  console.log('[*] REST API logs (' + restLogs.length + '):');
  restLogs.slice(0, 10).forEach(function(l) { console.log('   ', l.substring(0, 150)); });

  console.log('\n' + '='.repeat(50));
  console.log('  RESULT');
  console.log('='.repeat(50));
  console.log('  UI appeared:    ' + (ui.barExists ? 'OK' : 'FAIL'));
  console.log('  Final btn:      ' + (finalState ? finalState.btnText : 'UNKNOWN'));
  console.log('  Final title:    ' + (finalState ? finalState.title : 'UNKNOWN'));
  console.log('  Final rows:     ' + (finalState ? finalState.rows : 'UNKNOWN'));
  console.log('  Final msg:      ' + (finalState ? finalState.msg : 'UNKNOWN'));

  if (finalState && finalState.rows > 0) {
    console.log('\n  [OK] Bookmarklet works on amap.com!');
  } else if (finalState && finalState.rows === 0 && finalState.btnText.indexOf('搜索') < 0) {
    console.log('\n  [FAIL] Search completed but 0 results');
  } else {
    console.log('\n  [WARN] Inconclusive');
  }

  await browser.close();
})();
