<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import Sidebar from './components/Sidebar.vue'
import DataTable from './components/DataTable.vue'
import Dashboard from './components/Dashboard.vue'
import Simulador from './components/Simulador.vue'
import Eleitos from './components/Eleitos.vue'
import { useData } from './composables/useData.js'

const {
  index, meta, rows, loading, error,
  loadIndex, loadCategory, loadPage, loadAll
} = useData()

const activeId = ref('')
const showDashboard = ref(false)
const showSimulador = ref(false)
const showEleitos = ref(false)
const viewPage = ref(1)
const query = ref('')
const sortKey = ref('')
const sortDir = ref('asc')
const fullMode = ref(false)
const allRows = ref([])
const loadedServerPage = ref(1)
const viewSize = ref(50)
const jump = ref('')

const FULL_THRESHOLD = 50000
const VIEW_SIZES = [25, 50, 100, 200]

const activeMeta = computed(() => index.value?.categories.find(c => c.id === activeId.value) || null)

const serverPageSize = computed(() => meta.value?.pageSize || 5000)
const searchActive = computed(() => query.value.trim() !== '')

function onSelect(id) {
  if (id === '__dashboard__') {
    showDashboard.value = true
    showSimulador.value = false
    showEleitos.value = false
    activeId.value = '__dashboard__'
    return
  }
  if (id === '__simulador__') {
    showDashboard.value = false
    showSimulador.value = true
    showEleitos.value = false
    activeId.value = '__simulador__'
    return
  }
  if (id === '__eleitos__') {
    showDashboard.value = false
    showSimulador.value = false
    showEleitos.value = true
    activeId.value = '__eleitos__'
    return
  }
  showDashboard.value = false
  showSimulador.value = false
  showEleitos.value = false
  selectCategory(id)
}

async function selectCategory(id) {
  activeId.value = id
  viewPage.value = 1
  jump.value = ''
  query.value = ''
  sortKey.value = ''
  sortDir.value = 'asc'
  const m = await loadCategory(id)
  if (!m) return
  loadedServerPage.value = 1
  if (m.totalRows <= FULL_THRESHOLD) {
    fullMode.value = true
    await loadAll(id)
    allRows.value = rows.value
  } else {
    fullMode.value = false
    allRows.value = []
    await loadPage(id, 1)
  }
}

function onSort(colName) {
  if (sortKey.value === colName) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = colName
    sortDir.value = 'asc'
  }
}

const matches = (row) => {
  if (!query.value) return true
  const q = query.value.toLowerCase()
  return Object.values(row).some((v) => String(v).toLowerCase().includes(q))
}

const workingSet = computed(() => (fullMode.value ? allRows.value : rows.value))

const filteredSorted = computed(() => {
  let data = workingSet.value.filter(matches)
  if (sortKey.value) {
    const k = sortKey.value
    const dir = sortDir.value === 'asc' ? 1 : -1
    data = [...data].sort((a, b) => {
      const av = a[k]
      const bv = b[k]
      if (av === null || av === undefined) return 1
      if (bv === null || bv === undefined) return -1
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv), 'pt-BR') * dir
    })
  }
  return data
})

const viewTotal = computed(() => {
  if (fullMode.value) return filteredSorted.value.length
  if (searchActive.value) return filteredSorted.value.length
  return meta.value?.totalRows || 0
})

const totalPages = computed(() => {
  if (viewTotal.value === 0) return 1
  return Math.max(1, Math.ceil(viewTotal.value / viewSize.value))
})

const pageRows = computed(() => {
  const start = (viewPage.value - 1) * viewSize.value
  if (fullMode.value) {
    return filteredSorted.value.slice(start, start + viewSize.value)
  }
  const localOffset = searchActive.value
    ? start
    : ((viewPage.value - 1) * viewSize.value) % serverPageSize.value
  return filteredSorted.value.slice(localOffset, localOffset + viewSize.value)
})

const rangeStart = computed(() => {
  const n = viewTotal.value
  if (n === 0) return 0
  return (viewPage.value - 1) * viewSize.value + 1
})
const rangeEnd = computed(() => {
  const n = viewTotal.value
  return Math.min(viewPage.value * viewSize.value, n)
})

function serverPageForView(vp) {
  return Math.floor(((vp - 1) * viewSize.value) / serverPageSize.value) + 1
}

async function goToPage(p) {
  if (p < 1 || p > totalPages.value) return
  if (!fullMode.value && !searchActive.value) {
    const sp = serverPageForView(p)
    if (sp !== loadedServerPage.value) {
      loading.value = true
      await loadPage(activeId.value, sp)
      loadedServerPage.value = sp
    }
  }
  viewPage.value = p
  jump.value = ''
}

