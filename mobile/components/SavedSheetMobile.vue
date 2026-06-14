<template>
  <Transition name="saved-slide">
    <div class="msaved" v-if="visible" @click.self="emit('close')">
      <div class="ms-body">
        <!-- 头部 -->
        <div class="ms-head">
          <button class="ms-close" @click="emit('close')">✕</button>
          <span class="ms-title">我的名单 · {{ searchStore.savedList.length }} 家</span>
          <div class="ms-acts">
            <button @click="exportSavedCsv" :disabled="!searchStore.savedList.length">导出</button>
            <button @click="clearAll" :disabled="!searchStore.savedList.length">清空</button>
          </div>
        </div>

        <!-- 列表 -->
        <div class="ms-list" v-if="searchStore.savedList.length">
          <div v-for="c in searchStore.savedList" :key="c.name + '|' + c.address" class="ms-row">
            <div class="msr-info">
              <div class="msr-name">{{ c.name }}</div>
              <div class="msr-addr">{{ c.address }}</div>
              <div class="msr-links">
                <a :href="'https://www.zhipin.com/web/geek/job?query=' + encodeURIComponent(c.name) + '&city=101120200'" target="_blank" class="mslk ms-boss"><span class="mslk-dot boss-d"></span>BOSS</a>
                <a :href="'https://we.51job.com/pc/search?keyword=' + encodeURIComponent(c.name) + '&area=370200'" target="_blank" class="mslk ms-51"><span class="mslk-dot j51-d"></span>前程</a>
                <a :href="'https://sou.zhaopin.com/?jl=698&kw=' + encodeURIComponent(c.name)" target="_blank" class="mslk ms-zl"><span class="mslk-dot zl-d"></span>智联</a>
                <a :href="'https://fw.rc.qingdao.gov.cn/qdzhrcww/work/f60050102/showGw.action?gwglxm=' + encodeURIComponent(c.name)" target="_blank" class="mslk ms-rc"><span class="mslk-dot rc-d"></span>人才网</a>
                <a v-if="c.website" :href="c.website" target="_blank" class="mslk ms-web"><span class="mslk-dot web-d"></span>官网</a>
              </div>
            </div>
            <div class="msr-score" :class="scoreClass(c.total)">{{ c.total }}</div>
            <button class="msr-del" @click="searchStore.toggleSave(c)">✕</button>
          </div>
        </div>

        <!-- 空 -->
        <div v-else class="ms-empty">还没有收藏公司</div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { useSearchStore } from '../../src/stores/search'
import { useAppStore } from '../../src/stores/app'
import { generateSavedCsv, downloadCsv } from '../../src/utils/csv-export'

const props = defineProps({ visible: Boolean })
const emit = defineEmits(['close'])

const searchStore = useSearchStore()
const appStore = useAppStore()

function scoreClass(total) {
  if (total >= 70) return 'h'
  if (total >= 50) return 'm'
  return 'l'
}

function exportSavedCsv() {
  if (!searchStore.savedList.length) return
  const csv = generateSavedCsv(searchStore.savedList)
  downloadCsv(csv, 'saved_companies.csv')
  appStore.showToast('已导出 ' + searchStore.savedList.length + ' 家')
}

function clearAll() {
  if (confirm('确定清空所有收藏？')) {
    searchStore.clearSaved()
    appStore.showToast('已清空')
  }
}
</script>

<style scoped>
.msaved {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: rgba(0,0,0,.4);
  display: flex;
  align-items: flex-end;
}
.ms-body {
  width: 100%;
  max-height: 80vh;
  background: #fff;
  border-radius: 16px 16px 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: max(12px, env(safe-area-inset-bottom, 12px));
}

.ms-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px 10px;
  border-bottom: 1px solid #eee;
  flex-shrink: 0;
}
.ms-close {
  background: none; border: none; font-size: 18px; cursor: pointer;
  padding: 8px; min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center;
  color: #666;
}
.ms-title { flex: 1; font-size: 15px; font-weight: 600; }
.ms-acts { display: flex; gap: 4px; }
.ms-acts button {
  padding: 6px 10px; border: 1px solid #e8e8e8; border-radius: 8px;
  background: #fff; font-size: 11px; cursor: pointer;
}
.ms-acts button:disabled { opacity: .35; }

.ms-list { overflow-y: auto; flex: 1; padding: 8px 12px; }
.ms-row {
  display: flex; align-items: center;
  gap: 8px; padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;
}
.msr-info { flex: 1; min-width: 0; }
.msr-name { font-size: 14px; font-weight: 600; }
.msr-addr { font-size: 11px; color: #999; margin: 2px 0; }
.msr-links { display: flex; gap: 4px; margin-top: 4px; flex-wrap: wrap; }
.mslk {
  font-size: 10px; font-weight: 600; text-decoration: none;
  padding: 4px 8px 4px 5px; border-radius: 14px;
  display: inline-flex; align-items: center; gap: 4px;
  min-height: 28px;
}
.mslk-dot { width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0; }
.ms-boss { background: #e6faf5; color: #00b4a2; } .boss-d { background: #00b4a2; }
.ms-51   { background: #fff3e8; color: #e8700a; } .j51-d  { background: #e8700a; }
.ms-zl   { background: #ffeded; color: #d03030; } .zl-d   { background: #d03030; }
.ms-rc   { background: #e8f2ff; color: #1677ff; } .rc-d   { background: #1677ff; }
.ms-web  { background: #fff8eb; color: #b86e00; } .web-d  { background: #b86e00; }
.mslk:active { filter: brightness(.9); }
.msr-score {
  font-size: 14px; font-weight: 700; padding: 3px 8px; border-radius: 10px;
  min-width: 36px; text-align: center;
}
.msr-score.h { background: #f6ffed; color: #52c41a; }
.msr-score.m { background: #fff7e6; color: #fa8c16; }
.msr-score.l { background: #fff1f0; color: #ff4d4f; }

.msr-del {
  background: none; border: none; font-size: 14px; cursor: pointer;
  color: #ccc; padding: 8px; min-width: 44px; min-height: 44px;
  display: flex; align-items: center; justify-content: center;
}
.msr-del:active { color: #ff4d4f; }

.ms-empty { text-align: center; padding: 40px; color: #999; font-size: 13px; }

/* 转场 */
.saved-slide-enter-active, .saved-slide-leave-active { transition: opacity .25s ease; }
.saved-slide-enter-active .ms-body, .saved-slide-leave-active .ms-body { transition: transform .3s cubic-bezier(0.4,0,0.2,1); }
.saved-slide-enter-from, .saved-slide-leave-to { opacity: 0; }
.saved-slide-enter-from .ms-body, .saved-slide-leave-to .ms-body { transform: translateY(100%); }
</style>
