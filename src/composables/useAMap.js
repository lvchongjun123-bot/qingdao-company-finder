import { ref, shallowRef, watch } from 'vue'
import { useAppStore } from '../stores/app'
import { useSearchStore } from '../stores/search'
import { calculateScore } from '../utils/scoring'

// 高德 REST API Key（Web Service，不同于 JS API Key）
const WS_KEY = 'b756c2d47e44c7a36768bd8f2d2d7665'
const REST_URL = 'https://restapi.amap.com/v3/place/around'

// 网格搜索参数
const GRID_RADIUS = 5000       // 每格搜索半径 5km
const PAGE_SIZE = 25           // REST API 每页条数
const MAX_PAGES = 8            // 每格最多翻页数
const FETCH_DELAY = 200        // 请求间隔 ms
const SEARCH_TYPES = '170000'  // 公司企业大类
const OVERFLOW_THRESHOLD = 200 // 溢出阈值（对齐 API 单格点 200 条上限），触发网格细分
const MAX_SUBDIVIDE = 1        // 最大细分层级（仅一层，防 API 调用爆炸）

// 青岛各区中心坐标 — 硬编码避免 Geocoder 异步回调不可靠
const DISTRICT_CENTERS = {
  '黄岛区': [120.14, 35.96],
  '市南区': [120.38, 36.06],
  '市北区': [120.37, 36.09],
  '李沧区': [120.42, 36.15],
  '崂山区': [120.46, 36.10],
  '城阳区': [120.39, 36.30],
  '即墨区': [120.44, 36.38],
  '胶州市': [120.03, 36.26],
  '平度市': [119.95, 36.78],
  '莱西市': [120.51, 36.86]
}

// 行政区网格偏移（9×9，间距 0.06°，半径 5km，避开 API 200 条截断）
const DISTRICT_OFFSETS = [-0.24, -0.18, -0.12, -0.06, 0, 0.06, 0.12, 0.18, 0.24]

let mapInstance = null
let mouseTool = null
let districtSearch = null

// 模块级共享状态 — 所有 useAMap() 调用共享同一份引用
const map = shallowRef(null)
const mapReady = ref(false)
const drawRect = shallowRef(null)
const drawCircle = shallowRef(null)
const districtPolygons = shallowRef([])
const districtBoundaries = shallowRef([])  // 行政区边界路径，供圈选过滤
const homeMarker = shallowRef(null)
const homeCircleRefs = shallowRef([])
const companyMarkers = shallowRef([])

// 确保 watcher 只注册一次
let watchersSetup = false

