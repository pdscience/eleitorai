<script setup>
import { ref, computed, onMounted } from 'vue'

const BASE = '/data'
async function loadCategoryFull(id) {
  const meta = await fetch(`${BASE}/${id}/meta.json`).then((r) => r.json())
  const pages = []
  for (let p = 1; p <= meta.pageCount; p++) {
    const data = await fetch(`${BASE}/${id}/pages/page-${String(p).padStart(4, '0')}.json`).then((r) => r.json())
    pages.push(...data)
  }
  return { meta, rows: pages }
}

const loading = ref(true)
const error = ref(null)
const cats = ref(null)

const selectedCargo = ref('')
const fmt = (v) => (v || 0).toLocaleString('pt-BR')
const fmtPct = (v) => (v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%'

const cargos = ['Governador', 'Senador', 'Deputado Federal', 'Deputado Estadual']

// ELEITOS: agrupados por candidato, com votos totais
const eleitos = computed(() => {
  if (!cats.value || !selectedCargo.value) return []
  const map = new Map()
  for (const r of cats.value) {
    if (r.DS_CARGO !== selectedCargo.value) continue
    if (!['ELEITO', 'ELEITO POR QP', 'ELEITO POR MEDIA'].includes(r.DS_SIT_TOT_TURNO)) continue
    const key = r.NR_CANDIDATO
    const c = map.get(key) || {
      nr: key,
      nome: r.NM_URNA_CANDIDATO || r.NM_CANDIDATO,
      nomeCompleto: r.NM_CANDIDATO,
      partido: r.SG_PARTIDO,
      situacao: r.DS_SIT_TOT_TURNO,
      votos: 0,
      municipios: new Set()
    }
    c.votos += Number(r.QT_VOTOS_NOMINAIS_VALIDOS) || 0
    c.municipios.add(r.NM_MUNICIPIO)
    map.set(key, c)
  }
  return [...map.values()].sort((a, b) => b.votos - a.votos)
})

// Métricas resumidas
const metricas = computed(() => {
  const e = eleitos.value
  if (!e.length) return null
  const totalVotos = e.reduce((s, c) => s + c.votos, 0)
  const media = totalVotos / e.length
  const max = e[0]?.votos || 0
  const min = e[e.length - 1]?.votos || 0
  const mediana = e.length % 2
    ? e[Math.floor(e.length / 2)].votos
    : (e[e.length / 2 - 1].votos + e[e.length / 2].votos) / 2
  return { total: e.length, totalVotos, media, mediana, max, min }
})

// Total de votos nominais válidos do cargo (para percentual)
const totalValidos = computed(() => {
  if (!cats.value || !selectedCargo.value) return 0
  const map = new Map()
  for (const r of cats.value) {
    if (r.DS_CARGO !== selectedCargo.value || String(r.NR_TURNO) !== '1') continue
    const key = r.NR_CANDIDATO
    map.set(key, (map.get(key) || 0) + (Number(r.QT_VOTOS_NOMINAIS_VALIDOS) || 0))
  }
  return [...map.values()].reduce((s, v) => s + v, 0)
})

// Partidos dos eleitos
const partidosEleitos = computed(() => {
  const map = new Map()
  for (const c of eleitos.value) {
    map.set(c.partido, (map.get(c.partido) || 0) + 1)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1])
})

onMounted(async () => {
  try {
    const a = await loadCategoryFull('candidatos')
    cats.value = a.rows
    selectedCargo.value = 'Governador'
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="eleitos">
    <header class="dash-head">
      <div>
        <span class="badge">Base de Referência · RO</span>
        <h1 style="margin-top:10px">Candidatos Eleitos 2022</h1>
        <p class="desc">
          Lista dos candidatos eleitos por cargo com métricas para uso como base de planejamento.
        </p>
      </div>
    </header>

    <div v-if="loading" class="loading"><div class="spinner"></div><div>Carregando candidatos…</div></div>
    <div v-else-if="error" class="loading">Erro: {{ error }}</div>

    <template v-else>
      <div class="sim-toolbar">
        <label class="dash-select">
          <span>Cargo</span>
          <select v-model="selectedCargo">
            <option v-for="c in cargos" :key="c" :value="c">{{ c }}</option>
          </select>
        </label>
      </div>

      <!-- Métricas resumidas -->
      <section class="kpis" v-if="metricas">
        <div class="kpi">
          <div class="k">Eleitos</div>
          <div class="v">{{ metricas.total }}</div>
          <div class="s">candidatos eleitos</div>
        </div>
        <div class="kpi">
          <div class="k">Total de votos</div>
          <div class="v">{{ fmt(metricas.totalVotos) }}</div>
          <div class="s">soma dos eleitos</div>
        </div>
        <div class="kpi">
          <div class="k">Média de votos</div>
          <div class="v">{{ fmt(Math.round(metricas.media)) }}</div>
          <div class="s">por candidato eleito</div>
        </div>
        <div class="kpi">
          <div class="k">Mediana</div>
          <div class="v">{{ fmt(Math.round(metricas.mediana)) }}</div>
          <div class="s">votos centrais</div>
        </div>
        <div class="kpi">
          <div class="k">Maior / Menor</div>
          <div class="v">{{ fmt(metricas.max) }}</div>
          <div class="s">até {{ fmt(metricas.min) }}</div>
        </div>
      </section>

      <!-- Distribuição por partido -->
      <section class="card eleitos-partidos" v-if="partidosEleitos.length">
        <h2>Distribuição por partido</h2>
        <div class="sub">Quantidade de cadeiras por partido entre os eleitos.</div>
        <div class="partido-grid">
          <div v-for="[pt, n] in partidosEleitos" :key="pt" class="partido-chip">
            <span class="partido-name">{{ pt }}</span>
            <span class="partido-count">{{ n }}</span>
          </div>
        </div>
      </section>

      <!-- Lista de eleitos -->
      <section class="card eleitos-lista">
        <h2>{{ selectedCargo }} — Eleitos</h2>
        <div class="sub">{{ metricas?.total }} candidatos eleitos, ordenados por votos.</div>
        <div class="eleitos-table">
          <div class="eleitos-header">
            <span class="el-rank">#</span>
            <span class="el-nome">Candidato</span>
            <span class="el-partido">Partido</span>
            <span class="el-votos">Votos</span>
            <span class="el-pct">% válidos</span>
            <span class="el-sit">Situação</span>
          </div>
          <div v-for="(c, i) in eleitos" :key="c.nr" class="eleitos-row">
            <span class="el-rank">{{ i + 1 }}</span>
            <span class="el-nome">
              <span class="el-nome-urna">{{ c.nome }}</span>
              <span class="el-nome-completo">{{ c.nomeCompleto }}</span>
            </span>
            <span class="el-partido">{{ c.partido }}</span>
            <span class="el-votos">{{ fmt(c.votos) }}</span>
            <span class="el-pct">{{ totalValidos ? fmtPct(c.votos / totalValidos) : '—' }}</span>
            <span class="el-sit">
              <span class="sit-badge" :class="{
                'sit-eleito': c.situacao === 'ELEITO',
                'sit-qp': c.situacao === 'ELEITO POR QP',
                'sit-media': c.situacao === 'ELEITO POR MEDIA'
              }">{{ c.situacao }}</span>
            </span>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
