<template>
  <div class="mrlist">
    <!-- 进度条 -->
    <div class="mr-prog" v-if="appStore.isSearching">
      <div class="mr-prog-bar"><div :style="{ width: searchStore.searchProgress + '%' }"></div></div>
      <div class="mr-prog-txt">{{ searchStore.searchProgressText }}</div>
    </div>

    <!-- 排序 -->
    <div class="mr-sort" v-if="!appStore.isSearching && searchStore.allResults.length">
      <span class="mr-sort-label">{{ searchStore.allResults.length }} 家</span>
      <div class="mr-sort-btns">
        <button v-for="s in sortOptions" :key="s.key"
          :class="{ on: searchStore.currentSort === s.key }"
          @click="searchStore.setSort(s.key)">{{ s.label }}</button>
      </div>
    </div>

    <!-- 列表 -->
    <div class="mr-cards">
      <div v-for="(company, i) in searchStore.currentPageData"
        :key="company.name + '|' + company.address"
        class="mr-card" @click="toggleExpand(i)">
        <!-- 主信息行 -->
        <div class="mrc-top">
          <div class="mrc-left">
            <span class="mrc-idx">{{ (searchStore.currentPage - 1) * searchStore.pageSize + i + 1 }}.</span>
            <span class="mrc-name">{{ company.name }}</span>
            <span class="mrc-nat" :class="'nat-' + (company.nature || '民营')">{{ company.nature || '民营' }}</span>
          </div>
          <div class="mrc-right">
            <button class="mrc-save" :class="{ on: searchStore.isSaved(company) }"
              @click.stop="searchStore.toggleSave(company)">
              {{ searchStore.isSaved(company) ? '★' : '☆' }}
            </button>
            <span class="mrc-score" :class="scoreClass(company.total)">{{ company.total }}</span>
          </div>
        </div>

        <!-- 副信息 -->
        <div class="mrc-sub">
          <span>{{ company.nature || '民营' }}</span>
          <span>·</span>
          <span>{{ company.distance != null ? company.distance.toFixed(1) + 'km' : '--' }}</span>
          <span v-if="company.amapRating">· ⭐{{ company.amapRating }}</span>
        </div>
        <div class="mrc-addr">{{ company.address }}</div>

        <!-- 招聘链接 -->
        <div class="mrc-links" @click.stop>
          <a :href="bossUrl(company)" target="_blank" class="mrlk mrlk-boss">
            <span class="mrlk-ico boss-ico">B</span>BOSS
          </a>
          <a :href="job51Url(company)" target="_blank" class="mrlk mrlk-job51">
            <span class="mrlk-ico job51-ico">51</span>前程
          </a>
          <a :href="zhilianUrl(company)" target="_blank" class="mrlk mrlk-zhilian">
            <span class="mrlk-ico zhilian-ico">智</span>智联
          </a>
          <a :href="rencaiUrl(company)" target="_blank" class="mrlk mrlk-rencai">
            <span class="mrlk-ico rencai-ico">才</span>人才网
          </a>
          <a v-if="company.website" :href="company.website" target="_blank" class="mrlk mrlk-web">
            <span class="mrlk-ico web-ico">官</span>官网
          </a>
        </div>

        <!-- 展开详情 -->
        <div class="mrc-detail" v-show="expanded[i]">
          <div class="mrc-row"><span class="mrc-label">企业性质</span><span>{{ company.natureScore }}</span></div>
          <div class="mrc-row"><span class="mrc-label">规模推断</span><span>{{ company.scaleScore }}</span></div>
          <div class="mrc-row"><span class="mrc-label">福利推断</span><span>{{ company.welfareScore }}</span></div>
          <div class="mrc-row"><span class="mrc-label">距离分</span><span>{{ company.distanceScore }} ({{ company.distance != null ? company.distance.toFixed(1) + 'km' : '--' }})</span></div>
          <div class="mrc-row"><span class="mrc-label">电话</span><span>{{ company.phone || '—' }}</span></div>
          <div class="mrc-row" v-if="company.website"><span class="mrc-label">官网</span><span><a :href="company.website" target="_blank">{{ company.website }}</a></span></div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="!searchStore.currentPageData.length && !appStore.isSearching" class="mr-empty">
        当前范围未找到公司<br>建议: 换区域 / 扩大视野 / 检查网络
      </div>
    </div>

    <!-- 分页 -->
    <div class="mr-pager" v-if="searchStore.totalPages > 1 && !appStore.isSearching">
      <button :disabled="searchStore.currentPage <= 1" @click="searchStore.goToPage(searchStore.currentPage - 1)">&lt;</button>
      <template v-for="(p, pi) in pageButtons" :key="pi">
        <span v-if="p === '...'" class="mr-pg-dots">...</span>
        <button v-else :class="{ on: p === searchStore.currentPage }" @click="searchStore.goToPage(p)">{{ p }}</button>
      </template>
      <button :disabled="searchStore.currentPage >= searchStore.totalPages" @click="searchStore.goToPage(searchStore.currentPage + 1)">&gt;</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppStore } from '../../src/stores/app'
