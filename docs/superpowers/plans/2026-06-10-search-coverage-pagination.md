# 搜索覆盖 + 分页 + UI 改进 实现计划

> **面向 AI 代理的工作者：** 使用 superpowers:subagent-driven-development 或 superpowers:executing-plans 逐任务实现。步骤使用复选框（`- [ ]`）语法跟踪进度。

**目标：** 扩大搜索覆盖（网格搜索）、结果分页、标记开关、Favicon — 全部在 index.html 一个文件内改动。

**架构：** 纯前端单文件 HTML，高德地图 JS API 负责地图渲染，REST API 负责公司搜索。改动集中在搜索策略层（`startSearch`）和展示层（`renderList`/`addMarkers`），评分逻辑不变。

**技术栈：** HTML/CSS/JS，高德地图 JS API 2.0 + REST API v3

---

## 改动文件清单

| 文件 | 职责 | 改动类型 |
|------|------|----------|
| `gh-pages-deploy/index.html` | 所有功能 | 修改（4 处插入 + CSS 新增 + 逻辑重写） |

**不改动：** `map_selector.html`（原文件后续单独同步）

---

### 任务 1：Favicon — 内联 SVG 图标

**文件：**
- 修改：`gh-pages-deploy/index.html:4`（`</head>` 前插入 `<link rel="icon">`）

- [ ] **步骤 1：在 `<meta charset>` 后面插入 favicon 链接**

在第 5 行 `</head>` 前（即 `<meta name="viewport">` 后）插入：

```html
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='%231677ff'/><path d='M32 12 C22 12 14 20 14 30 C14 42 32 56 32 56 C32 56 50 42 50 30 C50 20 42 12 32 12 Z M32 36 C28.7 36 26 33.3 26 30 C26 26.7 28.7 24 32 24 C35.3 24 38 26.7 38 30 C38 33.3 35.3 36 32 36 Z' fill='white'/><rect x='20' y='48' width='24' height='4' rx='2' fill='white' opacity='0.8'/></svg>">
```

- [ ] **步骤 2：在浏览器中打开 index.html 验证标签页图标出现**

- [ ] **步骤 3：Commit**

```bash
git add gh-pages-deploy/index.html
git commit -m "feat: add inline SVG favicon (map pin + building)"
```

---

### 任务 2：工具栏 — 标记开关按钮

**文件：**
- 修改：`gh-pages-deploy/index.html:136`（`#bar` 内 btnHome 后插入按钮）
- 修改：CSS 区域新增 `.btn-marker` 样式
- 修改：JS 区域新增 `toggleMarkers()` + `updateMarkersVisibility()`

- [ ] **步骤 1：在工具栏中插入标记开关按钮**

在 `</div>` (id=bar 结尾，btnHome 的 `</button>` 后) 插入：

```html
  <span class="sep">|</span>
  <button class="btn-marker on" id="btnMarker">显示标记 &#10003;</button>
```

- [ ] **步骤 2：CSS 新增按钮样式**

在 `<style>` 的 `.btn-home` 样式后（约第 30 行）添加：

```css
.btn-marker{background:#f5f5f5;color:#333;border:1px solid #e0e0e0!important;font-size:11px!important}
.btn-marker.on{background:#52c41a;color:#fff;border-color:#52c41a!important}
```

- [ ] **步骤 3：JS 新增状态变量 + 事件处理**

在 JS 区块的状态变量区域（約第 406 行 `var markers = [];` 后）添加：

```js
var showMarkers = true;
```

在按钮事件绑定区域（约第 348 行 `btnHome.onclick` 前）插入：

```js
// 标记开关
document.getElementById('btnMarker').onclick = function() {
  if (isSearching) return;
  showMarkers = !showMarkers;
  var btn = document.getElementById('btnMarker');
  if (showMarkers) {
    btn.classList.add('on');
    btn.innerHTML = '显示标记 &#10003;';
    if (allResults.length) addMarkers(getCurrentPage());
  } else {
    btn.classList.remove('on');
    btn.innerHTML = '显示标记 ✗';
    clearMarkers();
  }
};
```

- [ ] **步骤 4：修改 `addMarkers` 函数，开头加开关守卫**

在 `addMarkers(results)` 函数体第一行（约第 935 行），`clearMarkers()` 之前插入：

```js
if (!showMarkers) { clearMarkers(); return; }
```

- [ ] **步骤 5：修改 sortResults 中的 addMarkers 调用**

将第 925 行的 `renderList(sorted); addMarkers(sorted);` 改为：

