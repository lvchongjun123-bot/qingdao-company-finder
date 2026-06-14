<template>
  <div class="m-shell">
    <!-- 地图全屏 -->
    <div id="map-container" ref="mapContainer"></div>

    <!-- 地图加载占位 -->
    <div class="m-placeholder" v-if="!mapReady">地图加载中...</div>

    <!-- 绘制提示（纯视觉，不拦截事件） -->
    <div class="m-draw-hint" v-show="appStore.isDrawing && drawStarted">
      {{ appStore.mode === 'rect' ? '↖ 松手完成矩形' : '⊙ 松手完成圆形' }}
    </div>

    <!-- 顶部工具栏 -->
    <ToolBarMobile />

    <!-- 底部结果抽屉 -->
    <BottomSheet v-if="hasSearched">
      <template #header>
        <div class="m-bs-title">
          <span>搜索结果</span>
          <span class="m-bs-count">{{ searchStore.allResults.length }} 家</span>
        </div>
      </template>
      <ResultListMobile />
    </BottomSheet>

    <!-- 收藏面板 -->
    <SavedSheetMobile :visible="appStore.showSavedPanel" @close="appStore.showSavedPanel = false" />

    <!-- Toast -->
    <Transition name="toast">
      <div v-if="appStore.toast" class="m-toast">{{ appStore.toast }}</div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useAppStore } from '../src/stores/app'
import { useSearchStore } from '../src/stores/search'
import { useAMap } from '../src/composables/useAMap'
import { useBottomSheet } from './composables/useBottomSheet'
import ToolBarMobile from './components/ToolBarMobile.vue'
import BottomSheet from './components/BottomSheet.vue'
import ResultListMobile from './components/ResultListMobile.vue'
import SavedSheetMobile from './components/SavedSheetMobile.vue'

const appStore = useAppStore()
const searchStore = useSearchStore()
const {
  initMap, geocodeHome, updateCompanyMarkers, clearCompanyMarkers,
  map
} = useAMap()
const { snapTo } = useBottomSheet()

const mapContainer = ref(null)
const mapReady = ref(false)
const hasSearched = ref(false)