import { useSearchStore } from '../../src/stores/search'

const appStore = useAppStore()
const searchStore = useSearchStore()

const expanded = ref({})

function toggleExpand(i) {
  expanded.value[i] = !expanded.value[i]
}

function scoreClass(total) {
  if (total >= 70) return 'h'
  if (total >= 50) return 'm'
  return 'l'
}

function bossUrl(c) { return `https://www.zhipin.com/web/geek/job?query=${encodeURIComponent(c.name)}&city=101120200` }
function job51Url(c) { return `https://we.51job.com/pc/search?keyword=${encodeURIComponent(c.name)}&area=370200` }
function zhilianUrl(c) { return `https://sou.zhaopin.com/?jl=698&kw=${encodeURIComponent(c.name)}` }
function rencaiUrl(c) { return `https://fw.rc.qingdao.gov.cn/qdzhrcww/work/f60050102/showGw.action?gwglxm=${encodeURIComponent(c.name)}` }

const sortOptions = [
  { key: 'total', label: '综合' },
  { key: 'distanceScore', label: '距离' },
  { key: 'scaleScore', label: '规模' },
  { key: 'welfareScore', label: '福利' }
]

const pageButtons = computed(() => {
  const current = searchStore.currentPage
  const total = searchStore.totalPages
  const buttons = []
  const startP = Math.max(1, current - 2)
  const endP = Math.min(total, current + 2)
  if (startP > 1) {
    buttons.push(1)
    if (startP > 2) buttons.push('...')
  }
  for (let p = startP; p <= endP; p++) buttons.push(p)
  if (endP < total) {
    if (endP < total - 1) buttons.push('...')
    buttons.push(total)
  }
  return buttons
})
</script>

<style scoped>
.mrlist { padding-top: 4px; }

