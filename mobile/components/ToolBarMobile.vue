<template>
  <div class="mtb">
    <!-- 模式切换 -->
    <div class="mtb-modes">
      <button v-for="m in modes" :key="m.key"
        :class="{ on: appStore.mode === m.key }"
        @click="switchMode(m.key)">{{ m.label }}</button>
    </div>

    <!-- 操作行 -->
    <div class="mtb-acts">
      <!-- 区选择（仅行政区模式） -->
      <button v-show="appStore.mode === 'dist'" class="mtb-btn"
        :class="{ on: appStore.selectedDistricts.length > 0 }"
        @click="showDist = !showDist">
        区域<span class="mtb-arr">&#9662;</span>
      </button>

      <!-- 绘制提示 -->
      <span class="mtb-hint" v-show="appStore.isDrawing">拖拽画范围</span>

      <!-- 搜索/取消 -->
      <button v-if="!appStore.isSearching && !appStore.isDrawing"
        class="mtb-go" @click="handleSearch">搜索</button>
      <button v-else class="mtb-cancel" @click="cancelAll">取消</button>

      <!-- 更多 -->
      <button class="mtb-btn" @click="showMore = !showMore">···</button>
    </div>

    <!-- 区选择下拉 -->
    <div class="mtb-drop" v-show="showDist" @click.stop>
      <label v-for="d in districts" :key="d" class="mtb-cb">
        <input type="checkbox" :value="d" v-model="appStore.selectedDistricts" />
        <span>{{ d }}</span>
      </label>
    </div>

    <!-- 更多菜单 -->
    <div class="mtb-drop" v-show="showMore" @click.stop>
      <button :disabled="!searchStore.allResults.length" @click="exportCsv">导出CSV</button>
      <button @click="goHome">回家</button>
      <button :class="{ on: appStore.showMarkers }" @click="appStore.showMarkers = !appStore.showMarkers">
        {{ appStore.showMarkers ? '显示标记' : '隐藏标记' }}
      </button>
      <button @click="openSaved">我的名单</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAppStore } from '../../src/stores/app'
import { useSearchStore } from '../../src/stores/search'
import { useAMap } from '../../src/composables/useAMap'
import { SEARCH_MODES, QINGDAO_DISTRICTS } from '../../src/utils/constants'
import { generateSearchCsv, downloadCsv, timestampCsvName } from '../../src/utils/csv-export'

const appStore = useAppStore()
const searchStore = useSearchStore()
const { setMode, searchCompanies, goHome, cancelDrawing } = useAMap()

const showDist = ref(false)
const showMore = ref(false)

const modes = SEARCH_MODES
const districts = QINGDAO_DISTRICTS

function switchMode(mode) {
  showDist.value = false
  showMore.value = false
  setMode(mode, { useMouseTool: false })
}

async function handleSearch() {
  showDist.value = false
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
  appStore.showToast('已取消')
}

function openSaved() {
  showMore.value = false
  appStore.showSavedPanel = true
}

function exportCsv() {
  showMore.value = false
  if (!searchStore.allResults.length) return
  const csv = generateSearchCsv(searchStore.allResults)
  downloadCsv(csv, timestampCsvName())
  appStore.showToast('CSV已导出: ' + searchStore.allResults.length + ' 家公司')
}
</script>

<style scoped>
.mtb {
  position: fixed;
  top: max(8px, env(safe-area-inset-top, 8px));
  left: 8px;
  right: 8px;
  z-index: 220;
  background: rgba(255,255,255,.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 14px;
  box-shadow: 0 4px 16px rgba(0,0,0,.1);
  padding: 6px;
  font-size: 13px;
}

/* 模式切换 */
.mtb-modes {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
}
.mtb-modes button {
  flex: 1;
  padding: 8px 0;
  border: none;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  background: #f5f5f5;
  color: #666;
  transition: .2s;
}
.mtb-modes button.on {
  background: #1677ff;
  color: #fff;
  font-weight: 600;
}

/* 操作行 */
.mtb-acts {
  display: flex;
  align-items: center;
  gap: 6px;
}
.mtb-btn {
  padding: 7px 12px;
  border: 1.5px solid #e8e8e8;
  border-radius: 10px;
  font-size: 12px;
  cursor: pointer;
  background: #fff;
  color: #666;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 4px;
}
.mtb-btn.on { border-color: #1677ff; color: #1677ff; background: #f0f5ff; }
.mtb-arr { font-size: 9px; }

.mtb-hint {
  font-size: 11px;
  color: #1677ff;
  white-space: nowrap;
  opacity: .85;
  flex: 1;
  text-align: center;
}

.mtb-go {
  flex: 1;
  padding: 8px 0;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  background: #1677ff;
  color: #fff;
}
.mtb-cancel {
  flex: 1;
  padding: 8px 0;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  background: #ff4d4f;
  color: #fff;
}

/* 下拉菜单 */
.mtb-drop {
  margin-top: 6px;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  padding: 4px 0;
  box-shadow: 0 4px 12px rgba(0,0,0,.08);
}
.mtb-cb {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  cursor: pointer;
  font-size: 13px;
}
.mtb-cb input { width: 18px; height: 18px; }
.mtb-drop button {
  display: block;
  width: 100%;
  padding: 10px 14px;
  border: none;
  background: none;
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  color: #333;
}
.mtb-drop button:hover, .mtb-drop button:active { background: #f0f5ff; }
.mtb-drop button.on { color: #1677ff; font-weight: 600; }
.mtb-drop button:disabled { opacity: .35; }
</style>
