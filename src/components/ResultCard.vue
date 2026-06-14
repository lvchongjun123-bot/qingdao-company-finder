<template>
  <div class="rrow" @click="expanded = !expanded">
    <div class="rt">
      <span class="rn">
        {{ index }}. {{ company.name }}
        <a v-if="company.website" :href="company.website" target="_blank"
          class="rweb" title="官网: {{ company.website }}" @click.stop>🔗</a>
        <span class="rnatur" :class="'nat-' + natureText">{{ natureText }}</span>
        <button class="btn-save" :class="{ on: isSaved }"
          @click.stop="$emit('toggle-save')">{{ isSaved ? '★' : '☆' }}</button>
      </span>
      <span class="rs" :class="scoreClass">{{ company.total }}</span>
    </div>
    <div class="rm">
      <span>{{ natureText }}</span><span>·</span>
      <span>{{ dstStr }}</span>
      <template v-if="company.amapRating"><span>· ⭐{{ company.amapRating }}</span></template>
    </div>
    <div class="ra">{{ company.address }}</div>

    <!-- 招聘平台链接 -->
    <div class="src-links" @click.stop>
      <a :href="bossUrl" target="_blank" class="slk slk-boss">
        <span class="slk-dot sb-d"></span>BOSS
      </a>
      <a :href="job51Url" target="_blank" class="slk slk-51">
        <span class="slk-dot s51-d"></span>前程
      </a>
      <a :href="zhilianUrl" target="_blank" class="slk slk-zl">
        <span class="slk-dot szl-d"></span>智联
      </a>
      <a :href="talentUrl" target="_blank" class="slk slk-rc">
        <span class="slk-dot src-d"></span>人才网
      </a>
      <a v-if="company.website" :href="company.website" target="_blank" class="slk slk-web">
        <span class="slk-dot sw-d"></span>官网
      </a>
    </div>

    <!-- 展开详情 -->
    <div class="rd" v-show="expanded" @click.stop>
      <table>
        <tbody>
        <tr><td>企业性质</td><td>{{ company.natureScore }}</td></tr>
        <tr><td>规模推断</td><td>{{ company.scaleScore }}</td></tr>
        <tr><td>福利推断</td><td>{{ company.welfareScore }}</td></tr>
        <tr><td>距离分</td><td>{{ company.distanceScore }} ({{ dstStr }})</td></tr>
        <tr><td>电话</td><td>{{ company.phone || '—' }}</td></tr>
        <tr v-if="company.website"><td>官网</td><td><a :href="company.website" target="_blank">{{ company.website }}</a></td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  company: Object,
  index: Number,
  isSaved: Boolean
})

defineEmits(['toggle-save'])

const expanded = ref(false)

const scoreClass = computed(() => {
  if (props.company.total >= 70) return 'h'
  if (props.company.total >= 50) return 'm'
  return 'l'
})

const natureText = computed(() => props.company.nature || '民营')
const dstStr = computed(() => props.company.distance != null ? props.company.distance.toFixed(1) + 'km' : '--')

const enc = computed(() => encodeURIComponent(props.company.name))
const bossUrl = computed(() => `https://www.zhipin.com/web/geek/job?query=${enc.value}&city=101120200`)
const job51Url = computed(() => `https://we.51job.com/pc/search?keyword=${enc.value}&area=370200`)
const zhilianUrl = computed(() => `https://sou.zhaopin.com/?jl=698&kw=${enc.value}`)
const talentUrl = computed(() => `https://fw.rc.qingdao.gov.cn/qdzhrcww/work/f60050102/showGw.action?gwglxm=${enc.value}`)
</script>

<style scoped>
.rrow {
  background: #fff;
  border: 1px solid var(--c-border);
  border-left: 4px solid #e8e8e8;
  border-radius: var(--r-md);
  padding: 10px 12px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: .2s ease;
  box-shadow: 0 2px 8px rgba(0,0,0,.04);
  position: relative;
}
.rrow:hover { box-shadow: 0 4px 12px rgba(0,0,0,.08); transform: translateY(-1px); }

.rt { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
.rn { font-weight: 600; font-size: 14px; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: flex; align-items: center; gap: 4px; }
.rs { font-size: 13px; font-weight: 700; padding: 2px 8px; border-radius: 10px; flex-shrink: 0; }
.rs.h { background: #f6ffed; color: #52c41a; }
.rs.m { background: #fff7e6; color: #fa8c16; }
.rs.l { background: #fff1f0; color: #ff4d4f; }

.rm { display: flex; gap: 8px; margin-bottom: 3px; font-size: 11px; color: #666; flex-wrap: wrap; }
.rnatur { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: normal; flex-shrink: 0; }
.nat-外资 { background: #fff0f6; color: #c41d7f; }
.nat-合资 { background: #fff7e6; color: #d46b08; }
.nat-股份 { background: #f6ffed; color: #389e0d; }
.nat-民营 { background: #e6f7ff; color: #096dd9; }
.nat-个体 { background: #f5f5f5; color: #666; }

.ra { font-size: 11px; color: #999; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 官网链接标记 */
.rweb {
  font-size: 12px;
  text-decoration: none;
  flex-shrink: 0;
  opacity: .7;
  transition: .2s ease;
}
.rweb:hover { opacity: 1; transform: scale(1.15); }

.btn-save {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
  transition: .2s ease;
  color: #ccc;
  flex-shrink: 0;
  line-height: 1;
}
.btn-save.on { color: #faad14; }

.rd { margin-top: 6px; padding-top: 6px; border-top: 1px solid #e8e8e8; font-size: 11px; color: #666; }
.rd table { width: 100%; border-collapse: collapse; }
.rd td { padding: 3px 4px; }
.rd td:first-child { color: #999; width: 80px; }
.rd a { color: #1677ff; text-decoration: none; }
.rd a:hover { text-decoration: underline; }

.src-links {
  margin-top: 4px;
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.slk {
  font-size: 10px; font-weight: 600; text-decoration: none;
  padding: 3px 8px 3px 5px; border-radius: 12px;
  display: flex; align-items: center; gap: 4px;
  transition: .2s ease; white-space: nowrap;
  border: none;
}
.slk:active { filter: brightness(.88); }

.slk-dot { width: 15px; height: 15px; border-radius: 50%; flex-shrink: 0; }

/* BOSS直聘 — 青绿 */
.slk-boss { background: #e6faf5; color: #00b4a2; }
.sb-d { background: #00b4a2; }

/* 前程无忧 — 橙色 */
.slk-51 { background: #fff3e8; color: #e8700a; }
.s51-d { background: #e8700a; }

/* 智联招聘 — 红色 */
.slk-zl { background: #ffeded; color: #d03030; }
.szl-d { background: #d03030; }

/* 青岛人才网 — 蓝色 */
.slk-rc { background: #e8f2ff; color: #1677ff; }
.src-d { background: #1677ff; }

/* 官网 — 琥珀 */
.slk-web { background: #fff8eb; color: #b86e00; }
.sw-d { background: #b86e00; }
</style>