export function useAMap() {

  // --- 区变更自动重绘 ---
  if (!watchersSetup) {
    watchersSetup = true
    watch(() => {
      const app = useAppStore()
      return app.selectedDistricts.slice()
    }, () => {
      const app = useAppStore()
      if (app.mode === 'dist') drawDistricts()
    })
  }

  // --- 初始化地图 ---
  async function initMap(containerId) {
    const app = useAppStore()

    return new Promise((resolve) => {
      const el = document.getElementById(containerId)
      if (!el) { resolve(false); return }

      // 等待 AMap SDK 加载
      function waitForAMap(retries = 50) {
        if (window.AMap && window.AMap.Map) {
          createMap()
        } else if (retries > 0) {
          setTimeout(() => waitForAMap(retries - 1), 200)
        } else {
          console.error('AMap SDK failed to load')
          resolve(false)
        }
      }

      function createMap() {
        mapInstance = new window.AMap.Map(el, {
          zoom: 12,
          center: [app.homeLng, app.homeLat],
          mapStyle: 'amap://styles/normal',
          dragEnable: true,
          scrollWheel: true,
          doubleClickZoom: true
        })

        // 异步加载插件，完成后才 resolve
        mapInstance.plugin(['AMap.MouseTool', 'AMap.DistrictSearch'], () => {
          mouseTool = new window.AMap.MouseTool(mapInstance)
          districtSearch = new window.AMap.DistrictSearch({
            level: 'district',
            subdistrict: 0,
            extensions: 'all'
          })

          // 全局 draw 监听（只注册一次，匹配原版）
          mouseTool.on('draw', (e) => {
            clearUserDraw()
            const app = useAppStore()
            if (app.mode === 'rect') {
              drawRect.value = e.obj
              // 用 getter 方法而非属性访问（兼容所有 AMap 版本）
              const bounds = e.obj.getBounds()
              const sw = bounds.getSouthWest()
              const ne = bounds.getNorthEast()
              app.drawBounds = {
                sw: [sw.lng, sw.lat],
                ne: [ne.lng, ne.lat]
              }
              app.showToast('矩形已画好 — 点"开始搜索"')
            } else {
              drawCircle.value = e.obj
              const center = e.obj.getCenter()
              const radius = e.obj.getRadius()
              app.drawCenter = [center.lng, center.lat]
              app.drawRadius = radius
              app.showToast('圆形已画好(约' + (radius / 1000).toFixed(1) + 'km) — 点"开始搜索"')
            }
            mouseTool.close(false)
            // 显式确保 overlay 保留在地图上（部分AMap版本 close(false) 可能仍会清掉）
            if (drawRect.value) drawRect.value.setMap(mapInstance)
            if (drawCircle.value) drawCircle.value.setMap(mapInstance)
            mapInstance.setStatus({ dragEnable: true })
            app.isDrawing = false
          })

          map.value = mapInstance
          mapReady.value = true

          // 初始绘制行政区
          if (app.mode === 'dist') {
            drawDistricts()
          }

          resolve(true)
        })

        // 右键设家
        mapInstance.on('rightclick', (e) => {
          if (app.isSearching) return
          const p = e.lnglat
          app.setHome(p.lng, p.lat)
          updateHomeMarker()
          app.showToast(`家已更新: ${p.lng.toFixed(4)}, ${p.lat.toFixed(4)} | 搜索时距离以此为准`)
        })
      }

      // ESC 键取消绘制（全局）
      document.addEventListener('keydown', onEscKey)

      waitForAMap()
    })
  }

  // --- 家地址逆地理编码 ---
  function geocodeHome() {
    const app = useAppStore()
    if (!window.AMap || !window.AMap.Geocoder) return
    const geocoder = new window.AMap.Geocoder({ city: '青岛' })
    geocoder.getLocation(app.homeName, (status, result) => {
      if (status === 'complete' && result.info === 'OK' && result.geocodes.length > 0) {
        const loc = result.geocodes[0].location
        app.setHome(loc.lng, loc.lat, app.homeName)
      }
      updateHomeMarker()
    })
  }

  // --- 家标记 ---
  function updateHomeMarker() {
    const app = useAppStore()
    if (!mapInstance) return

    // 清除旧标记
    if (homeMarker.value) mapInstance.remove(homeMarker.value)
    homeCircleRefs.value.forEach(c => mapInstance.remove(c))

    // 新标记
    homeMarker.value = new window.AMap.Marker({
      position: [app.homeLng, app.homeLat],
      title: app.homeName,
      zIndex: 999,
      content: `<div style="background:#fff;border:2.5px solid #1677ff;border-radius:18px;padding:3px 10px;font-size:12px;font-weight:600;color:#1677ff;box-shadow:0 2px 8px rgba(22,119,255,.3);white-space:nowrap">🏠 ${app.homeName}</div>`,
      offset: new window.AMap.Pixel(-40, -20)
    })
    homeMarker.value.setMap(mapInstance)
  }

  // --- 模式切换 ---
  // opts.useMouseTool: 移动端传 false，避免 MouseTool 与自定义触摸绘制冲突
  function setMode(mode, { useMouseTool = true } = {}) {
    const app = useAppStore()
    app.setMode(mode)
    clearUserDraw()
    clearDistrictShapes()

    if (mouseTool) mouseTool.close(true)
    if (mapInstance) mapInstance.setStatus({ dragEnable: true })

    app.isDrawing = false

    if (mode === 'dist') {
      drawDistricts()
      app.showToast('行政区模式：勾选区域 → 点"开始搜索"')
    } else if (mode === 'rect') {
      if (useMouseTool) startRectDraw()
      app.isDrawing = true
      app.showToast('拉框模式：在地图上按住拖拽画矩形，松开完成。Esc取消')
    } else if (mode === 'circle') {
      if (useMouseTool) startCircleDraw()
      app.isDrawing = true
      app.showToast('画圆模式：在地图上按住拖拽画圆，松开完成。Esc取消')
    } else if (mode === 'view') {
      app.showToast('视野模式：移动/缩放地图到目标区域 → 点"开始搜索"搜当前屏幕内的公司')
    }
  }

  // --- 行政区绘制 ---
  function drawDistricts() {
    const app = useAppStore()
    clearDistrictShapes()

    if (!districtSearch) return

    // 重置边界缓存
    const allBoundaries = []

    let pending = app.selectedDistricts.length
    if (!pending) return

    app.selectedDistricts.forEach(name => {
      const fullName = name.indexOf('青岛') === 0 ? name : '青岛市' + name
      districtSearch.search(fullName, (status, result) => {
        pending--
        if (status !== 'complete') {
          if (!pending) districtBoundaries.value = allBoundaries
          return
        }
        const bounds = result.districtList?.[0]?.boundaries
        if (!bounds) {
          if (!pending) districtBoundaries.value = allBoundaries
          return
        }

        bounds.forEach(boundary => {
          // 存储原始路径用于点包含判断（需转成 [lng, lat] 格式）
          const path = boundary.map(p => [p.lng, p.lat])
          allBoundaries.push(path)

          const poly = new window.AMap.Polygon({
            path: boundary,
            strokeColor: '#ff8c00',
            strokeWeight: 3,
            strokeOpacity: 0.7,
            fillColor: '#ff8c00',
            fillOpacity: 0.1
          })
          poly.setMap(mapInstance)
          districtPolygons.value.push(poly)
        })

        if (!pending) districtBoundaries.value = allBoundaries
      })
    })
  }

  // --- 矩形绘制 ---
  function startRectDraw() {
    if (!mouseTool) return
    mouseTool.rectangle({
      strokeColor: '#1677ff',
      strokeWeight: 3,
      strokeOpacity: 0.8,
      fillColor: '#1677ff',
      fillOpacity: 0.12
    })
  }

  // --- 圆形绘制 ---
  function startCircleDraw() {
    if (!mouseTool) return
    mouseTool.circle({
      strokeColor: '#1677ff',
      strokeWeight: 3,
      strokeOpacity: 0.8,
      fillColor: '#1677ff',
      fillOpacity: 0.12
    })
  }

  // --- 清除绘制对象（不清 isDrawing，由调用方控制）---
  function clearUserDraw() {
    const app = useAppStore()
    if (drawRect.value) { mapInstance && mapInstance.remove(drawRect.value); drawRect.value = null }
    if (drawCircle.value) { mapInstance && mapInstance.remove(drawCircle.value); drawCircle.value = null }
    app.clearDraw()
  }

  function clearDistrictShapes() {
    districtPolygons.value.forEach(p => mapInstance.remove(p))
    districtPolygons.value = []
    districtBoundaries.value = []
  }

  // --- ESC 取消绘制（对齐原版：任何时候都取消绘制，但不中断搜索）---
  function onEscKey(e) {
    if (e.key !== 'Escape') return
    const app = useAppStore()
    if (mouseTool) mouseTool.close(true)
    if (mapInstance) mapInstance.setStatus({ dragEnable: true })
    clearUserDraw()
    app.isDrawing = false
    app.showToast('已取消。可自由移动地图，选模式后操作')
  }

  // --- 取消绘制（供外部调用）---
  function cancelDrawing() {
    const app = useAppStore()
    if (mouseTool) mouseTool.close(true)
    if (mapInstance) mapInstance.setStatus({ dragEnable: true })
    clearUserDraw()
    app.isDrawing = false
  }

  // --- 视野范围 ---
  function getViewBounds() {
    if (!mapInstance) return null
    const bounds = mapInstance.getBounds()
    const sw = bounds.getSouthWest()
    const ne = bounds.getNorthEast()
    return {
      sw: [sw.lng, sw.lat],
      ne: [ne.lng, ne.lat]
    }
  }

  // --- 生成网格计划 ---
  function generateGridPlans(bounds, label) {
    const sw = bounds.sw, ne = bounds.ne
    const RADIUS = 15000
    const spacing = 2 * RADIUS * 0.7 / 111000
    const lngSpan = ne[0] - sw[0]
    const latSpan = ne[1] - sw[1]
    const cols = Math.max(1, Math.min(8, Math.ceil(lngSpan / spacing)))
    const rows = Math.max(1, Math.min(8, Math.ceil(latSpan / spacing)))
    const plans = []
    const cellLng = cols > 1 ? lngSpan / cols : 0
    const cellLat = rows > 1 ? latSpan / rows : 0
    const tag = label + (cols * rows > 1 ? '#' : '')
    for (let ci = 0; ci < cols; ci++) {
      for (let ri = 0; ri < rows; ri++) {
        plans.push({
          label: tag + (cols * rows > 1 ? (ci * rows + ri + 1) : ''),
          lng: sw[0] + cellLng * (ci + 0.5),
          lat: sw[1] + cellLat * (ri + 0.5),
          radius: RADIUS
        })
      }
    }
    return plans
  }

  // --- REST API 单页请求 ---
  async function fetchOnePage(plan, pageNum) {
    const url = `${REST_URL}?key=${WS_KEY}&location=${plan.lng.toFixed(6)},${plan.lat.toFixed(6)}&radius=${plan.radius}&types=${SEARCH_TYPES}&offset=${PAGE_SIZE}&page=${pageNum}&extensions=all`
    try {
      const resp = await fetch(url)
      const data = await resp.json()
      if (data.status === '1' && data.pois) {
        return { pois: data.pois, count: parseInt(data.count) || 0 }
      }
      return null
    } catch (e) {
      console.warn('REST fetch error:', plan.label, e.message)
      return null
    }
  }

  // --- 解析 REST API 返回的 POI ---
  function parseRestPoi(poi) {
    // REST API location 是 "lng,lat" 字符串
    let lng = null, lat = null
    if (poi.location) {
      if (typeof poi.location === 'string') {
        const parts = poi.location.split(',')
        lng = parseFloat(parts[0])
        lat = parseFloat(parts[1])
      } else {
        lng = poi.location.lng
        lat = poi.location.lat
      }
    }
    // 归一化字段（REST API 可能返回数组）
    const name = (typeof poi.name === 'string') ? poi.name : (Array.isArray(poi.name) ? poi.name[0] || '' : '')
    const address = (typeof poi.address === 'string') ? poi.address : (Array.isArray(poi.address) ? poi.address[0] || '' : '')
    const tel = (typeof poi.tel === 'string') ? poi.tel : (Array.isArray(poi.tel) && poi.tel.length > 0 ? String(poi.tel[0]) : '')
    const website = (typeof poi.website === 'string') ? poi.website : (Array.isArray(poi.website) && poi.website.length > 0 ? String(poi.website[0]) : '')
    const email = (typeof poi.email === 'string') ? poi.email : (Array.isArray(poi.email) && poi.email.length > 0 ? String(poi.email[0]) : '')
    const bizType = (typeof poi.biz_type === 'string') ? poi.biz_type : (Array.isArray(poi.biz_type) ? poi.biz_type.join(' ') : '')
    const type = (typeof poi.type === 'string') ? poi.type : (Array.isArray(poi.type) ? poi.type.join(' ') : '')
    let rating = ''
    if (poi.biz_ext && poi.biz_ext.rating) {
      rating = (typeof poi.biz_ext.rating === 'string') ? poi.biz_ext.rating : ''
    }
    return { name, address, tel, website, email, bizType, type, rating, lng, lat }
  }

  // --- 射线法点包含判断 ---
function pointInPolygon(point, polygon) {
  const [x, y] = point
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

// --- Haversine 距离（米）---
function haversineM(lng1, lat1, lng2, lat2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// --- 公司搜索（REST API 网格策略）---
  async function searchCompanies(onProgress) {
    const app = useAppStore()
    const search = useSearchStore()

    const gen = app.bumpSearchGen()
    app.isSearching = true
    search.allResults = []
    search.currentPage = 1
    search.searchProgress = 0
    search.searchProgressText = '准备搜索...'

    // 1. 生成搜索计划
    let plans = []

    if (app.mode === 'dist') {
      const districts = [...app.selectedDistricts]
      if (!districts.length) {
        app.showToast('请至少勾选一个区域')
        app.isSearching = false
        return
      }
      for (const d of districts) {
        const center = DISTRICT_CENTERS[d]
        if (!center) {
          console.warn('未知区域:', d, '，用视野兜底')
          continue
        }
        for (let gi = 0; gi < DISTRICT_OFFSETS.length; gi++) {
          for (let gj = 0; gj < DISTRICT_OFFSETS.length; gj++) {
            plans.push({
              label: `${d}#${gi * DISTRICT_OFFSETS.length + gj + 1}`,
              lng: center[0] + DISTRICT_OFFSETS[gi],
              lat: center[1] + DISTRICT_OFFSETS[gj],
              radius: 5000,
              level: 0
            })
          }
        }
        search.searchProgressText = `已定位: ${d} (${plans.length} 网格点)`
      }
    } else if (app.mode === 'rect') {
      const drawBounds = app.drawBounds
      if (!drawBounds) {
        app.showToast('请先拉框画范围，再点搜索')
        app.isSearching = false; return
      }
      plans = generateGridPlans(drawBounds, '矩形')
    } else if (app.mode === 'circle') {
      if (!app.drawCenter || !app.drawRadius) {
        app.showToast('请先画圆，再点搜索')
        app.isSearching = false; return
      }
      // 圆 → 外接正方形 bounds
      const deg = app.drawRadius / 111000
      const cb = {
        sw: [app.drawCenter[0] - deg, app.drawCenter[1] - deg],
        ne: [app.drawCenter[0] + deg, app.drawCenter[1] + deg]
      }
      plans = generateGridPlans(cb, '圆形(' + (app.drawRadius / 1000).toFixed(1) + 'km)')
    } else { // view
      const vb = getViewBounds()
      if (!vb) { app.showToast('无法确定搜索范围'); app.isSearching = false; return }
      plans = generateGridPlans(vb, '视野')
      app.drawBounds = vb
    }

    if (!plans.length) {
      app.showToast('无法生成搜索计划')
      app.isSearching = false
      return
    }

    // 2. 逐格点搜索（REST API）
    const all = []
    const seen = new Set()
    let pagesFetched = 0
    let totalPagesEstimate = 0
    const MAX_FETCHES = plans.length * MAX_PAGES + 100

    for (let pi = 0; pi < plans.length; pi++) {
      if (gen !== app.searchGen) return  // 被取消

      const plan = plans[pi]

      // 首頁
      const firstData = await fetchOnePage(plan, 1)
      if (!firstData) continue

      const count = firstData.count
      const pagesNeeded = Math.max(1, Math.min(Math.ceil(count / PAGE_SIZE), MAX_PAGES))
      totalPagesEstimate += pagesNeeded
      pagesFetched++

      // 溢出检测：该格点结果太多，细分为 4 个子格
      if (count >= OVERFLOW_THRESHOLD && (plan.level || 0) < MAX_SUBDIVIDE) {
        const nxtLv = (plan.level || 0) + 1
        const s2 = Math.round(plan.radius / 2)
        const so = 0.055 / nxtLv
        for (let si = 0; si < 2; si++) {
          for (let sj = 0; sj < 2; sj++) {
            plans.push({
              label: `${plan.label}.${nxtLv}.${si * 2 + sj + 1}`,
              lng: plan.lng + (si ? so : -so),
              lat: plan.lat + (sj ? so : -so),
              radius: s2,
              level: nxtLv
            })
          }
        }
        totalPagesEstimate += 4
      }

      // 处理首页结果
      firstData.pois.forEach(poi => {
        const key = (poi.name || '') + '|' + (poi.address || '')
        if (!seen.has(key)) {
          seen.add(key)
          all.push(poi)
        }
      })

      // 翻页
      for (let page = 2; page <= pagesNeeded; page++) {
        if (gen !== app.searchGen) return  // 被取消
        if (pagesFetched >= MAX_FETCHES) break

        const pageData = await fetchOnePage(plan, page)
        pagesFetched++
        if (pageData) {
          pageData.pois.forEach(poi => {
            const key = (poi.name || '') + '|' + (poi.address || '')
            if (!seen.has(key)) {
              seen.add(key)
              all.push(poi)
            }
          })
        }
        await new Promise(r => setTimeout(r, FETCH_DELAY))
      }

      // 格点间延迟
      if (pi < plans.length - 1) {
        await new Promise(r => setTimeout(r, FETCH_DELAY))
      }

      // 更新进度
      const pct = Math.min(99, Math.round((pi + 1) / plans.length * 100))
      search.searchProgress = pct
      search.searchProgressText = `${pi + 1}/${plans.length} 格 ${pagesFetched} 页 ${all.length} 家`
      if (onProgress) onProgress(pct, all.length)
    }

    // 竞态检查
    if (gen !== app.searchGen) return

    // 3. 过滤圈外公司 — 网格搜索半径会超出用户画的边界
    const beforeFilter = all.length
    const filterMode = app.mode
    if (filterMode === 'rect' && app.drawBounds) {
      const { sw, ne } = app.drawBounds
      const minLng = Math.min(sw[0], ne[0])
      const maxLng = Math.max(sw[0], ne[0])
      const minLat = Math.min(sw[1], ne[1])
      const maxLat = Math.max(sw[1], ne[1])
      for (let i = all.length - 1; i >= 0; i--) {
        const p = parseRestPoi(all[i])
        if (!p.lng || !p.lat || p.lng < minLng || p.lng > maxLng || p.lat < minLat || p.lat > maxLat) {
          all.splice(i, 1)
        }
      }
    } else if (filterMode === 'circle' && app.drawCenter && app.drawRadius) {
      const [clng, clat] = app.drawCenter
      const r = app.drawRadius
      for (let i = all.length - 1; i >= 0; i--) {
        const p = parseRestPoi(all[i])
        if (!p.lng || !p.lat || haversineM(clng, clat, p.lng, p.lat) > r) {
          all.splice(i, 1)
        }
      }
    } else if (filterMode === 'dist' && districtBoundaries.value.length) {
      const boundaries = districtBoundaries.value
      for (let i = all.length - 1; i >= 0; i--) {
        const p = parseRestPoi(all[i])
        if (!p.lng || !p.lat) { all.splice(i, 1); continue }
        const inside = boundaries.some(boundary => pointInPolygon([p.lng, p.lat], boundary))
        if (!inside) all.splice(i, 1)
      }
    } else if (filterMode === 'view' && app.drawBounds) {
      const { sw, ne } = app.drawBounds
      const minLng = Math.min(sw[0], ne[0])
      const maxLng = Math.max(sw[0], ne[0])
      const minLat = Math.min(sw[1], ne[1])
      const maxLat = Math.max(sw[1], ne[1])
      for (let i = all.length - 1; i >= 0; i--) {
        const p = parseRestPoi(all[i])
        if (!p.lng || !p.lat || p.lng < minLng || p.lng > maxLng || p.lat < minLat || p.lat > maxLat) {
          all.splice(i, 1)
        }
      }
    }
    if (all.length < beforeFilter) {
      console.log(`[filter] 过滤掉 ${beforeFilter - all.length} 家圈外公司，剩余 ${all.length} 家`)
    }

    // 4. 打分
    search.searchProgressText = `${all.length} 家，打分...`
    const results = []
    for (const poi of all) {
      const p = parseRestPoi(poi)
      if (!p.lng || !p.lat) continue

      // 计算距离（优先用 AMap GeometryUtil，兜底用 haversine）
      let distance = null
      if (window.AMap && window.AMap.GeometryUtil) {
        distance = window.AMap.GeometryUtil.distance(
          [app.homeLng, app.homeLat],
          [p.lng, p.lat]
        ) / 1000
      }

      const scored = calculateScore({
        name: p.name,
        address: p.address,
        bizType: p.bizType,
        type: p.type,
        phone: p.tel,
        website: p.website,
        email: p.email,
        amapRating: p.rating,
        lng: p.lng,
        lat: p.lat,
        distance
      }, app.homeLng, app.homeLat)

      // 过滤个体工商户/工作室（calculateScore 返回 null）
      if (!scored) continue

      results.push(scored)
    }

    search.setResults(results)
    app.isSearching = false
    search.searchProgress = 100
    search.searchProgressText = `搜索完成: ${results.length} 家公司`

    // 显示标记
    if (app.showMarkers) {
      updateCompanyMarkers()
    }

    app.showToast(`找到 ${results.length} 家公司`)
  }

  // --- 公司标记 ---
  function updateCompanyMarkers() {
    const app = useAppStore()
    const search = useSearchStore()

    companyMarkers.value.forEach(m => mapInstance.remove(m))
    companyMarkers.value = []

    if (!app.showMarkers || !search.currentPageData.length) return

    search.currentPageData.forEach((r, i) => {
      if (!r.lng || !r.lat) return

      let color, bg
      if (r.total >= 70) { color = '#fff'; bg = '#1677ff' }
      else if (r.total >= 50) { color = '#fff'; bg = '#8c8c8c' }
      else { color = '#999'; bg = '#e8e8e8' }

      const m = new window.AMap.Marker({
        position: [r.lng, r.lat],
        content: `<div style="position:relative;width:26px;height:32px">
          <div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:22px;height:22px;
            background:${bg};color:${color};border-radius:50%;text-align:center;line-height:22px;
            font-size:10px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.2);border:2px solid #fff">${i + 1}</div>
          <div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);width:0;height:0;
            border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid ${bg}"></div>
          </div>`,
        offset: new window.AMap.Pixel(-13, -32),
        zIndex: 300 - i
      })

      m.on('click', () => {
        const webLink = r.website ? `<br><a href="${escHtml(r.website)}" target="_blank" style="color:#1677ff">🔗 ${escHtml(r.website)}</a>` : ''
        new window.AMap.InfoWindow({
          content: `<div style="font-size:12px;max-width:280px"><strong>${escHtml(r.name)}</strong>
            <span style="background:${bg};color:#fff;padding:1px 6px;border-radius:3px;font-size:11px">${r.total}分</span><br>
            ${escHtml(r.address || '')}<br>${r.nature} | ${r.distance ? r.distance.toFixed(1) + 'km' : '--'}${webLink}</div>`,
          offset: new window.AMap.Pixel(0, -30)
        }).open(mapInstance, m.getPosition())
      })

      m.setMap(mapInstance)
      companyMarkers.value.push(m)
    })

    // 自适应视野
    if (search.currentPageData.length) {
      mapInstance.setFitView(null, false, [60, 60, 450, 60])
    }
  }

  function clearCompanyMarkers() {
    companyMarkers.value.forEach(m => mapInstance.remove(m))
    companyMarkers.value = []
  }

  // --- 回家 ---
  function goHome() {
    const app = useAppStore()
    if (app.isSearching) return
    if (mouseTool) mouseTool.close(true)
    if (mapInstance) mapInstance.setStatus({ dragEnable: true })
    clearUserDraw()
    clearDistrictShapes()
    mapInstance.setCenter([app.homeLng, app.homeLat])
    mapInstance.setZoom(13)
    app.showToast(`已回到 ${app.homeName}`)
  }

  return {
    map, mapReady,
    drawRect, drawCircle, districtPolygons,
    homeMarker, homeCircleRefs, companyMarkers,
    initMap,
    updateHomeMarker,
    geocodeHome,
    setMode,
    clearUserDraw, clearDistrictShapes,
    cancelDrawing,
    getViewBounds,
    searchCompanies,
    updateCompanyMarkers, clearCompanyMarkers,
    goHome
  }
}

function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
