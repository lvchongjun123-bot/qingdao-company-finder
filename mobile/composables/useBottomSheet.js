import { ref, computed } from 'vue'

/**
 * 底部抽屉触摸拖拽 composable（单例模式）
 *
 * 三个吸附点（相对于屏幕底部）：
 *   collapsed: 60px 露出拖拽条和标题
 *   half:      45vh 露出约半屏结果
 *   expanded:  85vh 几乎全屏
 */

const SNAP_COLLAPSED = 60    // px — 仅拖拽条+标题
const SNAP_HALF = 0.45       // 比例 — 约半屏
const SNAP_EXPANDED = 0.85   // 比例 — 近全屏

// 模块级单例状态
const snap = ref('collapsed')
const dragging = ref(false)
const translateY = ref(0)

// 拖拽起始
let startY = 0
let startTranslate = 0
let startTime = 0

// --- 吸附点 px 值 ---
function snapValue(name, vh) {
  const h = vh || (typeof window !== 'undefined' ? window.innerHeight : 932)
  switch (name) {
    case 'collapsed': return h - SNAP_COLLAPSED
    case 'half':      return h * (1 - SNAP_HALF)
    case 'expanded':  return h * (1 - SNAP_EXPANDED)
    default:          return h - SNAP_COLLAPSED
  }
}

// 初始化
if (typeof window !== 'undefined') {
  translateY.value = snapValue('collapsed')
}

// 所有吸附点（按位置排序：最小=最展开）
function allSnaps(vh) {
  const h = vh || (typeof window !== 'undefined' ? window.innerHeight : 932)
  return [
    { name: 'expanded',  y: snapValue('expanded', h) },
    { name: 'half',      y: snapValue('half', h) },
    { name: 'collapsed', y: snapValue('collapsed', h) }
  ]
}

// clamp
function clampY(y, vh) {
  const h = vh || (typeof window !== 'undefined' ? window.innerHeight : 932)
  return Math.max(snapValue('expanded', h), Math.min(y, snapValue('collapsed', h)))
}

// --- 触摸事件 ---
function onTouchStart(e) {
  const touch = e.touches[0]
  startY = touch.clientY
  startTranslate = translateY.value
  startTime = Date.now()
  dragging.value = true
}

function onTouchMove(e) {
  if (!dragging.value) return
  const touch = e.touches[0]
  const deltaY = touch.clientY - startY
  translateY.value = clampY(startTranslate + deltaY)
  e.preventDefault()
}

function onTouchEnd() {
  if (!dragging.value) return
  dragging.value = false

  const h = window.innerHeight
  const velocity = (translateY.value - startTranslate) / (Date.now() - startTime) * 1000  // px/s
  const snaps = allSnaps(h)

  // 根据速度和位置选择吸附点
  let target
  if (Math.abs(velocity) > 300) {
    // 快速滑动：按方向
    if (velocity > 0) {
      // 向下滑 → 下一个更折叠的位置
      target = snaps.find(s => s.y > translateY.value + 1) || snaps[snaps.length - 1]
    } else {
      // 向上滑 → 下一个更展开的位置
      const rev = [...snaps].reverse()
      target = rev.find(s => s.y < translateY.value - 1) || snaps[0]
    }
  } else {
    // 慢速释放：吸附到最近的位置
    target = snaps.reduce((best, s) =>
      Math.abs(s.y - translateY.value) < Math.abs(best.y - translateY.value) ? s : best
    )
  }

  snap.value = target.name
  translateY.value = target.y
}

// --- 编程式吸附 ---
function snapTo(name) {
  const h = window.innerHeight
  snap.value = name
  translateY.value = snapValue(name, h)
}

// 翻译 px → CSS transform
const sheetStyle = computed(() => ({
  transform: `translateY(${translateY.value}px)`,
  transition: dragging.value ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
}))

export function useBottomSheet() {
  return {
    snap,
    dragging,
    translateY,
    sheetStyle,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    snapTo,
    SNAP_COLLAPSED
  }
}
