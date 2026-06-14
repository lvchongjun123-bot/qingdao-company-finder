<template>
  <div class="toolbar">
    <!-- 模式切换 -->
    <div class="seg">
      <button v-for="m in modes" :key="m.key"
        :class="{ on: appStore.mode === m.key }"
        @click="switchMode(m.key)">{{ m.label }}</button>
    </div>

    <!-- 区选择 -->
    <div class="dist-wrap" v-show="appStore.mode === 'dist'">
      <button class="btn-dist"
        :class="{ on: appStore.selectedDistricts.length > 0 }"
        @click.stop="toggleDistDrop">
        {{ distLabel }} &#9662;
      </button>
      <div class="dist-drop" v-show="showDistDrop" @click.stop="onDistDropClick">
        <label v-for="d in districts" :key="d">
          <input type="checkbox" :value="d" v-model="appStore.selectedDistricts" /> {{ d }}
        </label>
        <div class="act">
          <button @click="selectAll">全选</button>
          <button @click="selectNone">清空</button>
        </div>
      </div>
    </div>

    <!-- 绘制提示 -->
    <span class="draw-hint" v-show="appStore.isDrawing">在地图上拖拽画范围</span>

    <!-- 搜索按钮 -->
    <button class="btn-go" :class="{ busy: appStore.isSearching }"
      v-show="!appStore.isSearching && !appStore.isDrawing"
      @click="handleSearch">
      {{ appStore.isSearching ? '搜索中...' : '开始搜索' }}
    </button>
    <button class="btn-cancel" v-show="appStore.isSearching || appStore.isDrawing" @click="cancelAll">取消</button>

    <!-- 更多菜单 -->
    <div class="more-wrap" ref="moreWrap">
      <button class="btn-more" @click.stop="showMore = !showMore">···</button>
      <div class="more-drop" v-show="showMore" @click.stop="onMoreDropClick">
        <button :disabled="!searchStore.allResults.length" @click="exportCsv">导出CSV</button>
        <button @click="goHome">回家</button>
        <button :class="{ on: appStore.showMarkers }" @click="appStore.showMarkers = !appStore.showMarkers">
          {{ appStore.showMarkers ? '显示标记' : '隐藏标记' }}
        </button>
        <button @click="appStore.showSavedPanel = true">我的名单</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '../stores/app'
import { useSearchStore } from '../stores/search'
import { useAMap } from '../composables/useAMap'
import { SEARCH_MODES, QINGDAO_DISTRICTS } from '../utils/constants'
import { generateSearchCsv, downloadCsv, timestampCsvName } from '../utils/csv-export'

const appStore = useAppStore()
const searchStore = useSearchStore()
const { setMode, searchCompanies, goHome, cancelDrawing } = useAMap()

const showDistDrop = ref(false)
const showMore = ref(false)
const moreWrap = ref(null)

const modes = SEARCH_MODES
const districts = QINGDAO_DISTRICTS

const distLabel = computed(() => {
  if (appStore.selectedDistricts.length === 0) return '选择区域'
  if (appStore.selectedDistricts.length <= 2) return appStore.selectedDistricts.join(',')
  return `${appStore.selectedDistricts.length} 个区`
})

function switchMode(mode) {
  setMode(mode)
}

function toggleDistDrop() {
  showDistDrop.value = !showDistDrop.value
}

function selectAll() {
  appStore.selectedDistricts = [...districts]
}

function selectNone() {
  appStore.selectedDistricts = []
}

async function handleSearch() {
  showDistDrop.value = false
  showMore.value = false
  await searchCompanies()
}

function cancelAll() {
  appStore.bumpSearchGen()
  appStore.isSearching = false
  searchStore.searchProgress = 0
  searchStore.searchProgressText = ''
  cancelDrawing()
  appStore.isDrawing = false
  appStore.showToast('已取消。可自由移动地图')
}

function exportCsv() {
  showMore.value = false
  if (!searchStore.allResults.length) return
  const csv = generateSearchCsv(searchStore.allResults)
  downloadCsv(csv, timestampCsvName())
  appStore.showToast('CSV已导出: ' + searchStore.allResults.length + ' 家公司')
}

// 区下拉点击标签/input后自动关闭
function onDistDropClick(e) {
  if (e.target.tagName === 'LABEL' || e.target.tagName === 'INPUT') {
    setTimeout(() => { showDistDrop.value = false }, 150)
  }
}

