<template>
  <div class="result-panel" :class="{ mini: isMini }">
    <!-- 头部 -->
    <div class="rh">
      <span class="rh-title">搜索结果 · {{ searchStore.allResults.length }} 家</span>
      <div class="ctl">
        <button :class="{ on: showList }" @click="showList = true">列表</button>
        <button :class="{ on: !showList }" @click="showList = false">仅地图</button>
        <button @click="isMini = !isMini">{{ isMini ? '展开' : '收起' }}</button>
      </div>
    </div>

    <!-- 进度条 -->
    <div class="prog-wrap" v-if="appStore.isSearching">
      <div class="prog"><div :style="{ width: searchStore.searchProgress + '%' }"></div></div>
      <div class="pt">{{ searchStore.searchProgressText }}</div>
    </div>

    <!-- 排序 -->
    <div class="sortrow" v-show="showList && !isMini">
      <button v-for="s in sortOptions" :key="s.key"
        :class="{ on: searchStore.currentSort === s.key }"
        @click="searchStore.setSort(s.key)">{{ s.label }}</button>
    </div>

    <!-- 列表 -->
    <div class="list-body" v-show="showList && !isMini">
      <ResultCard v-for="(company, i) in searchStore.currentPageData"
        :key="company.name + '|' + company.address"
        :company="company"
        :index="(searchStore.currentPage - 1) * searchStore.pageSize + i + 1"
        :is-saved="searchStore.isSaved(company)"
        @toggle-save="searchStore.toggleSave(company)"
      />
      <div v-if="!searchStore.currentPageData.length && !appStore.isSearching" class="empty">
        当前范围未找到公司<br>建议: 换区域 / 扩大视野 / 检查网络
      </div>
    </div>

    <!-- 分页 -->
    <div class="pager" v-show="showList && !isMini && searchStore.totalPages > 1">
      <button :disabled="searchStore.currentPage <= 1" @click="searchStore.goToPage(searchStore.currentPage - 1)">&lt;</button>
      <template v-for="(p, pi) in pageButtons" :key="pi">
        <span v-if="p === '...'" class="pg-info">...</span>
        <button v-else :class="{ on: p === searchStore.currentPage }" @click="searchStore.goToPage(p)">{{ p }}</button>
      </template>
      <button :disabled="searchStore.currentPage >= searchStore.totalPages" @click="searchStore.goToPage(searchStore.currentPage + 1)">&gt;</button>
      <span class="pg-info">共 {{ searchStore.sortedResults.length }} 条</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppStore } from '../stores/app'
import { useSearchStore } from '../stores/search'
import ResultCard from './ResultCard.vue'

const appStore = useAppStore()
const searchStore = useSearchStore()
const isMini = ref(false)
const showList = ref(true)

const sortOptions = [
  { key: 'total', label: '综合排序' },
  { key: 'distanceScore', label: '距离最近' },
  { key: 'scaleScore', label: '规模最大' },
  { key: 'welfareScore', label: '福利最好' }
]

// 生成分页按钮数组
const pageButtons = computed(() => {
  const current = searchStore.currentPage
  const total = searchStore.totalPages
  const buttons = []

  const startP = Math.max(1, current - 3)
  const endP = Math.min(total, current + 3)

  if (startP > 1) {
    buttons.push(1)
    if (startP > 2) buttons.push('...')
  }
  for (let p = startP; p <= endP; p++) {
    buttons.push(p)
  }
  if (endP < total) {
    if (endP < total - 1) buttons.push('...')
    buttons.push(total)
  }

  return buttons
})
</script>

<style scoped>
.result-panel {
  position: absolute;
  top: 68px;
  right: 12px;
  z-index: 200;
  width: 420px;
  max-height: calc(100vh - 90px);
  background: var(--c-surface);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--c-border);
  border-radius: var(--r-lg);
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow);
  font-size: 13px;
  color: var(--c-text);
  overflow: hidden;
}
.result-panel.mini { width: 200px; }
.result-panel.mini .list-body, .result-panel.mini .sortrow { display: none; }

.rh {
  padding: 12px 16px;
  border-bottom: 1px solid var(--c-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  gap: 8px;
}
.rh-title { font-weight: 600; font-size: 13px; white-space: nowrap; }

.ctl { display: flex; gap: 4px; }
.ctl button {
  background: transparent;
  border: 1px solid var(--c-border);
  border-radius: var(--r-sm);
  padding: 3px 8px;
  cursor: pointer;
  font-size: 11px;
  transition: var(--transition);
}
.ctl button.on { background: #f0f5ff; color: var(--c-primary); border-color: var(--c-primary); }

.prog-wrap { padding: 6px 12px; border-bottom: 1px solid var(--c-border); flex-shrink: 0; }
.prog { background: #f0f0f0; border-radius: 3px; height: 4px; }
.prog div { background: var(--c-primary); height: 100%; border-radius: 3px; transition: width .3s; }
.pt { font-size: 10px; color: var(--c-text3); margin-top: 3px; }

.sortrow { padding: 6px 12px; border-bottom: 1px solid var(--c-border); display: flex; gap: 4px; flex-shrink: 0; flex-wrap: wrap; }
.sortrow button {
  font-size: 10px;
  padding: 3px 10px;
  border-radius: 12px;
  border: 1px solid var(--c-border);
  background: #fafafa;
  cursor: pointer;
  transition: var(--transition);
}
.sortrow button.on { background: var(--c-amber); color: #fff; border-color: var(--c-amber); }

.list-body { overflow-y: auto; flex: 1; padding: 8px 12px; }
.empty { text-align: center; padding: 30px; color: var(--c-text3); line-height: 2; }

.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 10px 12px;
  border-top: 1px solid var(--c-border);
  flex-shrink: 0;
  flex-wrap: wrap;
}
.pager button {
  padding: 4px 9px;
  border: 1px solid var(--c-border);
  border-radius: var(--r-sm);
  background: #fff;
  font-size: 11px;
  cursor: pointer;
  transition: var(--transition);
  min-width: 28px;
}
.pager button.on { background: var(--c-primary); color: #fff; border-color: var(--c-primary); }
.pager button:disabled { opacity: .35; cursor: not-allowed; }
.pg-info { font-size: 11px; color: var(--c-text3); }
</style>