```js
renderList(sorted);
if (showMarkers) { addMarkers(getCurrentPage()); } else { clearMarkers(); }
```

- [ ] **步骤 6：验证 — 打开页面，按标记开关按钮，确认标记显隐正常**

- [ ] **步骤 7：Commit**

```bash
git add gh-pages-deploy/index.html
git commit -m "feat: add marker toggle button to show/hide company markers"
```

---

### 任务 3：网格搜索 — 扩大覆盖

**文件：**
- 修改：`gh-pages-deploy/index.html:671-765`（`startSearch` 函数及调用处）

这是核心改动。需要重写 `startSearch` 调用方式和内部逻辑。

- [ ] **步骤 1：修改 search plans 生成逻辑（行政区模式）**

将第 617-651 行（`districts.forEach` 中的 plan push 逻辑）替换。每个区生成 3×3 网格点：

原来的：
```js
if (!plans.some(function(p) { return p.label === d; })) {
  plans.push({label: d, lng: loc.lng, lat: loc.lat, radius: 25000});
}
```

改为（为每个区生成 9 个网格搜索点）：

```js
if (!plans.some(function(p) { return p.label === d; })) {
  // 3×3 网格，每个格点间距 0.11°（约 12km），半径 15km 保证重叠覆盖
  var offsets = [-0.11, 0, 0.11];
  for (var gi = 0; gi < offsets.length; gi++) {
    for (var gj = 0; gj < offsets.length; gj++) {
      plans.push({
        label: d + '#' + (gi*3+gj+1),
        lng: loc.lng + offsets[gi],
        lat: loc.lat + offsets[gj],
        radius: 15000
      });
    }
  }
}
```

- [ ] **步骤 2：重写 `startSearch` 函数**

将第 671-765 行的 `startSearch` 函数整体替换为以下新版本：

```js
function startSearch(plans) {
  if (searchCancelled) { searchDone(); return; }
  if (!plans.length) { searchDone(); return; }

  var WS_KEY = 'b756c2d47e44c7a36768bd8f2d2d7665';
  var PAGE_SIZE = 25, MAX_PAGES = 20, FETCH_DELAY = 300;
  var all = [], seen = {};
  var planIdx = 0, currentPage = 1, pagesNeeded = 1;
  var totalPagesEstimate = 0, pagesFetched = 0;
  var finished = false;
  var KEYWORDS = encodeURIComponent('公司|工厂|企业|科技|工程|制造|商贸|机械|物流');
  var timeout = 120000; // 网格点多，延长超时

  document.getElementById('tip').textContent = 'REST API 网格搜索 ' + plans.length + ' 点...';
  document.getElementById('progText').textContent = '查询中...';

  function fetchNextPage() {
    if (finished || searchCancelled || planIdx >= plans.length) {
      if (!finished) finishUp();
      return;
    }
    var plan = plans[planIdx];
    var url = 'https://restapi.amap.com/v3/place/around?key=' + WS_KEY +
      '&location=' + plan.lng.toFixed(6) + ',' + plan.lat.toFixed(6) +
      '&radius=' + plan.radius +
      '&keywords=' + KEYWORDS +
      '&offset=' + PAGE_SIZE + '&page=' + currentPage + '&extensions=all';

    console.log('REST fetch', plan.label, 'p' + currentPage, 'r=' + plan.radius);

    fetch(url).then(function(r) { return r.json(); }).then(function(data) {
      if (finished || searchCancelled) return;
      pagesFetched++;
      if (data.status === '1' && data.pois) {
        data.pois.forEach(function(poi) {
          var key = (poi.name || '') + '|' + (poi.address || '');
          if (!seen[key]) { seen[key] = true; all.push(poi); }
        });
      }
      if (currentPage === 1) {
        var count = parseInt(data.count) || 0;
        pagesNeeded = Math.min(Math.ceil(count / PAGE_SIZE), MAX_PAGES);
        totalPagesEstimate += pagesNeeded;
      }
      var pct = totalPagesEstimate > 0 ? Math.min(100, Math.round(pagesFetched / totalPagesEstimate * 100)) : 0;
      document.getElementById('progFill').style.width = pct + '%';
      document.getElementById('progText').textContent = pagesFetched + '/' + totalPagesEstimate + ' 页 ' + all.length + '家';
      document.getElementById('tip').textContent = plan.label + ' p' + currentPage + ' ' +
        (data.status === '1' ? 'OK' : 'err') + ' [' + all.length + ']';
      currentPage++;
      if (currentPage > pagesNeeded) { planIdx++; currentPage = 1; pagesNeeded = 1; }
      setTimeout(fetchNextPage, FETCH_DELAY);
    }).catch(function(err) {
      console.log('REST err:', err.message);
      pagesFetched++; currentPage++;
      if (currentPage > pagesNeeded) { planIdx++; currentPage = 1; pagesNeeded = 1; }
      setTimeout(fetchNextPage, FETCH_DELAY);
    });
  }
  fetchNextPage();

  var fallbackTimer = setTimeout(function() {
    if (!finished) { console.log('REST timeout'); finishUp(); }
  }, timeout);

  function finishUp() {
    if (finished) return; finished = true; clearTimeout(fallbackTimer);
    document.getElementById('progText').textContent = all.length + ' 家，打分...';
    var scored = [];
    var errCount = 0;
    for (var i = 0; i < all.length; i++) {
      try { scored.push(score(all[i])); } catch(e) {
        errCount++;
        if (errCount <= 3) console.log('score error[' + i + ']:', e.message);
      }
    }
    if (errCount) console.log('Total score errors:', errCount, '/', all.length);
    scored.sort(function(a, b) { return b.total - a.total; });
    allResults = scored;
    currentPageNum = 1;
    try {
      renderPage(1);
      if (showMarkers) { addMarkers(getCurrentPage()); }
    } catch(e) {
      console.log('render error:', e.message);
      document.getElementById('resList').innerHTML = '<div style="padding:20px;color:red">渲染错误: ' + e.message + '</div>';
    }
    document.getElementById('btnCsv').disabled = (scored.length === 0);
    document.getElementById('tip').textContent = scored.length ?
      '[OK] ' + scored.length + ' 家 | 综合排序 | 点击看详情' :
      '0结果 - REST API无返回';
    searchDone();
  }
}
```

