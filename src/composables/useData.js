import { ref, reactive } from 'vue'

const cache = reactive({})

async function getJSON(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Falha ao carregar ${url}`)
  return res.json()
}

export function useData() {
  const index = ref(null)
  const meta = ref(null)
  const rows = ref([])
  const loading = ref(false)
  const error = ref(null)

  async function loadIndex() {
    if (cache.index) {
      index.value = cache.index
      return cache.index
    }
    const data = await getJSON('/data/index.json')
    cache.index = data
    index.value = data
    return data
  }

  async function loadCategory(id) {
    loading.value = true
    error.value = null
    rows.value = []
    try {
      const m = await getJSON(`/data/${id}/meta.json`)
      meta.value = m
      return m
    } catch (e) {
      error.value = e.message
      meta.value = null
    } finally {
      loading.value = false
    }
  }

  async function loadPage(id, page) {
    loading.value = true
    error.value = null
    try {
      const key = `${id}-p${page}`
      const data = cache[key] || (cache[key] = await getJSON(`/data/${id}/pages/page-${String(page).padStart(4, '0')}.json`))
      rows.value = data
    } catch (e) {
      error.value = e.message
      rows.value = []
    } finally {
      loading.value = false
    }
  }

  async function loadAll(id) {
    loading.value = true
    error.value = null
    try {
      const m = meta.value
      const keys = []
      for (let p = 1; p <= m.pageCount; p++) keys.push(p)
      const pages = await Promise.all(
        keys.map((p) => getJSON(`/data/${id}/pages/page-${String(p).padStart(4, '0')}.json`))
      )
      rows.value = pages.flat()
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  return { index, meta, rows, loading, error, loadIndex, loadCategory, loadPage, loadAll }
}
