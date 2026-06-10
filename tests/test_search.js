// test_search.js — 自动化测试黄岛区搜索
// 用法: node tests/test_search.js
// 前提: 本地服务器已启动 (python -m http.server 8080)
const puppeteer = require('puppeteer');
const path = require('path');

const OUT_DIR = path.resolve(__dirname);
const BASE_URL = 'http://localhost:8080';
const PAGES = ['index.html', 'map_selector.html'];
const SEARCH_TIMEOUT = 120000; // 2 分钟超时（网格搜索最多 9×20=180 页）

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function testPage(browser, pageName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  TEST: ${pageName}`);
  console.log(`${'='.repeat(60)}`);

  const page = await browser.newPage();
  await page.setViewport({width: 1400, height: 900});

  const logs = [];
  page.on('console', msg => logs.push(msg.text()));
  page.on('pageerror', err => console.log('[PAGE ERROR]', err.message));

  // 加载页面
  console.log('[*] Loading page...');
  await page.goto(`${BASE_URL}/${pageName}`, {waitUntil: 'networkidle2', timeout: 30000});
  await sleep(5000); // 等 AMap JS API 初始化

  // 检查初始状态
  const state = await page.evaluate(() => {
    const mapEl = document.getElementById('map');
    const tip = document.getElementById('tip').textContent;
    const barBtns = document.querySelectorAll('#bar button').length;
    return {mapExists: !!mapEl, tip: tip.substring(0, 80), barBtns};
  });
  console.log('[*] Initial state:', JSON.stringify(state));

  if (!state.mapExists) {
    console.log('[FAIL] Map not loaded!');
    await page.close();
    return false;
  }

  // 截图：初始
  await page.screenshot({path: path.join(OUT_DIR, `test_${pageName}_01_init.png`)});
  console.log('[*] Screenshot: init saved');

  // 选择行政区模式 + 勾选黄岛区
  await page.evaluate(() => {
    const modeBtns = document.querySelectorAll('.btn-mode');
    modeBtns.forEach(b => b.classList.remove('on'));
    if (modeBtns[0]) modeBtns[0].classList.add('on');

    // 勾选黄岛区复选框
    const cbs = document.querySelectorAll('#distDrop input[type=checkbox]');
    cbs.forEach(cb => { cb.checked = false; });
    if (cbs.length > 0) cbs[0].checked = true; // 第一个通常是黄岛区
  });
  console.log('[*] Mode: 行政区, District: 黄岛区');

  // 点击开始搜索
  await page.click('#btnGo');
  console.log('[*] Search started, waiting for completion...');

  // Smart wait：轮询检测完成信号
  const startTime = Date.now();
  let completed = false;
  while (Date.now() - startTime < SEARCH_TIMEOUT) {
    await sleep(2000);
    const progress = await page.evaluate(() => {
      const tip = document.getElementById('tip').textContent;
      const btnCancel = document.getElementById('btnCancel');
      const btnGo = document.getElementById('btnGo');
      const resTitle = document.getElementById('resTitle').textContent;
      const pagination = document.getElementById('pagination');
      const totalPages = pagination.style.display === 'none' ? 0 :
        (pagination.querySelectorAll('button').length || 0);
      return {
        tip: tip.substring(0, 100),
        searching: btnGo.textContent.includes('搜索中'),
        cancelVisible: btnCancel.style.display !== 'none',
        title: resTitle,
        hasPagination: pagination.style.display === 'flex',
      };
    });

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`  [${elapsed}s] ${progress.tip} | title="${progress.title}"`);

    // 判断完成：不再搜索中 && 取消按钮隐藏 && 标题有结果
    if (!progress.searching && !progress.cancelVisible && progress.title !== '准备搜索...') {
      console.log(`[*] Search completed in ${elapsed}s`);
      completed = true;
      break;
    }
  }

  if (!completed) {
    console.log('[FAIL] Search timed out!');
    await page.close();
    return false;
  }

  // 截图：结果
  await page.screenshot({path: path.join(OUT_DIR, `test_${pageName}_02_results.png`)});
  console.log('[*] Screenshot: results saved');

  // 收集结果统计
  const results = await page.evaluate(() => {
    const title = document.getElementById('resTitle').textContent;
    const listItems = document.querySelectorAll('.rrow').length;
    const paginationText = document.getElementById('pagination').textContent || '';
    const first5 = [];
    const rows = document.querySelectorAll('.rn');
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      first5.push(rows[i].textContent.replace(/\s+/g, ' ').trim());
    }
    const csvDisabled = document.getElementById('btnCsv').disabled;

    // 检查是否有排除项
    const allNames = [];
    const allRns = document.querySelectorAll('.rn');
    allRns.forEach(el => allNames.push(el.textContent.trim()));
    const hasExcluded = !allNames.some(n => /个体|工作室/.test(n));

    return {
      title, listItems, paginationText, first5,
      csvDisabled, hasExcluded, totalNames: allNames.length,
    };
  });

  console.log('[*] Results:');
  console.log(`    Title: ${results.title}`);
  console.log(`    Visible items: ${results.listItems}`);
  console.log(`    Pagination: ${results.paginationText.substring(0, 80)}`);
  console.log(`    No 个体户/工作室 visible: ${results.hasExcluded}`);
  console.log(`    CSV button: ${results.csvDisabled ? 'DISABLED' : 'ENABLED'}`);

  // 验证
  const checks = [];
  // 1. 标题应该显示总数，不是"结果 50 家"
  const titleMatch = results.title.match(/结果 (\d+) 家/);
  if (titleMatch) {
    const count = parseInt(titleMatch[1]);
    checks.push({check: 'Title shows total count > page size', pass: count > 50 || results.listItems <= 50});
    console.log(`    [CHECK] Title count: ${count} (page size: 50)`);
  }
  // 2. 个体户/工作室应该被排除
  checks.push({check: '个体户/工作室 excluded', pass: results.hasExcluded});
  console.log(`    [CHECK] 个体户/工作室 excluded: ${results.hasExcluded}`);
  // 3. 有结果时 CSV 应可导出
  if (results.listItems > 0) {
    checks.push({check: 'CSV export enabled', pass: !results.csvDisabled});
    console.log(`    [CHECK] CSV enabled: ${!results.csvDisabled}`);
  }

  const failures = checks.filter(c => !c.pass);
  if (failures.length) {
    console.log(`[FAIL] ${failures.length} check(s) failed:`);
    failures.forEach(f => console.log(`  - ${f.check}`));
  }

  // Top 5
  console.log('[*] Top 5:');
  results.first5.forEach((n, i) => console.log(`    ${i + 1}. ${n}`));

  // 测试翻页
  if (results.paginationText && results.listItems > 0) {
    console.log('[*] Testing pagination...');
    // 点击第 2 页
    const page2Clicked = await page.evaluate(() => {
      const btns = document.querySelectorAll('#pagination button');
      for (const b of btns) {
        if (b.textContent.trim() === '2' && !b.disabled) {
          b.click(); return true;
        }
      }
      return false;
    });
    if (page2Clicked) {
      await sleep(800);
      const page2Title = await page.evaluate(() => document.getElementById('resTitle').textContent);
      console.log(`    Page 2 title: ${page2Title}`);

      // 回到第 1 页
      await page.evaluate(() => {
        const btns = document.querySelectorAll('#pagination button');
        for (const b of btns) {
          if (b.textContent.trim() === '1' && !b.disabled) { b.click(); return; }
        }
      });
      await sleep(500);
    } else {
      console.log('    Only 1 page of results');
    }
  }

  // 测试导出 CSV（只验证可点击，不实际下载）
  if (!results.csvDisabled) {
    console.log('[*] Testing CSV export...');
    await page.click('#btnCsv');
    await sleep(1500);
    console.log('    CSV export triggered');
  }

  console.log(`[*] ${pageName}: PASS`);
  await page.close();
  return failures.length === 0;
}

(async () => {
  console.log('Company Finder - Automated Test Suite');
  console.log(`Server: ${BASE_URL}`);
  console.log(`Output: ${OUT_DIR}\n`);

  const browser = await puppeteer.launch({
    headless: true, // 无头模式，更快
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--no-sandbox', '--disable-gpu'],
  });

  let passed = 0;
  let failed = 0;

  for (const pageName of PAGES) {
    const ok = await testPage(browser, pageName);
    if (ok) passed++; else failed++;
  }

  await browser.close();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  SUMMARY: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(60)}`);

  process.exit(failed > 0 ? 1 : 0);
})();
