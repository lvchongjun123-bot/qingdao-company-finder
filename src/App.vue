<template>
  <div class="app-shell">
    <!-- 地图全屏 -->
    <div id="map-container" ref="mapContainer"></div>

    <!-- 顶栏 -->
    <ToolBar />

    <!-- 结果面板（对齐原版：始终在 DOM，display 切换） -->
    <ResultPanel v-show="showResultPanel" />

    <!-- 收藏面板 -->
    <SavedPanel v-if="appStore.showSavedPanel" @close="appStore.showSavedPanel = false" />

    <!-- Toast -->
    <Transition name="toast">
      <div v-if="appStore.toast" class="toast-bar">{{ appStore.toast }}</div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useAppStore } from './stores/app'
import { useSearchStore } from './stores/search'
import { useAMap } from './composables/useAMap'
import ToolBar from './components/ToolBar.vue'
import ResultPanel from './components/ResultPanel.vue'
import SavedPanel from './components/SavedPanel.vue'

const appStore = useAppStore()
const searchStore = useSearchStore()
const mapContainer = ref(null)

const {
  initMap, updateHomeMarker, geocodeHome, updateCompanyMarkers, clearCompanyMarkers, searchCompanies
} = useAMap()

// 结果面板显示控制（对齐原版：搜过一次后永远显示）
const hasSearched = ref(false)

const showResultPanel = computed(() => {
  return hasSearched.value
})

// 监听搜索状态，一旦开始搜索就标记 hasSearched
watch(() => appStore.isSearching, (searching) => {
  if (searching) hasSearched.value = true
})

onMounted(async () => {
  if (mapContainer.value) {
    await initMap('map-container')
    geocodeHome()  // 用 Geocoder 解析家地址 → 精确坐标后再放标记
  }
})

// Toast 自动消失
let toastTimer = null
watch(() => appStore.toast, (msg) => {
  if (toastTimer) clearTimeout(toastTimer)
  if (msg) {
    toastTimer = setTimeout(() => { appStore.toast = '' }, appStore.toastDuration)
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

// Enter 键开始搜索（对齐原版）
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !appStore.isSearching && document.activeElement === document.body) {
    searchCompanies()
  }
})
</script>

<style>
/* ===== 全局 ===== */
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
  --shadow: 0 8px 32px rgba(0,0,0,.08);
  --transition: .2s ease;
}

.app-shell {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

#map-container {
  width: 100%;
  height: 100%;
}

/* ===== Toast ===== */
.toast-bar {
  position: absolute;
  bottom: 24px;
  left: 24px;
  z-index: 300;
  background: var(--c-surface);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: var(--c-text);
  padding: 10px 20px;
  border-radius: var(--r-md);
  box-shadow: var(--shadow);
  font-size: 13px;
  max-width: 60vw;
}

.toast-enter-active { transition: opacity .3s ease; }
.toast-leave-active { transition: opacity .3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; }
</style>