// iOS 100vh 修复
function setVH() {
  document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`)
}
window.addEventListener('resize', setVH)
setVH()

onMounted(async () => {
  if (mapContainer.value) {
    const ok = await initMap('map-container')
    if (ok) {
      mapReady.value = true
      geocodeHome()
    }
  }
})

// ===== 移动端触摸绘制 — 使用 AMap 原生触摸事件 =====
// 高德 JS API 2.0 的地图实例支持 touchstart/touchmove/touchend 事件，
// 事件对象直接包含 ev.lnglat（AMap.LngLat），无需像素坐标转换。
// https://lbs.amap.com/api/javascript-api-v2/guide/events/map_overlay

const drawStarted = ref(false)    // 用户已开始拖拽
let drawStartLngLat = null        // AMap.LngLat — 起始地图坐标
let drawOverlayObj = null         // AMap.Rectangle | AMap.Circle | null

// 从 AMap 事件对象提取 lng/lat
function evLngLat(ev) {
  const ll = ev.lnglat
  return { lng: ll.lng, lat: ll.lat }
}

// AMap touchstart 回调 — 记录起点
function onAmapTouchStart(ev) {
  if (!appStore.isDrawing) return
  drawStartLngLat = ev.lnglat
  drawStarted.value = true
}

// AMap touchmove 回调 — 实时更新 overlay
function onAmapTouchMove(ev) {
  if (!appStore.isDrawing || !drawStartLngLat) return
  const cur = evLngLat(ev)
  const start = evLngLat({ lnglat: drawStartLngLat })

  if (drawOverlayObj) { map.value.remove(drawOverlayObj); drawOverlayObj = null }

  if (appStore.mode === 'rect') {
    const sw = [Math.min(start.lng, cur.lng), Math.min(start.lat, cur.lat)]
    const ne = [Math.max(start.lng, cur.lng), Math.max(start.lat, cur.lat)]
    drawOverlayObj = new window.AMap.Rectangle({
      bounds: new window.AMap.Bounds(sw, ne),
      strokeColor: '#1677ff', strokeWeight: 3, strokeOpacity: 0.8,
      fillColor: '#1677ff', fillOpacity: 0.12
    })
    drawOverlayObj.setMap(map.value)
  } else if (appStore.mode === 'circle') {
    const center = [start.lng, start.lat]
    const radius = window.AMap.GeometryUtil.distance(center, [cur.lng, cur.lat])
    drawOverlayObj = new window.AMap.Circle({
      center, radius,
      strokeColor: '#1677ff', strokeWeight: 3, strokeOpacity: 0.8,
      fillColor: '#1677ff', fillOpacity: 0.12
    })
    drawOverlayObj.setMap(map.value)
  }
}

// 从绘制 overlay 读取最终状态（避免 touchend 在 iOS Safari 上不触发 map 事件）
function finalizeDrawing() {
  if (!appStore.isDrawing || !drawStartLngLat) return

  if (appStore.mode === 'rect' && drawOverlayObj) {
    const bounds = drawOverlayObj.getBounds()
    const sw = bounds.getSouthWest()
    const ne = bounds.getNorthEast()
    appStore.drawBounds = { sw: [sw.lng, sw.lat], ne: [ne.lng, ne.lat] }
    appStore.showToast('矩形已画好 — 点"搜索"')
  } else if (appStore.mode === 'circle' && drawOverlayObj) {
    const center = drawOverlayObj.getCenter()
    const radius = drawOverlayObj.getRadius()
    appStore.drawCenter = [center.lng, center.lat]
    appStore.drawRadius = radius
    appStore.showToast('圆形已画好(约' + (radius / 1000).toFixed(1) + 'km) — 点"搜索"')
  }

  appStore.isDrawing = false
  drawStartLngLat = null
  drawStarted.value = false
}

// touchend 绑到 document（参考贝壳找房方案：iOS Safari 上 map 的 touchend 可能不触发）
function onDocTouchEnd() {
  if (!appStore.isDrawing) return
  finalizeDrawing()
}

function onDocTouchCancel() {
  cleanupMobileOverlay()
  drawStartLngLat = null
  drawStarted.value = false
  appStore.isDrawing = false
}

// 注册/注销绘制事件
function bindDrawEvents() {
  const m = map.value
  if (!m) return
  m.on('touchstart', onAmapTouchStart)
  m.on('touchmove', onAmapTouchMove)
  document.addEventListener('touchend', onDocTouchEnd, { passive: true })
  document.addEventListener('touchcancel', onDocTouchCancel, { passive: true })
  // 禁用所有地图交互（参考贝壳方案：全面禁用防干扰）
  m.setStatus({
    dragEnable: false,
    zoomEnable: false,
    doubleClickZoom: false,
    rotateEnable: false,
    touchZoom: false,
    showIndoorMap: false
  })
}

function unbindDrawEvents() {
  const m = map.value
  if (!m) return
  m.off('touchstart', onAmapTouchStart)
  m.off('touchmove', onAmapTouchMove)
  document.removeEventListener('touchend', onDocTouchEnd, { passive: true })
  document.removeEventListener('touchcancel', onDocTouchCancel, { passive: true })
  // 恢复地图交互
  m.setStatus({
    dragEnable: true,
    zoomEnable: true,
    doubleClickZoom: true,
    rotateEnable: true,
    touchZoom: true,
    showIndoorMap: true
  })
}

function cleanupMobileOverlay() {
  if (drawOverlayObj && map.value) {
    map.value.remove(drawOverlayObj)
    drawOverlayObj = null
  }
}

// 进入/退出绘制模式 → 注册/注销事件
watch(() => appStore.isDrawing, (drawing) => {
  if (drawing) {
    bindDrawEvents()
  } else {
    unbindDrawEvents()
    // 取消时（无 drawBounds 且无 drawCenter）→ 清理 overlay
    if (!appStore.drawBounds && !appStore.drawCenter) {
      cleanupMobileOverlay()
    }
    drawStartLngLat = null
    drawStarted.value = false
  }
})

// 模式切换时清理
watch(() => appStore.mode, () => {
  cleanupMobileOverlay()
  drawStartLngLat = null
  drawStarted.value = false
})

// 组件卸载时清理
onUnmounted(() => {
  unbindDrawEvents()
})

// 搜索状态处理
watch(() => appStore.isSearching, (searching, wasSearching) => {
  if (searching) {
    hasSearched.value = true
    // 搜索开始 → 清理绘制 overlay，露出结果标记
    cleanupMobileOverlay()
  } else if (wasSearching && searchStore.allResults.length > 0) {
    // 搜索完成 → 展开底部抽屉
    snapTo('half')
  }
})

// 当页面数据变化时更新标记
watch(() => searchStore.currentPageData, () => {
  updateCompanyMarkers()
}, { deep: true })

// 标记开关
watch(() => appStore.showMarkers, (show) => {
  if (show) updateCompanyMarkers()
  else clearCompanyMarkers()
})

// Toast 自动消失
let toastTimer = null
watch(() => appStore.toast, (msg) => {
  if (toastTimer) clearTimeout(toastTimer)
  if (msg) {
    toastTimer = setTimeout(() => { appStore.toast = '' }, appStore.toastDuration)
  }
})
</script>

<style>
/* ===== 全局变量 ===== */
:root {
  --c-primary: #1677ff;
  --c-green: #52c41a;
  --c-amber: #fa8c16;
  --c-red: #ff4d4f;
  --c-bg: #f0f2f5;
  --c-surface: rgba(255,255,255,.92);
  --c-border: #e8e8e8;
  --c-text: #1a1a2e;
  --c-text2: #666;
  --c-text3: #999;
  --r-sm: 6px;
  --r-md: 10px;
  --r-lg: 14px;

  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
}

.m-shell {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

#map-container {
  width: 100%;
  height: 100%;
}

.m-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  color: rgba(255,255,255,.6);
  font-size: 14px;
  z-index: 500;
}

/* ===== 底部抽屉标题 ===== */
.m-bs-title {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 6px;
}
.m-bs-count {
  font-size: 12px;
  font-weight: 400;
  color: #999;
}

/* ===== 绘制提示（纯视觉，不拦截事件） ===== */
.m-draw-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 300;
  background: rgba(22, 119, 255, 0.88);
  color: #fff;
  padding: 10px 20px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  pointer-events: none;
  box-shadow: 0 4px 16px rgba(22, 119, 255, 0.3);
}

/* Toast */
.m-toast {
  position: fixed;
  bottom: max(80px, var(--safe-bottom));
  left: 12px;
  right: 12px;
  z-index: 400;
  background: rgba(0,0,0,.82);
  color: #fff;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 13px;
  text-align: center;
  pointer-events: none;
}
.toast-enter-active { transition: opacity .3s ease; }
.toast-leave-active { transition: opacity .3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; }
</style>
