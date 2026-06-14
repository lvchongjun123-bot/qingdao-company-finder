import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useSearchStore = defineStore('search', () => {
  // --- 原始结果 ---
  const allResults = ref([])

  // --- 排序 ---
  const currentSort = ref('total')

  // --- 分页 ---
  const currentPage = ref(1)
  const pageSize = ref(50)

  // --- 收藏名单 ---
  const SAVED_KEY = 'qd_saved_companies'
  const savedList = ref([])

  // 从 localStorage 加载（对齐原版）
  try {
    const stored = localStorage.getItem(SAVED_KEY)
    if (stored) savedList.value = JSON.parse(stored)
  } catch(e) { savedList.value = [] }

  // --- 搜索进度 ---
  const searchProgress = ref(0)      // 0-100
  const searchProgressText = ref('')

  // --- Computed ---
  const sortedResults = computed(() => {
    const arr = [...allResults.value]
    arr.sort((a, b) => (b[currentSort.value] || 0) - (a[currentSort.value] || 0))
    return arr
  })

  const totalPages = computed(() => Math.max(1, Math.ceil(sortedResults.value.length / pageSize.value)))

  const currentPageData = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value
    return sortedResults.value.slice(start, start + pageSize.value)
  })

  // --- Company key helper ---
  function companyKey(company) {
    return company.name + '|' + (company.address || '')
  }

  // --- Actions ---
  function setResults(results) {
    allResults.value = results
    currentPage.value = 1
  }

  function setSort(s) {
    currentSort.value = s
    currentPage.value = 1
  }

  function goToPage(p) {
    currentPage.value = Math.max(1, Math.min(p, totalPages.value))
  }

  function toggleSave(company) {
    const key = companyKey(company)
    const idx = savedList.value.findIndex(c => companyKey(c) === key)
    if (idx >= 0) {
      savedList.value.splice(idx, 1)
    } else {
      savedList.value.push({
        name: company.name,
        address: company.address,
        total: company.total,
        nature: company.nature,
        phone: company.phone,
        website: company.website,
        lng: company.lng,
        lat: company.lat
      })
    }
    localStorage.setItem(SAVED_KEY, JSON.stringify(savedList.value))
  }

  function isSaved(company) {
    const key = companyKey(company)
    return savedList.value.some(c => companyKey(c) === key)
  }

  function clearSaved() {
    savedList.value = []
    localStorage.removeItem(SAVED_KEY)
  }

  return {
    allResults, currentSort, currentPage, pageSize,
    savedList,
    searchProgress, searchProgressText,
    sortedResults, totalPages, currentPageData,
    setResults, setSort, goToPage,
    toggleSave, isSaved, clearSaved, companyKey
  }
})