- [ ] **步骤 3：修改非行政区模式的 startSearch 调用**

第 669 行的 `startSearch(plans);` 也受新函数覆盖，但非 dist 模式仍是单点搜索。需要在第 667-668 行之间，`plans.forEach` 之前，将单点的 radius 改为 15000（与网格一致），并给计划点加 label：

将第 668 行：
```js
plans.forEach(function(p) { p.radius = Math.min(50000, Math.max(1000, Math.round(p.radius))); });
```

改为：
```js
plans.forEach(function(p, i) { 
  p.label = (p.label || 'search') + (plans.length > 1 ? '#' + (i+1) : '');
  p.radius = Math.min(50000, Math.max(1000, Math.round(p.radius))); 
});
```

- [ ] **步骤 4：验证 — 搜索黄岛区，对比改动前后的结果数量，确认数量明显增加**

- [ ] **步骤 5：Commit**

```bash
git add gh-pages-deploy/index.html
git commit -m "feat: replace single-point search with 3x3 grid search, remove type filter, add keywords"
```

---

### 任务 4：分页 — 底部翻页栏

**文件：**
- 修改：`gh-pages-deploy/index.html:153-157`（`#resBody` 底部插入分页容器）
- 修改：CSS 新增分页样式
- 修改：JS 新增分页变量 + `renderPage()` / `renderPagination()` / `getCurrentPage()`

- [ ] **步骤 1：HTML 插入分页容器**

在 `#resBody` 的 `</div>` 前（第 157 行 `#resList` 后面）插入：

```html
    <div id="pagination" style="display:none"></div>
```

- [ ] **步骤 2：CSS 新增分页样式**

在 `</style>` 前插入：

```css
/* ===== 分页 ===== */
.pager{display:flex;gap:4px;justify-content:center;align-items:center;padding:8px 4px;border-top:1px solid #f0f0f0;flex-shrink:0}
.pager button{padding:4px 10px;border:1px solid #d9d9d9;border-radius:4px;background:#fff;cursor:pointer;font-size:11px;color:#333;min-width:28px}
.pager button.on{background:#1677ff;color:#fff;border-color:#1677ff}
.pager button:disabled{color:#ccc;cursor:not-allowed;background:#f5f5f5}
.pager .pg-info{font-size:11px;color:#999;margin:0 4px}
```

- [ ] **步骤 3：JS 新增分页变量和函数**

在状态变量区（约第 406 行，`var markers = [];` 后）添加：

```js
var currentPageNum = 1;
var PAGE_SIZE_DISPLAY = 50;
```

