/**
 * 导出搜索结果 CSV（对齐原版格式）
 * @param {Array} results — searchStore.allResults (已排序)
 * @returns {string} CSV 内容
 */
export function generateSearchCsv(results) {
  function safeStr(v) { return String(v || '').replace(/"/g, '""') }
  const rows = ['﻿排名,总分,公司名,企业性质,地址,距离(km),企业性质分,规模分,福利分,距离分,联系方式分,电话,官网']
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    rows.push([
      i + 1, r.total,
      '"' + safeStr(r.name) + '"',
      r.nature,
      '"' + safeStr(r.address) + '"',
      r.distance !== null ? r.distance.toFixed(1) : '',
      r.natureScore, r.scaleScore, r.welfareScore, r.distanceScore, r.contactScore,
      r.phone || '', r.website || ''
    ].join(','))
  }
  return rows.join('\n')
}

/**
 * 导出收藏名单 CSV
 * @param {Array} savedList — searchStore.savedList
 * @returns {string} CSV 内容
 */
export function generateSavedCsv(savedList) {
  function safeStr(v) { return String(v || '').replace(/"/g, '""') }
  const rows = ['﻿排名,总分,公司名,地址,企业性质,电话,官网']
  for (let i = 0; i < savedList.length; i++) {
    const r = savedList[i]
    rows.push([
      i + 1, r.total,
      '"' + safeStr(r.name) + '"',
      '"' + safeStr(r.address) + '"',
      r.nature, r.phone || '', r.website || ''
    ].join(','))
  }
  return rows.join('\n')
}

/**
 * 触发浏览器下载 CSV
 * @param {string} csvText — CSV 文本内容
 * @param {string} filename — 文件名
 */
export function downloadCsv(csvText, filename) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(a.href)
}

/**
 * 生成带时间戳的 CSV 文件名
 */
export function timestampCsvName() {
  const dt = new Date()
  return 'companies_' + dt.getFullYear() +
    ('0' + (dt.getMonth() + 1)).slice(-2) +
    ('0' + dt.getDate()).slice(-2) + '_' +
    ('0' + dt.getHours()).slice(-2) +
    ('0' + dt.getMinutes()).slice(-2) + '.csv'
}