// 更多菜单点击任意项后自动关闭
function onMoreDropClick() {
  setTimeout(() => { showMore.value = false }, 100)
}

// 点击外部关闭
function clickOutside(e) {
  if (!e.target.closest('.dist-wrap')) showDistDrop.value = false
  if (moreWrap.value && !moreWrap.value.contains(e.target)) showMore.value = false
}

onMounted(() => document.addEventListener('click', clickOutside))
onUnmounted(() => document.removeEventListener('click', clickOutside))
</script>

<style scoped>
.toolbar {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  background: var(--c-surface);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 28px;
  box-shadow: var(--shadow);
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
}

/* 模式分段 */
.seg {
  display: flex;
  background: #f5f5f5;
  border-radius: 20px;
  padding: 2px;
}
.seg button {
  padding: 5px 12px;
  border: none;
  border-radius: 18px;
  font-size: 11px;
  cursor: pointer;
  font-weight: 500;
  background: transparent;
  color: var(--c-text2);
  transition: var(--transition);
}
.seg button.on {
  background: #fff;
  color: var(--c-primary);
  box-shadow: 0 1px 4px rgba(0,0,0,.1);
  font-weight: 600;
}

/* 区选择 */
.dist-wrap { position: relative; }
.btn-dist {
  padding: 5px 10px;
  border: 1.5px solid var(--c-border);
  border-radius: 18px;
  font-size: 11px;
  cursor: pointer;
  background: #fff;
  color: var(--c-text2);
  transition: var(--transition);
  white-space: nowrap;
}
.btn-dist.on {
  border-color: var(--c-primary);
  color: var(--c-primary);
  background: #f0f5ff;
}
.dist-drop {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 6px;
  background: #fff;
  border: 1px solid var(--c-border);
  border-radius: var(--r-md);
  padding: 8px 0;
  box-shadow: var(--shadow);
  min-width: 160px;
  z-index: 300;
}
.dist-drop label {
  display: block;
  padding: 6px 16px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
}
.dist-drop label:hover { background: #f0f5ff; }
.dist-drop input { margin-right: 6px; }
.act {
  display: flex;
  gap: 4px;
  padding: 4px 16px;
  border-top: 1px solid #f0f0f0;
  margin-top: 4px;
  padding-top: 8px;
}
.act button {
  font-size: 11px;
  padding: 3px 8px;
  background: #f5f5f5;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  cursor: pointer;
}

/* 绘制提示 */
.draw-hint {
  font-size: 11px;
  color: var(--c-primary);
  white-space: nowrap;
  padding: 0 4px;
  opacity: .85;
}

/* 搜索按钮 */
.btn-go {
  padding: 6px 18px;
  border: none;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  background: var(--c-primary);
  color: #fff;
  transition: var(--transition);
  min-width: 80px;
}
.btn-go:hover { opacity: .9; transform: translateY(-1px); }
.btn-go:disabled { opacity: .7; cursor: not-allowed; }
.btn-go.busy { background: var(--c-amber); animation: pulse .8s infinite; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.6} }

.btn-cancel {
  padding: 5px 12px;
  border: none;
  border-radius: 18px;
  font-size: 11px;
  cursor: pointer;
  background: var(--c-red);
  color: #fff;
}

/* 更多菜单 */
.more-wrap { position: relative; }
.btn-more {
  padding: 5px 8px;
  border: 1.5px solid var(--c-border);
  border-radius: 18px;
  font-size: 11px;
  cursor: pointer;
  background: #fff;
  color: var(--c-text2);
  transition: var(--transition);
  white-space: nowrap;
}
.btn-more:hover { border-color: var(--c-primary); color: var(--c-primary); }
.more-drop {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 6px;
  background: #fff;
  border: 1px solid var(--c-border);
  border-radius: var(--r-md);
  box-shadow: var(--shadow);
  padding: 6px 0;
  min-width: 130px;
  z-index: 300;
}
.more-drop button {
  display: block;
  width: 100%;
  padding: 7px 14px;
  border: none;
  background: none;
  font-size: 11px;
  cursor: pointer;
  text-align: left;
  color: var(--c-text2);
  transition: var(--transition);
}
.more-drop button:hover { background: #f0f5ff; color: var(--c-primary); }
.more-drop button:disabled { opacity: .35; cursor: not-allowed; }
.more-drop button.on { color: var(--c-primary); font-weight: 600; }
</style>