function jumpToPage() {
  const p = parseInt(jump.value, 10)
  if (!Number.isNaN(p)) goToPage(p)
}

function visiblePages() {
  const total = totalPages.value
  const cur = viewPage.value
  const span = 2
  let start = Math.max(1, cur - span)
  let end = Math.min(total, cur + span)
  if (end - start < span * 2) {
    if (start === 1) end = Math.min(total, start + span * 2)
    if (end === total) start = Math.max(1, end - span * 2)
  }
  const out = []
  for (let i = start; i <= end; i++) out.push(i)
  return out
}

const stats = computed(() => {
  const m = meta.value
  if (!m) return []
  return [
    { k: 'Registros', v: m.totalRows.toLocaleString('pt-BR') },
    { k: 'Colunas', v: m.columns.length },
    { k: 'Páginas', v: totalPages.value.toLocaleString('pt-BR') },
    { k: 'Modo', v: fullMode.value ? 'Completo' : 'Paginado' }
  ]
})

function pretty(name) {
  return name.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

onMounted(async () => {
  await loadIndex()
  if (index.value?.categories?.length) {
    await selectCategory(index.value.categories[0].id)
  }
})

watch(query, () => { viewPage.value = 1 })
watch(viewSize, () => { viewPage.value = 1 })
</script>

<template>
  <div class="app">
    <Sidebar
      :groups="index?.groups || {}"
      :categories="index?.categories || []"
      :active="activeId"
      @select="onSelect"
    />

    <main class="main">
      <Dashboard v-if="showDashboard" />
      <Simulador v-else-if="showSimulador" />
      <Eleitos v-else-if="showEleitos" />
      <template v-else-if="activeMeta">
        <header class="topbar">
          <div>
            <span class="badge">{{ activeMeta.year }} · {{ activeMeta.group }}</span>
            <h1 style="margin-top:10px">{{ activeMeta.name }}</h1>
            <p class="desc">{{ activeMeta.description }}</p>
          </div>
        </header>

        <section class="stats">
          <div v-for="s in stats" :key="s.k" class="stat">
            <div class="k">{{ s.k }}</div>
            <div class="v">{{ s.v }}</div>
          </div>
        </section>

        <div class="toolbar">
          <div class="search">
            <span class="ic">⌕</span>
            <input
              v-model="query"
              type="text"
              :placeholder="fullMode ? 'Buscar em toda a categoria...' : (searchActive ? 'Filtrando a página atual...' : 'Buscar nesta página...')"
            />
          </div>
          <div class="pgsize">
            <span>Por página</span>
            <select v-model.number="viewSize">
              <option v-for="s in VIEW_SIZES" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
          <span class="chip" :class="{ active: fullMode }">
            <b>{{ viewTotal.toLocaleString('pt-BR') }}</b>
            {{ fullMode ? 'registros carregados' : (searchActive ? 'na página atual' : 'no total') }}
          </span>
        </div>

        <div v-if="loading" class="loading">
          <div class="spinner"></div>
          <div>Carregando dados…</div>
        </div>
        <div v-else-if="error" class="loading">Erro: {{ error }}</div>

        <template v-else>
          <DataTable
            :columns="activeMeta.columns"
            :rows="pageRows"
            :sort-key="sortKey"
            :sort-dir="sortDir"
            @sort="onSort"
          />

          <div class="pager">
            <div class="info">
              Exibindo <b>{{ rangeStart.toLocaleString('pt-BR') }}</b>–<b>{{ rangeEnd.toLocaleString('pt-BR') }}</b>
              de <b>{{ viewTotal.toLocaleString('pt-BR') }}</b>
              · página <b>{{ viewPage }}</b>/<b>{{ totalPages }}</b>
            </div>
            <div class="pages">
              <button class="pbtn edge" :disabled="viewPage === 1" @click="goToPage(1)">«</button>
              <button class="pbtn edge" :disabled="viewPage === 1" @click="goToPage(viewPage - 1)">‹</button>
              <button
                v-for="p in visiblePages()"
                :key="p"
                class="pbtn"
                :class="{ active: p === viewPage }"
                @click="goToPage(p)"
              >{{ p }}</button>
              <button class="pbtn edge" :disabled="viewPage === totalPages" @click="goToPage(viewPage + 1)">›</button>
              <button class="pbtn edge" :disabled="viewPage === totalPages" @click="goToPage(totalPages)">»</button>
              <span class="jump">
                <input v-model="jump" type="number" min="1" :max="totalPages" placeholder="ir" @keyup.enter="jumpToPage" />
                <button class="pbtn" @click="jumpToPage">↵</button>
              </span>
            </div>
          </div>
        </template>
      </template>

      <div v-else class="loading">
        <div class="spinner"></div>
        <div>Inicializando EleitorAi…</div>
      </div>
    </main>
  </div>
</template>