/* 进度条 */
.mr-prog { margin-bottom: 8px; }
.mr-prog-bar { background: #f0f0f0; border-radius: 3px; height: 4px; }
.mr-prog-bar div { background: #1677ff; height: 100%; border-radius: 3px; transition: width .3s; }
.mr-prog-txt { font-size: 11px; color: #999; margin-top: 2px; }

/* 排序 */
.mr-sort { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.mr-sort-label { font-size: 12px; font-weight: 600; color: #666; white-space: nowrap; }
.mr-sort-btns { display: flex; gap: 4px; }
.mr-sort-btns button {
  padding: 4px 10px;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  font-size: 11px;
  background: #fafafa;
  cursor: pointer;
}
.mr-sort-btns button.on { background: #fa8c16; color: #fff; border-color: #fa8c16; }

/* 卡片 */
.mr-cards { display: flex; flex-direction: column; gap: 6px; }
.mr-card {
  background: #fff;
  border: 1px solid #e8e8e8;
  border-left: 4px solid #e8e8e8;
  border-radius: 10px;
  padding: 10px 12px;
  transition: .2s;
}
.mr-card:active { background: #fafafa; }

.mrc-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
.mrc-left { display: flex; align-items: center; gap: 4px; flex: 1; min-width: 0; flex-wrap: wrap; }
.mrc-idx { font-size: 12px; color: #999; }
.mrc-name { font-size: 15px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px; }
.mrc-nat { padding: 2px 6px; border-radius: 4px; font-size: 10px; flex-shrink: 0; }
.nat-外资 { background: #fff0f6; color: #c41d7f; }
.nat-合资 { background: #fff7e6; color: #d46b08; }
.nat-股份 { background: #f6ffed; color: #389e0d; }
.nat-民营 { background: #e6f7ff; color: #096dd9; }
.nat-个体 { background: #f5f5f5; color: #666; }

.mrc-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.mrc-save {
  background: none; border: none; font-size: 20px; cursor: pointer;
  padding: 4px; min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center;
  color: #ccc; transition: .2s;
}
.mrc-save.on { color: #faad14; }
.mrc-score { font-size: 14px; font-weight: 700; padding: 2px 8px; border-radius: 10px; min-width: 40px; text-align: center; }
.mrc-score.h { background: #f6ffed; color: #52c41a; }
.mrc-score.m { background: #fff7e6; color: #fa8c16; }
.mrc-score.l { background: #fff1f0; color: #ff4d4f; }

.mrc-sub { display: flex; gap: 6px; font-size: 12px; color: #666; margin-bottom: 2px; }
.mrc-addr { font-size: 12px; color: #999; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 招聘链接 */
.mrc-links { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }

.mrlk {
  font-size: 10px; font-weight: 600; text-decoration: none;
  padding: 5px 10px 5px 6px; border-radius: 16px;
  display: inline-flex; align-items: center; gap: 5px;
  min-height: 32px; min-width: 44px;
  border: none;
  letter-spacing: .5px;
}

/* 图标球 */
.mrlk-ico {
  width: 22px; height: 22px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; color: #fff;
  flex-shrink: 0;
}

/* BOSS直聘 — 青绿色 */
.mrlk-boss { background: #e6faf5; color: #00b4a2; }
.boss-ico { background: #00b4a2; }

/* 51job/前程无忧 — 橙色 */
.mrlk-job51 { background: #fff3e8; color: #e8700a; }
.job51-ico { background: #e8700a; }

/* 智联招聘 — 红色 */
.mrlk-zhilian { background: #ffeded; color: #d03030; }
.zhilian-ico { background: #d03030; }

/* 青岛人才网 — 蓝色 */
.mrlk-rencai { background: #e8f2ff; color: #1677ff; }
.rencai-ico { background: #1677ff; }

/* 官网 — 琥珀色 */
.mrlk-web { background: #fff8eb; color: #b86e00; }
.web-ico { background: #b86e00; }

.mrlk:active { filter: brightness(.9); }

/* 展开详情 */
.mrc-detail { margin-top: 8px; padding-top: 8px; border-top: 1px solid #f0f0f0; }
.mrc-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; }
.mrc-label { color: #999; }
.mrc-row a { color: #1677ff; text-decoration: none; }

/* 空 */
.mr-empty { text-align: center; padding: 30px; color: #999; line-height: 2; font-size: 13px; }

/* 分页 */
.mr-pager { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 10px 0 0; }
.mr-pager button {
  min-width: 34px; min-height: 34px; border: 1px solid #e8e8e8; border-radius: 8px;
  background: #fff; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.mr-pager button.on { background: #1677ff; color: #fff; border-color: #1677ff; }
.mr-pager button:disabled { opacity: .35; }
.mr-pg-dots { font-size: 12px; color: #999; }
</style>
