/**
 * 公司评分算法 — 忠实地从原始 index.html 移植
 *
 * 评分维度：
 *   natureScore  — 企业性质 25%（基于公司名正则匹配，非高德 biz_type）
 *   distanceScore — 离家距离 20%
 *   scaleScore   — 规模推断 20%
 *   welfareScore — 福利推断 20%
 *   contactScore — 联系方式 15%
 *   + 行业匹配加分（最多 +20）
 *
 * 注意：个体工商户/工作室 会被过滤（返回 null）
 */

// 行业匹配关键词（加分用）
const MATCH = [
  '科技', '信息技术', '网络', '互联网', '通信', '电子', '计算机', '自动化',
  '数据', '智能', '新能源', '制造', '检测', '软件', '工程', '生物', '医药', '物流',
  '教育', '建筑', '食品', '化工', '机械', '新材料', '环保', '服装'
]

// Haversine 距离计算（与原始一致）
function haversine(lng1, lat1, lng2, lat2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * @param {Object} company — 已解析的公司数据（parseRestPoi 格式）
 *   必须有: name, address, bizType, type, phone, website, email, amapRating, lng, lat, distance
 * @param {number} homeLng — 家经度
 * @param {number} homeLat — 家纬度
 * @returns {Object|null} 评分对象，或 null（被过滤）
 */
export function calculateScore(company, homeLng, homeLat) {
  const n = company.name || ''
  const tel = company.phone || ''
  const web = company.website || ''
  const email = company.email || ''
  const rt = company.amapRating || ''

  // 过滤个体工商户/工作室（对齐原版：只检查公司名）
  if (/个体工商户/.test(n) || /工作室/.test(n)) return null

  // 对齐原版: t = (n + ' ' + b + ' ' + c).toLowerCase()
  // b = biz_type, c = type — 都需要用于行业匹配
  const t = (n + ' ' + (company.bizType || '') + ' ' + (company.type || '')).toLowerCase()

  // --- 距离 20% ---
  let ds = 50
  let dkm = company.distance
  if (dkm == null && company.lng && company.lat) {
    dkm = haversine(company.lng, company.lat, homeLng, homeLat)
  }
  if (dkm != null) {
    if (dkm <= 3) ds = 100
    else if (dkm <= 5) ds = 90
    else if (dkm <= 7) ds = 80
    else if (dkm <= 10) ds = 65
    else if (dkm <= 15) ds = 50
    else if (dkm <= 20) ds = 35
    else if (dkm <= 30) ds = 20
    else ds = 8
  }

  // --- 企业性质 25% ---
  let ns = 30
  let nature = '民营'
  if (/外商独资|外国法人独资|外商投资|^外资|外国/.test(n)) { ns += 60; nature = '外资' }
  else if (/中外合资|合资/.test(n)) { ns += 50; nature = '合资' }
  else if (/股份有限公司/.test(n)) { ns += 55; nature = '股份' }
  else if (/有限责任公司/.test(n)) { ns += 40; nature = '民营' }
  else if (/有限公司/.test(n)) { ns += 35; nature = '民营' }
  else if (/有限合伙/.test(n)) { ns += 25; nature = '民营' }
  else if (/集团/.test(n) && /控股/.test(n)) { ns += 45; nature = '股份' }
  else if (/集团/.test(n)) { ns += 35; nature = '民营' }
  else if (/公司/.test(n)) { ns += 30; nature = '民营' }
  else { ns += 10; nature = '其他' }

  // --- 规模推断 20% ---
  let ss = 20
  if (/集团|控股/.test(n)) ss += 30
  if (/股份/.test(n)) ss += 20
  if (/分公司|子公司|分支机构/.test(n)) ss += 25
  if (/连锁/.test(n)) ss += 15
  if (rt) {
    const rf = parseFloat(rt)
    if (rf > 4.5) ss += 20
    else if (rf > 4) ss += 15
    else if (rf > 3.5) ss += 10
  }

  // --- 福利推断 20% ---
  let ws = 20
  if (nature === '外资') ws += 50
  else if (nature === '股份') ws += 40
  else if (nature === '合资') ws += 35
  else if (nature === '民营') ws += 25
  else ws += 10
  if (tel) ws += 15
  if (web) ws += 10
  if (rt) {
    const rf = parseFloat(rt)
    if (rf > 4.5) ws += 12
    else if (rf > 4) ws += 8
  }

  // --- 联系方式 15% ---
  let cs = 10
  if (tel) cs += 55
  if (web) cs += 25
  if (email) cs += 10

  // --- 行业匹配加分 ---
  let indBonus = 0
  for (let i = 0; i < MATCH.length; i++) {
    if (t.indexOf(MATCH[i]) >= 0) indBonus += 4
  }
  indBonus = Math.min(20, indBonus)

  // 上限
  ns = Math.min(100, ns)
  ss = Math.min(100, ss)
  ws = Math.min(100, ws)
  cs = Math.min(100, cs)
  ds = Math.min(100, ds)

  const total = ns * 0.25 + ds * 0.20 + ss * 0.20 + ws * 0.20 + cs * 0.15 + indBonus

  return {
    name: n,
    address: company.address || '',
    nature,
    total: Math.round(total * 10) / 10,
    natureScore: Math.round(ns),
    distanceScore: Math.round(ds),
    scaleScore: Math.round(ss),
    welfareScore: Math.round(ws),
    contactScore: Math.round(cs),
    phone: tel,
    website: web,
    lng: company.lng,
    lat: company.lat,
    distance: dkm,
    amapRating: rt
  }
}