在 JS 尾部（第 1069 行 `esc` 函数前）插入以下三个函数：

```js
function getCurrentPage() {
  var start = (currentPageNum - 1) * PAGE_SIZE_DISPLAY;
  return allResults.slice(start, start + PAGE_SIZE_DISPLAY);
}

function renderPage(pageNum) {
  currentPageNum = pageNum;
  var totalPages = Math.ceil(allResults.length / PAGE_SIZE_DISPLAY);
  if (totalPages < 1) totalPages = 1;
  if (pageNum > totalPages) pageNum = totalPages;
  if (pageNum < 1) pageNum = 1;
  currentPageNum = pageNum;

  var pageData = getCurrentPage();
  renderList(pageData, (pageNum - 1) * PAGE_SIZE_DISPLAY);
  renderPagination();
}

function renderPagination() {
  var totalPages = Math.ceil(allResults.length / PAGE_SIZE_DISPLAY);
  var el = document.getElementById('pagination');
  if (totalPages <= 1) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.className = 'pager';

  var html = '';
  // 上一页
  html += '<button ' + (currentPageNum <= 1 ? 'disabled' : 'onclick="renderPage(' + (currentPageNum - 1) + ')"') + '>&lt;</button>';

  // 页码按钮
  var startP = Math.max(1, currentPageNum - 3);
  var endP = Math.min(totalPages, currentPageNum + 3);
  if (startP > 1) {
    html += '<button onclick="renderPage(1)">1</button>';
    if (startP > 2) html += '<span class="pg-info">...</span>';
  }
  for (var p = startP; p <= endP; p++) {
    html += '<button class="' + (p === currentPageNum ? 'on' : '') + '" onclick="renderPage(' + p + ')">' + p + '</button>';
  }
  if (endP < totalPages) {
    if (endP < totalPages - 1) html += '<span class="pg-info">...</span>';
    html += '<button onclick="renderPage(' + totalPages + ')">' + totalPages + '</button>';
  }

  // 下一页
  html += '<button ' + (currentPageNum >= totalPages ? 'disabled' : 'onclick="renderPage(' + (currentPageNum + 1) + ')"') + '>&gt;</button>';
  html += '<span class="pg-info">共 ' + allResults.length + ' 条</span>';

  el.innerHTML = html;
}
```

- [ ] **步骤 4：修改 `renderList` 函数支持序号偏移**

将 `renderList(results)` 函数签名改为 `renderList(results, startIndex)`，第 975 行：

```js
function renderList(results, startIndex) {
```

并把第 989 行序号从 `(i + 1)` 改为 `(startIndex + i + 1)`：

```js
'<div class="rt"><span class="rn">' + (startIndex + i + 1) + '. ' + esc(r.name) +
```

参数 `startIndex` 默认为 0（第 975 行改为）：

```js
function renderList(results, startIndex) {
  if (typeof startIndex === 'undefined') startIndex = 0;
```

- [ ] **步骤 5：修改所有 `renderList` 调用点，改用 `renderPage`**

替换第 754 行的 `renderList(scored)`:
```js
renderPage(1);
```

替换第 925 行 `sortResults` 中的 `renderList(sorted)` 为：
```js
currentPageNum = 1;
renderPage(1);
```

- [ ] **步骤 6：翻页时联动地图标记**

在 `renderPage` 函数末尾，`renderPagination()` 调用后添加：

```js
if (showMarkers) { addMarkers(getCurrentPage()); } else { clearMarkers(); }
```

- [ ] **步骤 7：验证 — 搜索确认有足够结果后，翻页按钮出现，切换页正常，地图标记随页码更新**

- [ ] **步骤 8：Commit**

```bash
git add gh-pages-deploy/index.html
git commit -m "feat: add pagination with 50 items per page and bottom navigation"
```

---

### 任务 5：集成测试 + 推送

- [ ] **步骤 1：本地打开 index.html，搜索黄岛区，验证：**
  - 搜索点数从 1 变为 9（提示信息中可见）
  - 结果数量比之前明显增加
  - 翻页栏出现
  - 标记开关正常工作
  - 图标显示在页签名

- [ ] **步骤 2：推送 + 同步原文件**

```bash
git push
cp gh-pages-deploy/index.html map_selector.html
git add map_selector.html
git commit -m "chore: sync map_selector.html with deployed version"
```

- [ ] **步骤 3：等待 1 分钟后，访问在线地址验证**

打开 https://lvchongjun123-bot.github.io/qingdao-company-finder/ 确认功能正常。
