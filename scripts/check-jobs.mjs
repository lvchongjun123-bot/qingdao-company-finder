// scripts/check-jobs.mjs
import http from 'node:http';
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 23334;
const CACHE_FILE = path.join(__dirname, 'jobs-cache.json');
const PROFILE_DIR = path.join(__dirname, '.browser-profile');
const CONCURRENCY = 3;
const SOURCE_TIMEOUT = 8000;
const COMPANY_TIMEOUT = 30000;

// 加载缓存
let cache = {};
if (fs.existsSync(CACHE_FILE)) {
  try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8')); } catch(e) {}
}

function saveCache() {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function cached(name) {
  const day = todayKey();
  return cache[name] && cache[name]._day === day ? cache[name] : null;
}

function setCache(name, result) {
  cache[name] = { ...result, _day: todayKey() };
  saveCache();
}

// CORS 头
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

async function checkAllSources(page, name, result) {
  // 1. BOSS直聘
  try {
    await Promise.race([
      (async () => {
        await page.goto(`https://www.zhipin.com/web/geek/job?query=${encodeURIComponent(name)}&city=101120200`, { waitUntil: 'domcontentloaded', timeout: SOURCE_TIMEOUT });
        await new Promise(r => setTimeout(r, 2000));
        const count = await page.evaluate(() => {
          const items = document.querySelectorAll('.job-card-wrap, .job-card-body, li[class*="job"]');
          let n = 0;
          items.forEach(el => {
            const text = el.textContent || '';
            if (!/20(0\d|1\d|2[0-5])[^\d]/.test(text)) n++;
          });
          return n;
        });
        result.sources.boss = { status: count > 0 ? 'found' : 'not_found', count };
      })(),
      new Promise(r => setTimeout(() => r('timeout'), SOURCE_TIMEOUT))
    ]);
  } catch(e) {
    result.sources.boss = { status: 'error', reason: (e.message || 'timeout').slice(0, 80) };
  }

  // 2. 51job
  try {
    await Promise.race([
      (async () => {
        await page.goto(`https://we.51job.com/pc/search?keyword=${encodeURIComponent(name)}&area=370200`, { waitUntil: 'domcontentloaded', timeout: SOURCE_TIMEOUT });
        await new Promise(r => setTimeout(r, 2000));
        const count = await page.evaluate(() => {
          const items = document.querySelectorAll('.joblist-item, .j_joblist > div, .e');
          let n = 0;
          items.forEach(el => {
            const text = el.textContent || '';
            if (!/20(0\d|1\d|2[0-5])[^\d]/.test(text)) n++;
          });
          return n;
        });
        result.sources['51job'] = { status: count > 0 ? 'found' : 'not_found', count };
      })(),
      new Promise(r => setTimeout(() => r('timeout'), SOURCE_TIMEOUT))
    ]);
  } catch(e) {
    result.sources['51job'] = { status: 'error', reason: (e.message || 'timeout').slice(0, 80) };
  }

  // 3. 智联招聘
  try {
    await Promise.race([
      (async () => {
        await page.goto(`https://sou.zhaopin.com/?jl=698&kw=${encodeURIComponent(name)}`, { waitUntil: 'domcontentloaded', timeout: SOURCE_TIMEOUT });
        await new Promise(r => setTimeout(r, 2000));
        const count = await page.evaluate(() => {
          const items = document.querySelectorAll('.positionlist .contentpile__content, .joblist-box__item');
          let n = 0;
          items.forEach(el => {
            const text = el.textContent || '';
            if (!/20(0\d|1\d|2[0-5])[^\d]/.test(text)) n++;
          });
          return n;
        });
        result.sources.zhilian = { status: count > 0 ? 'found' : 'not_found', count };
      })(),
      new Promise(r => setTimeout(() => r('timeout'), SOURCE_TIMEOUT))
    ]);
  } catch(e) {
    result.sources.zhilian = { status: 'error', reason: (e.message || 'timeout').slice(0, 80) };
  }

  // 4. 公司官网
  if (result._website) {
    try {
      await Promise.race([
        (async () => {
          const url = result._website.startsWith('http') ? result._website : 'http://' + result._website;
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: SOURCE_TIMEOUT });
          const hasCareer = await page.evaluate(() => {
            const careerKeys = /招聘|加入我们|人才招聘|career|job|招贤|纳士/i;
            const links = document.querySelectorAll('a');
            for (const a of links) {
              if (careerKeys.test(a.textContent) || careerKeys.test(a.href)) return true;
            }
            return careerKeys.test(document.body.textContent || '');
          });
          result.sources.website = { status: hasCareer ? 'found' : 'not_found' };
        })(),
        new Promise(r => setTimeout(() => r('timeout'), SOURCE_TIMEOUT))
      ]);
    } catch(e) {
      result.sources.website = { status: 'error', reason: (e.message || 'timeout').slice(0, 80) };
    }
  }

  // 5. 青岛人才网招聘E站
  try {
    await Promise.race([
      (async () => {
        await page.goto('https://fw.rc.qingdao.gov.cn/', { waitUntil: 'domcontentloaded', timeout: SOURCE_TIMEOUT });
        await new Promise(r => setTimeout(r, 1500));
        const input = await page.$('input[type="text"], input[placeholder*="搜索"], input[placeholder*="公司"], input[placeholder*="关键字"]');
        if (input) {
          await input.click({ clickCount: 3 });
          await input.type(name);
          await page.keyboard.press('Enter');
          await new Promise(r => setTimeout(r, 2000));
        }
        const count = await page.evaluate(() => {
          const items = document.querySelectorAll('[class*="job"], [class*="position"], [class*="post"], [class*="item"]');
          let n = 0;
          items.forEach(el => {
            const text = el.textContent || '';
            if (!/2025[^\d]/.test(text) && text.length > 20) n++;
          });
          return n;
        });
        result.sources.qdrczp = { status: count > 0 ? 'found' : 'not_found', count };
      })(),
      new Promise(r => setTimeout(() => r('timeout'), SOURCE_TIMEOUT))
    ]);
  } catch(e) {
    result.sources.qdrczp = { status: 'error', reason: (e.message || 'timeout').slice(0, 80) };
  }

  // 6. 青岛本地宝
  try {
    await Promise.race([
      (async () => {
        await page.goto(`https://www.baidu.com/s?wd=${encodeURIComponent(name + ' 招聘 site:qd.bendibao.com')}`, { waitUntil: 'domcontentloaded', timeout: SOURCE_TIMEOUT });
        await new Promise(r => setTimeout(r, 1500));
        const count = await page.evaluate(() => {
          const results = document.querySelectorAll('.result, .c-result');
          let n = 0;
          results.forEach(el => {
            const text = el.textContent || '';
            if (!/20(0\d|1\d|2[0-5])[^\d]/.test(text)) n++;
          });
          return n > 0 ? 1 : 0;
        });
        result.sources.bendibao = { status: count > 0 ? 'found' : 'not_found', count };
      })(),
      new Promise(r => setTimeout(() => r('timeout'), SOURCE_TIMEOUT))
    ]);
  } catch(e) {
    result.sources.bendibao = { status: 'error', reason: (e.message || 'timeout').slice(0, 80) };
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end(); return;
  }
  if (req.method !== 'POST' || req.url !== '/check') {
    res.writeHead(404, corsHeaders());
    res.end('Not found'); return;
  }

  let body = '';
  req.on('data', c => body += c);
  req.on('end', async () => {
    let names = [];
    try { names = JSON.parse(body); } catch(e) {
      res.writeHead(400, { ...corsHeaders(), 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' })); return;
    }

    const results = {};
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        userDataDir: PROFILE_DIR,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    } catch(e) {
      res.writeHead(500, { ...corsHeaders(), 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Browser launch failed: ' + e.message })); return;
    }

    try {
      const queue = names.slice();
      const running = [];

      async function processOne(item) {
        // item 可以是字符串(name)或对象{name, website}
        const name = typeof item === 'string' ? item : item.name;
        const website = typeof item === 'object' ? (item.website || '') : '';

        const hit = cached(name);
        if (hit) { results[name] = hit; return; }

        const page = await browser.newPage();
        const result = { status: 'not_found', sources: {} };

        try {
          // 注入 website 信息供官网查询用
          result._website = website;
          await Promise.race([
            checkAllSources(page, name, result),
            new Promise(r => setTimeout(() => r('timeout'), COMPANY_TIMEOUT))
          ]);
        } catch(e) {
          // 超时不处理，result 保留已查到的部分
        }

        delete result._website;

        // 综合判定
        const hasFound = Object.values(result.sources).some(s => s.status === 'found');
        const hasError = Object.values(result.sources).some(s => s.status === 'error');
        result.status = hasFound ? 'hiring' : (hasError ? 'uncertain' : 'not_found');

        setCache(name, result);
        results[name] = result;
        await page.close();
      }

      while (queue.length > 0) {
        while (running.length < CONCURRENCY && queue.length > 0) {
          const name = queue.shift();
          const p = processOne(name).then(() => {
            running.splice(running.indexOf(p), 1);
          });
          running.push(p);
        }
        if (running.length >= CONCURRENCY) {
          await Promise.race(running);
        }
      }
      await Promise.all(running);
    } finally {
      await browser.close();
    }

    res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json' });
    res.end(JSON.stringify(results));
  });
});

server.listen(PORT, () => {
  console.log(`[check-jobs] listening on http://localhost:${PORT}`);
});
