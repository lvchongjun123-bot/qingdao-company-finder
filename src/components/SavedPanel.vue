<template>
  <div class="saved-panel">
    <div class="sh">
      <strong>我的名单</strong>
      <div style="display:flex;gap:6px">
        <button @click="exportSavedCsv" :disabled="!searchStore.savedList.length">导出CSV</button>
        <button @click="clearAll" :disabled="!searchStore.savedList.length">清空</button>
        <button @click="$emit('close')" style="background:#eee">✕</button>
      </div>
    </div>
    <div class="sb">
      <div v-if="!searchStore.savedList.length" class="empty">
        还没有收藏公司<br>搜索结果中点击 ☆ 收藏
      </div>
      <div v-for="(c, i) in searchStore.savedList" :key="searchStore.companyKey(c)" class="srow">
        <div class="rt">
          <span class="rn">{{ i + 1 }}. {{ c.name }}
            <span style="font-size:11px;color:#999">{{ c.nature }}</span>
          </span>
          <span class="rs" :class="scoreCls(c.total)">{{ c.total }}</span>
        </div>
        <div class="ra">{{ c.address }}{{ c.phone ? ' | ' + c.phone : '' }}</div>
        <div class="op">
          <a :href="bossLink(c.name)" target="_blank" class="splk sp-boss"><span class="splk-dot spb-d"></span>BOSS</a>
          <a :href="job51Link(c.name)" target="_blank" class="splk sp-51"><span class="splk-dot sp51-d"></span>前程</a>
          <a :href="zhilianLink(c.name)" target="_blank" class="splk sp-zl"><span class="splk-dot spz-d"></span>智联</a>
          <a :href="rencaiLink(c.name)" target="_blank" class="splk sp-rc"><span class="splk-dot spr-d"></span>人才网</a>
          <a v-if="c.website" :href="c.website" target="_blank" class="splk sp-web"><span class="splk-dot spw-d"></span>官网</a>
          <button class="splk-del" @click="removeOne(c)">移除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useSearchStore } from '../stores/search'
import { useAppStore } from '../stores/app'
import { generateSavedCsv, downloadCsv } from '../utils/csv-export'

const searchStore = useSearchStore()
const appStore = useAppStore()

defineEmits(['close'])

function scoreCls(total) {
  if (total >= 70) return 'h'
  if (total >= 50) return 'm'
  return 'l'
}

function clearAll() {
  if (!searchStore.savedList.length) return
  if (!confirm('确定清空收藏名单？')) return
  searchStore.clearSaved()
}

function removeOne(c) {
  searchStore.toggleSave(c)
  // toggleSave will remove it since it's already saved
}

const enc = (name) => encodeURIComponent(name)

function bossLink(name) { return `https://www.zhipin.com/web/geek/job?query=${enc(name)}&city=101120200` }
function job51Link(name) { return `https://we.51job.com/pc/search?keyword=${enc(name)}&area=370200` }
function zhilianLink(name) { return `https://sou.zhaopin.com/?jl=698&kw=${enc(name)}` }
function rencaiLink(name) { return `https://fw.rc.qingdao.gov.cn/qdzhrcww/work/f60050102/showGw.action?gwglxm=${enc(name)}` }

function exportSavedCsv() {
  if (!searchStore.savedList.length) return
  const csv = generateSavedCsv(searchStore.savedList)
  downloadCsv(csv, 'saved_companies_' + new Date().toISOString().slice(0, 10) + '.csv')
  appStore.showToast('名单已导出: ' + searchStore.savedList.length + ' 家')
}
</script>

<style scoped>
.saved-panel {
  position: absolute;
  top: 68px;
  right: 12px;
  z-index: 210;
  width: 380px;
  max-height: calc(100vh - 90px);
  background: #fff;
  border: 1px solid var(--c-border);
  border-radius: var(--r-lg);
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow);
}
.sh {
  padding: 14px 16px;
  border-bottom: 1px solid var(--c-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}
.sh button {
  padding: 4px 10px;
  border: 1px solid var(--c-border);
  border-radius: var(--r-sm);
  background: #fafafa;
  font-size: 11px;
  cursor: pointer;
}
.sh button:disabled { opacity: .35; cursor: not-allowed; }
.sb { overflow-y: auto; flex: 1; padding: 12px; font-size: 13px; }
.empty { text-align: center; padding: 30px; color: var(--c-text3); line-height: 2; }
.srow { background: #fafafa; border: 1px solid #f0f0f0; border-radius: 6px; padding: 8px 10px; margin-bottom: 4px; }
.srow .rt { display: flex; justify-content: space-between; align-items: center; }
.srow .rn { font-weight: bold; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.srow .rs { font-size: 12px; font-weight: 700; padding: 1px 6px; border-radius: 8px; }
.rs.h { background: #f6ffed; color: var(--c-green); }
.rs.m { background: #fff7e6; color: var(--c-amber); }
.rs.l { background: #fff1f0; color: var(--c-red); }
.srow .ra { font-size: 10px; color: #999; margin-top: 2px; }
.op { display: flex; gap: 4px; margin-top: 4px; flex-wrap: wrap; align-items: center; }
.splk {
  font-size: 10px; font-weight: 600; text-decoration: none;
  padding: 3px 7px 3px 4px; border-radius: 10px;
  display: flex; align-items: center; gap: 3px;
  transition: .15s ease; white-space: nowrap;
}
.splk:active { filter: brightness(.88); }
.splk-dot { width: 13px; height: 13px; border-radius: 50%; flex-shrink: 0; }

.sp-boss { background: #e6faf5; color: #00b4a2; } .spb-d { background: #00b4a2; }
.sp-51   { background: #fff3e8; color: #e8700a; } .sp51-d { background: #e8700a; }
.sp-zl   { background: #ffeded; color: #d03030; } .spz-d { background: #d03030; }
.sp-rc   { background: #e8f2ff; color: #1677ff; } .spr-d { background: #1677ff; }
.sp-web  { background: #fff8eb; color: #b86e00; } .spw-d { background: #b86e00; }

.splk-del {
  font-size: 10px; border: none; background: #ff4d4f; color: #fff;
  border-radius: 4px; cursor: pointer; padding: 2px 7px;
}
.splk-del:hover { opacity: .85; }
</style>
