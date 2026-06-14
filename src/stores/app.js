import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// 默认家坐标（黄岛区政府附近）
const DEFAULT_HOME = { lng: 120.141, lat: 35.998, name: '青岛黄岛区学院路288号' }

export const useAppStore = defineStore('app', () => {
  // --- 家 ---
  const homeLng = ref(DEFAULT_HOME.lng)
  const homeLat = ref(DEFAULT_HOME.lat)
  const homeName = ref(DEFAULT_HOME.name)

  // --- 搜索模式 ---
  const mode = ref('dist')  // 'dist' | 'rect' | 'circle' | 'view'

  // --- UI 状态 ---
  const showMarkers = ref(true)
  const showSavedPanel = ref(false)
  const isSearching = ref(false)
  const toast = ref('')
  const toastDuration = ref(3000)

  // --- 区选择 ---
  const selectedDistricts = ref(['黄岛区'])

  // --- 绘制状态 ---
  const drawBounds = ref(null)    // { sw, ne } for rect/view
  const drawCenter = ref(null)    // [lng, lat] for circle
  const drawRadius = ref(0)       // meters for circle

  // --- 家距离圈 ---
  const homeCircles = ref([])     // radius in km

  // --- 绘制状态 ---
  const isDrawing = ref(false)     // mouseTool 等待用户绘制中

  // --- 搜索竞态控制 ---
  const searchGen = ref(0)
  function bumpSearchGen() {
    return ++searchGen.value
  }

  // --- Computed ---
  const homePosition = computed(() => [homeLng.value, homeLat.value])

  // --- Actions ---
  function setHome(lng, lat, name) {
    homeLng.value = lng
    homeLat.value = lat
    homeName.value = name || `自定(${lng.toFixed(4)},${lat.toFixed(4)})`
  }

  function setMode(m) {
    mode.value = m
    // 清空绘制数据
    drawBounds.value = null
    drawCenter.value = null
    drawRadius.value = 0
  }

  function showToast(msg, duration = 3000) {
    toast.value = msg
    toastDuration.value = duration
  }

  function clearDraw() {
    drawBounds.value = null
    drawCenter.value = null
    drawRadius.value = 0
  }

  return {
    homeLng, homeLat, homeName, homePosition,
    mode, selectedDistricts,
    showMarkers, showSavedPanel, isSearching,
    toast, toastDuration,
    drawBounds, drawCenter, drawRadius,
    homeCircles,
    isDrawing,
    setHome, setMode, showToast, clearDraw,
    searchGen, bumpSearchGen
  }
})
