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

const cats = ref(null)
const eleit = ref(null)
const qtde = ref(null)
const loading = ref(true)
const error = ref(null)
const selected = ref('')

const fmt = (v) => (v || 0).toLocaleString('pt-BR')
const fmtPct = (v) => (v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%'

const candidates = computed(() => {
  if (!cats.value) return []
  const map = new Map()
  for (const r of cats.value) {
    const key = r.NR_CANDIDATO
    let c = map.get(key)
    if (!c) {
      c = {
        nr: key,
        urna: r.NM_URNA_CANDIDATO || r.NM_CANDIDATO,
        nome: r.NM_CANDIDATO,
        partido: r.SG_PARTIDO,
        cargo: r.DS_CARGO,
        turno: r.NR_TURNO,
        situacao: r.DS_SIT_TOT_TURNO,
        votos: 0,
        mun: new Set()
      }
      map.set(key, c)
    }
    c.votos += Number(r.QT_VOTOS_NOMINAIS_VALIDOS) || 0
    c.mun.add(r.NM_MUNICIPIO)
  }
  return [...map.values()].sort((a, b) => b.votos - a.votos)
})

const selectedCand = computed(() => candidates.value.find((c) => c.nr === selected.value) || null)
const selKey = computed(() =>
  selectedCand.value ? `${selectedCand.value.cargo}__${selectedCand.value.turno}` : ''
)

const candRows = computed(() =>
  cats.value && selectedCand.value
    ? cats.value.filter((r) => r.NR_CANDIDATO === selectedCand.value.nr)
    : []
)

// votos do candidato por município
const perMun = computed(() => {
  const out = {}
  for (const r of candRows.value) {
    const m = r.NM_MUNICIPIO
    out[m] = (out[m] || 0) + (Number(r.QT_VOTOS_NOMINAIS_VALIDOS) || 0)
  }
  return out
})

// mapa município -> {candidato: votos} restrito ao cargo/turno do candidato selecionado
const munCandMap = computed(() => {
  if (!cats.value || !selectedCand.value) return null
  const cargo = selectedCand.value.cargo
  const turno = String(selectedCand.value.turno)
  const map = {}
  for (const r of cats.value) {
    if (r.DS_CARGO !== cargo || String(r.NR_TURNO) !== turno) continue
    const m = r.NM_MUNICIPIO
    map[m] = map[m] || {}
    map[m][r.NR_CANDIDATO] = (map[m][r.NR_CANDIDATO] || 0) + (Number(r.QT_VOTOS_NOMINAIS_VALIDOS) || 0)
  }
  return map
})

// total de votos válidos nominais do cargo/turno no estado (base de comparação)
const qtdeIndex = computed(() => {
  if (!qtde.value || !selectedCand.value) return null
  const cargo = selectedCand.value.cargo
  const turno = String(selectedCand.value.turno)
  const byMun = {}
  let stateValid = 0
  let stateAptos = 0
  for (const r of qtde.value) {
    if (r.Cargo !== cargo || String(r.Turno) !== turno) continue
    const v = Number(r['Votos nominais válidos']) || 0
    byMun[r['Município']] = { valid: v, aptos: Number(r['Eleitorado apto']) || 0, abs: Number(r['Abstenções']) || 0 }
    stateValid += v
    stateAptos += Number(r['Eleitorado apto']) || 0
  }
  return { byMun, stateValid, stateAptos }
})

// ranking estadual de candidatos do cargo/turno
const stateRank = computed(() => {
  if (!cats.value || !selectedCand.value) return []
  const cargo = selectedCand.value.cargo
  const turno = String(selectedCand.value.turno)
  const map = new Map()
  for (const r of cats.value) {
    if (r.DS_CARGO !== cargo || String(r.NR_TURNO) !== turno) continue
    map.set(r.NR_CANDIDATO, (map.get(r.NR_CANDIDATO) || 0) + (Number(r.QT_VOTOS_NOMINAIS_VALIDOS) || 0))
  }
  return [...map.entries()].map(([nr, v]) => ({ nr, v })).sort((a, b) => b.v - a.v)
})

const analysis = computed(() => {
  if (!selectedCand.value || !qtdeIndex.value || !munCandMap.value) return null
  const cand = selectedCand.value
  const { byMun, stateValid, stateAptos } = qtdeIndex.value
  const candValid = cand.votos
  const share = stateValid ? candValid / stateValid : 0

  const rankIdx = stateRank.value.findIndex((x) => x.nr === cand.nr)
  const rank = rankIdx + 1
  const leader = stateRank.value[0]
  const gapLeader = leader ? leader.v - candValid : 0

  // posição por município + rankings de share
  const ranked = []
  const posCount = { 1: 0, 2: 0, 3: 0, other: 0 }
  for (const m of Object.keys(byMun)) {
    const votes = perMun.value[m] || 0
    const validMun = byMun[m].valid
    const shareMun = validMun ? votes / validMun : 0
    const competitors = munCandMap.value[m] || {}
    const sorted = Object.entries(competitors).sort((a, b) => b[1] - a[1])
    const pos = sorted.findIndex(([nr]) => nr === cand.nr) + 1
    if (pos === 1) posCount[1]++
    else if (pos === 2) posCount[2]++
    else if (pos === 3) posCount[3]++
    else posCount.other++
    ranked.push({ mun: m, votos: votes, validMun, share: shareMun, pos, aptos: byMun[m].aptos })
  }
  ranked.sort((a, b) => b.votos - a.votos)
  const maxVotos = ranked.reduce((mx, r) => Math.max(mx, r.votos), 0)
  const strongholds = ranked.slice(0, 8)
  const weaknesses = [...ranked].reverse().slice(0, 8)

  let abstTotal = 0
  for (const m in byMun) abstTotal += byMun[m].abs || 0
  const second = stateRank.value[1]
  const vencerVal = rank === 1 ? (second ? second.v - candValid : 0) : (leader ? leader.v - candValid : 0)
  const vencerTxt = rank === 1 ? 'vantagem sobre o 2º' : 'faltam para liderar'

  return {
    cand, candValid, stateValid, share, stateAptos, abstTotal,
    rank, totalCands: stateRank.value.length, gapLeader,
    vencerVal, vencerTxt,
    leaderName: leader ? candidates.value.find((c) => c.nr === leader.nr)?.urna : '',
    posCount, ranked, maxVotos, strongholds, weaknesses
  }
})

// perfil do eleitorado 2026 (agregado por dimensão)
const perfil = computed(() => {
  if (!eleit.value) return null
  const dims = ['Gênero', 'Faixa etária', 'Grau de instrução', 'Cor / Raça']
  const groups = {}
  let total = 0
  let comDef = 0
  let fac = 0
  for (const r of eleit.value) {
    const v = Number(r['Eleitorado']) || 0
    total += v
    comDef += Number(r['Com deficiência']) || 0
    fac += Number(r['Voto facultativo']) || 0
    for (const d of dims) {
      groups[d] = groups[d] || {}
      groups[d][r[d]] = (groups[d][r[d]] || 0) + v
    }
  }
  const toBars = (obj) =>
    Object.entries(obj)
      .map(([label, value]) => ({ label, value, pct: total ? value / total : 0 }))
      .sort((a, b) => b.value - a.value)
  return {
    total, comDef, fac,
    genero: toBars(groups['Gênero']),
    faixa: toBars(groups['Faixa etária']),
    instrucao: toBars(groups['Grau de instrução']),
    raca: toBars(groups['Cor / Raça'])
  }
})

const faixaGrouped = computed(() => {
  if (!perfil.value) return []
  const map = {
    '16 a 17 anos': ['16 anos', '17 anos'],
    '18 a 24 anos': ['18 anos', '19 anos', '20 anos', '21 a 24 anos'],
    '25 a 34 anos': ['25 a 29 anos', '30 a 34 anos'],
    '35 a 44 anos': ['35 a 39 anos', '40 a 44 anos'],
    '45 a 54 anos': ['45 a 49 anos', '50 a 54 anos'],
    '55 a 64 anos': ['55 a 59 anos', '60 a 64 anos'],
    '65 a 74 anos': ['65 a 69 anos', '70 a 74 anos'],
    '75 a 84 anos': ['75 a 79 anos', '80 a 84 anos'],
    '85+ anos': ['85 a 89 anos', '90 a 94 anos', '95 a 99 anos', '100 anos ou mais']
  }
  const byLabel = Object.fromEntries(perfil.value.faixa.map(d => [d.label, d.value]))
  return Object.entries(map)
    .map(([group, labels]) => {
      const value = labels.reduce((s, l) => s + (byLabel[l] || 0), 0)
      return { label: group, value, pct: perfil.value.total ? value / perfil.value.total : 0 }
    })
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)
})

const oportunidades = computed(() => {
  if (!qtdeIndex.value) return null
  const { byMun, stateAptos } = qtdeIndex.value
  const rows = Object.entries(byMun)
    .map(([mun, v]) => ({
      mun,
      aptos: v.aptos,
      abs: v.abs,
      taxa: v.aptos ? v.abs / v.aptos : 0
    }))
    .filter((r) => r.aptos > 0)
  const porAbst = [...rows].sort((a, b) => b.abs - a.abs).slice(0, 10)
  const porAptos = [...rows].sort((a, b) => b.aptos - a.aptos).slice(0, 10)
  const maxAbs = porAbst.reduce((mx, r) => Math.max(mx, r.abs), 0)
  const maxAptos = porAptos.reduce((mx, r) => Math.max(mx, r.aptos), 0)
  return { porAbst, porAptos, maxAbs, maxAptos, stateAptos }
})

// composição demográfica dos municípios (eleitorado 2026)
const munDem = computed(() => {
  if (!eleit.value) return null
  const dims = ['Gênero', 'Faixa etária', 'Grau de instrução', 'Cor / Raça']
  const dem = {}
  const tot = {}
  for (const r of eleit.value) {
    const m = r['Município']
    tot[m] = (tot[m] || 0) + (Number(r['Eleitorado']) || 0)
    dem[m] = dem[m] || {}
    for (const d of dims) {
      dem[m][d] = dem[m][d] || {}
      dem[m][d][r[d]] = (dem[m][d][r[d]] || 0) + (Number(r['Eleitorado']) || 0)
    }
  }
  return { dem, tot }
})

// share do candidato por município (2022)
const candShare = computed(() => {
  const o = {}
  if (analysis.value) for (const r of analysis.value.ranked) o[r.mun] = r.share
  return o
})

const DIMS_MAP = [
  { dim: 'Gênero', key: 'genero', title: 'Gênero' },
  { dim: 'Cor / Raça', key: 'raca', title: 'Cor / Raça' },
  { dim: 'Faixa etária', key: 'faixa', title: 'Faixa etária' },
  { dim: 'Grau de instrução', key: 'instrucao', title: 'Grau de instrução' }
]

// cruzamento desempenho 2022 x perfil 2026 -> afinidade e prioridade de abordagem
const perfilAlvo = computed(() => {
  if (!analysis.value || !munDem.value || !perfil.value) return null
  const { dem, tot } = munDem.value
  const cs = candShare.value
  const mus = Object.keys(cs).filter((m) => dem[m] && tot[m] > 0)
  const globalAvg = mus.reduce((s, m) => s + cs[m], 0) / mus.length
  const median = (arr) => {
    const a = [...arr].sort((x, y) => x - y)
    const n = a.length
    return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2
  }
  const flat = []
  const dims = []
  for (const { dim, key, title } of DIMS_MAP) {
    const items = perfil.value[key]
      .filter((c) => !['NÃO INFORMADO', 'Inválida'].includes(c.label))
      .map((c) => {
        const ws = mus.map((m) => (dem[m][dim][c.label] || 0) / tot[m])
        const med = median(ws)
        const hi = mus.filter((m, i) => ws[i] >= med)
        const avg = (arr) => arr.reduce((s, m) => s + cs[m], 0) / (arr.length || 1)
        const aff = (avg(hi) - globalAvg) * 100
        let tag = 'Neutro'
        if (aff >= 1) tag = 'Base natural'
        else if (aff <= -1) tag = 'Oportunidade'
        const prioridade = c.pct * Math.max(0, -aff)
        const item = { label: c.label, pct: c.pct, aff, tag, prioridade }
        flat.push(item)
        return item
      })
    dims.push({ title, items })
  }
  const top = flat
    .filter((x) => x.tag === 'Oportunidade')
    .sort((a, b) => b.prioridade - a.prioridade)
    .slice(0, 5)
  return { dims, top }
})

const MUN_PAGE = 10
const munPage = ref(1)
const totalMunPages = computed(() =>
  analysis.value ? Math.max(1, Math.ceil(analysis.value.ranked.length / MUN_PAGE)) : 1
)
const redutosPaged = computed(() =>
  analysis.value ? analysis.value.ranked.slice((munPage.value - 1) * MUN_PAGE, munPage.value * MUN_PAGE) : []
)
const fragilPaged = computed(() => {
  if (!analysis.value) return []
  const asc = [...analysis.value.ranked].sort((a, b) => a.votos - b.votos)
  const page = asc.slice((munPage.value - 1) * MUN_PAGE, munPage.value * MUN_PAGE)
  return page.reverse()
})
function goToMunPage(p) {
  if (p < 1 || p > totalMunPages.value) return
  munPage.value = p
}

const generoChart = computed(() => {
  if (!perfil.value) return null
  const colors = { FEMININO: 'var(--accent)', MASCULINO: 'var(--accent-3)' }
  let acc = 0
  const stops = perfil.value.genero.map((s) => {
    const start = acc * 100
    acc += s.pct
    return `${(colors[s.label] || 'var(--accent-2)')} ${start.toFixed(2)}% ${(acc * 100).toFixed(2)}%`
  }).join(', ')
  return {
    grad: `conic-gradient(${stops})`,
    segs: perfil.value.genero.map((s) => ({ label: s.label, pct: s.pct, color: colors[s.label] || 'var(--accent-2)' }))
  }
})

onMounted(async () => {
  try {
    const [a, b, c] = await Promise.all([
      loadCategoryFull('candidatos'),
      loadCategoryFull('eleitorado-2026'),
      loadCategoryFull('qtde-votacao-2022')
    ])
    cats.value = a.rows
    eleit.value = b.rows
    qtde.value = c.rows
    if (candidates.value.length) selected.value = candidates.value[0].nr
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="dash">
    <header class="dash-head">
      <div>
        <span class="badge">Painel Estratégico · RO</span>
        <h1 style="margin-top:10px">Painel do Candidato</h1>
        <p class="desc">
          Análise de desempenho em 2022 e do eleitorado projetado para 2026 — insumos para o planejamento de campanha.
        </p>
      </div>
    </header>

    <div v-if="loading" class="loading"><div class="spinner"></div><div>Carregando base eleitoral…</div></div>
    <div v-else-if="error" class="loading">Erro: {{ error }}</div>

    <template v-else>
      <div class="dash-toolbar">
        <label class="dash-select">
          <span>Candidato</span>
          <select v-model="selected">
            <option v-for="c in candidates" :key="c.nr" :value="c.nr">
              {{ c.urna }} ({{ c.partido }}) — {{ c.cargo }}
            </option>
          </select>
        </label>
        <div v-if="selectedCand" class="dash-candmeta">
          <span class="chip">{{ selectedCand.cargo }}</span>
          <span class="chip">{{ selectedCand.partido }}</span>
          <span class="chip">{{ selectedCand.situacao }}</span>
          <span class="chip">Turno {{ selectedCand.turno }}</span>
        </div>
      </div>

      <template v-if="analysis && perfil">
        <!-- KPIs -->
        <section class="kpis">
          <div class="kpi">
            <div class="k">Votos válidos (2022)</div>
            <div class="v">{{ fmt(analysis.candValid) }}</div>
          </div>
          <div class="kpi">
            <div class="k">Participação no cargo</div>
            <div class="v">{{ fmtPct(analysis.share) }}</div>
            <div class="s">do total de votos válidos do estado</div>
          </div>
          <div class="kpi">
            <div class="k">Para vencer no estado</div>
            <div class="v">{{ fmt(analysis.vencerVal) }}</div>
            <div class="s">{{ analysis.vencerTxt }}</div>
          </div>
          <div class="kpi">
            <div class="k">Eleitores a conquistar (2026)</div>
            <div class="v">{{ fmt(perfil.total - analysis.candValid) }}</div>
            <div class="s">eleitorado projetado − votos em 2022</div>
          </div>
          <div class="kpi">
            <div class="k">Eleitorado alvo (2026)</div>
            <div class="v">{{ fmt(perfil.total) }}</div>
            <div class="s">aptos projetados em RO</div>
          </div>
        </section>

        <!-- Insight de colocação -->
        <section class="insight">
          <b>Leitura:</b> o(a) candidato(a) obteve <b>{{ fmt(analysis.candValid) }}</b> votos válidos e ficou na
          <b>{{ analysis.rank }}ª</b> colocação do cargo. Para alcançar a liderança estadual, faltam
          <b>{{ fmt(analysis.gapLeader) }}</b> votos em relação a <b>{{ analysis.leaderName }}</b>.
          Foi o mais votado em <b>{{ analysis.posCount[1] }}</b> municípios, 2º em {{ analysis.posCount[2] }} e 3º em
          {{ analysis.posCount[3] }}.
        </section>

        <div class="dash-grid">
          <!-- Strongholds & Weaknesses (dois cards lado a lado, paginados) -->
          <div class="dash-duo">
            <section class="card">
              <h2>Maiores redutos</h2>
              <div class="sub">
                Municípios onde o candidato teve maior participação dos votos nominais válidos (2022).
                <span class="legend-inline">
                  <span class="legend-item"><span class="num">51.771</span> = votos nominais do candidato no município</span>
                  <span class="legend-item"><span class="num">110%</span> = participação do candidato sobre os votos nominais válidos do município</span>
                </span>
              </div>
              <div v-for="r in redutosPaged" :key="r.mun" class="bar-row">
                <div class="bar-label">{{ r.mun }}</div>
                <div class="bar-track">
                  <div class="bar fill-ok" :style="{ width: (r.votos / analysis.maxVotos * 100) + '%' }"></div>
                </div>
                <div class="bar-val">{{ fmt(r.votos) }} · {{ fmtPct(r.share) }}</div>
              </div>
              <div class="mini-pager">
                <button class="pbtn edge" :disabled="munPage === 1" @click="goToMunPage(munPage - 1)">‹</button>
                <span>{{ munPage }} / {{ totalMunPages }}</span>
                <button class="pbtn edge" :disabled="munPage === totalMunPages" @click="goToMunPage(munPage + 1)">›</button>
              </div>
            </section>

            <section class="card">
              <h2>Menores participações</h2>
              <div class="sub">
                Municípios onde o candidato teve menor participação dos votos nominais válidos (2022).
                <span class="legend-inline">
                  <span class="legend-item"><span class="num">4.218</span> = votos nominais do candidato no município</span>
                  <span class="legend-item"><span class="num">104,2%</span> = participação do candidato sobre os votos nominais válidos do município</span>
                </span>
              </div>
              <div v-for="r in fragilPaged" :key="r.mun" class="bar-row">
                <div class="bar-label">{{ r.mun }}</div>
                <div class="bar-track">
                  <div class="bar fill-warn" :style="{ width: (r.votos / analysis.maxVotos * 100) + '%' }"></div>
                </div>
                <div class="bar-val">{{ fmt(r.votos) }} · {{ fmtPct(r.share) }}</div>
              </div>
              <div class="mini-pager">
                <button class="pbtn edge" :disabled="munPage === 1" @click="goToMunPage(munPage - 1)">‹</button>
                <span>{{ munPage }} / {{ totalMunPages }}</span>
                <button class="pbtn edge" :disabled="munPage === totalMunPages" @click="goToMunPage(munPage + 1)">›</button>
              </div>
            </section>
          </div>

          <!-- Perfil do eleitorado 2026 (3 cards) -->
          <div class="dash-trio">
            <section class="card">
              <h2>Gênero (2026)</h2>
              <div class="sub">Participação por gênero no eleitorado projetado.</div>
              <div class="donut-wrap" v-if="generoChart">
                <div class="donut" :style="{ background: generoChart.grad }">
                  <div class="donut-hole">
                    <div class="donut-center">{{ fmtPct(generoChart.segs[0].pct) }}</div>
                    <div class="donut-sub">{{ generoChart.segs[0].label }}</div>
                  </div>
                </div>
                <ul class="legend">
                  <li v-for="s in generoChart.segs" :key="s.label">
                    <span class="dot" :style="{ background: s.color }"></span>
                    {{ s.label }} · {{ fmtPct(s.pct) }}
                  </li>
                </ul>
              </div>
            </section>

            <section class="card">
              <h2>Faixa etária (2026)</h2>
              <div class="sub">Distribuição por faixa etária projetada.</div>
              <div class="dim">
                <div v-for="d in faixaGrouped" :key="d.label" class="bar-row sm">
                  <div class="bar-label">{{ d.label }}</div>
                  <div class="bar-track"><div class="bar fill-accent" :style="{ width: (d.pct * 100) + '%' }"></div></div>
                  <div class="bar-val">{{ fmtPct(d.pct) }}</div>
                </div>
              </div>
            </section>

            <section class="card">
              <h2>Educação e Cor / Raça</h2>
              <div class="sub">Grau de instrução e cor/raça do eleitorado 2026.</div>
              <div class="dim">
                <h3 class="block-title">Grau de instrução</h3>
                <div v-for="d in perfil.instrucao" :key="d.label" class="bar-row sm">
                  <div class="bar-label">{{ d.label }}</div>
                  <div class="bar-track"><div class="bar fill-accent" :style="{ width: (d.pct * 100) + '%' }"></div></div>
                  <div class="bar-val">{{ fmtPct(d.pct) }}</div>
                </div>
                <h3 class="block-title">Cor / Raça</h3>
                <div v-for="d in perfil.raca.filter(r => !['NÃO INFORMADO', 'Inválida'].includes(r.label))" :key="d.label" class="bar-row sm">
                  <div class="bar-label">{{ d.label }}</div>
                  <div class="bar-track"><div class="bar fill-accent" :style="{ width: (d.pct * 100) + '%' }"></div></div>
                  <div class="bar-val">{{ fmtPct(d.pct) }}</div>
                </div>
                <div class="destaques">
                  <span class="chip">Com deficiência: <b>{{ fmt(perfil.comDef) }}</b></span>
                  <span class="chip">Voto facultativo: <b>{{ fmt(perfil.fac) }}</b></span>
                </div>
              </div>
            </section>
          </div>

          <!-- Oportunidades de comparecimento -->
          <section class="card">
            <h2>Oportunidades de comparecimento</h2>
            <div class="sub">Municípios com maior abstenção (2022) — alvo de mobilização.</div>
            <h3 class="block-title warn">Maiores abstenções</h3>
            <div v-for="r in oportunidades.porAbst" :key="r.mun" class="bar-row sm">
              <div class="bar-label">{{ r.mun }}</div>
              <div class="bar-track">
                <div class="bar fill-warn" :style="{ width: (r.abs / oportunidades.maxAbs * 100) + '%' }"></div>
              </div>
              <div class="bar-val">{{ fmt(r.abs) }} · {{ fmtPct(r.taxa) }}</div>
            </div>
            <h3 class="block-title">Maior eleitorado apto</h3>
            <div v-for="r in oportunidades.porAptos" :key="r.mun" class="bar-row sm">
              <div class="bar-label">{{ r.mun }}</div>
              <div class="bar-track">
                <div class="bar fill-accent" :style="{ width: (r.aptos / oportunidades.maxAptos * 100) + '%' }"></div>
              </div>
              <div class="bar-val">{{ fmt(r.aptos) }}</div>
            </div>
          </section>

          <!-- Prioridade de abordagem por perfil (grid 2x2) -->
          <section class="prioridade">
            <h2>Prioridade de abordagem por perfil</h2>
            <div class="sub">
              Cruzamento do desempenho do candidato em 2022 com o eleitorado projetado de 2026.
              A barra representa o <b>tamanho do perfil</b> (potencial de votos); o rótulo indica a
              <b>afinidade</b> em <b>pp</b> (pontos percentuais — diferença entre a participação do candidato no subgrupo e sua média geral;
             valor positivo significa desempenho acima da média, negativo abaixo).
              <span class="tag-base">Base natural</span> = já vai bem ·
              <span class="tag-opp">Oportunidade</span> = perfil grande onde vai mal (foco de conquista).
              <i>Estimativa ecológica municipal.</i>
            </div>
            <div class="dash-duo">
              <section class="card" v-for="dim in perfilAlvo.dims" :key="dim.title">
                <h3 class="block-title">{{ dim.title }}</h3>
                <template v-if="dim.title === 'Gênero' && generoChart">
                  <div class="donut-wrap prio-donut">
                    <div class="donut" :style="{ background: generoChart.grad }">
                      <div class="donut-hole">
                        <div class="donut-center">{{ fmtPct(generoChart.segs[0].pct) }}</div>
                        <div class="donut-sub">{{ generoChart.segs[0].label }}</div>
                      </div>
                    </div>
                    <ul class="legend">
                      <li v-for="s in generoChart.segs" :key="s.label">
                        <span class="dot" :style="{ background: s.color }"></span>
                        {{ s.label }} · {{ fmtPct(s.pct) }}
                      </li>
                    </ul>
                  </div>
                  <div class="dim">
                    <div v-for="c in dim.items" :key="c.label" class="bar-row sm">
                      <div class="bar-label">{{ c.label }}</div>
                      <div class="bar-track">
                        <div
                          class="bar"
                          :class="c.tag === 'Oportunidade' ? 'fill-warn' : (c.tag === 'Base natural' ? 'fill-ok' : 'fill-accent')"
                          :style="{ width: (c.pct * 100) + '%' }"
                        ></div>
                      </div>
                      <div class="bar-val" :class="c.aff >= 0 ? 'pos' : 'neg'">
                        {{ c.tag }} · {{ c.aff >= 0 ? '+' : '' }}{{ c.aff.toFixed(1) }} pp
                      </div>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <div class="dim">
                    <div v-for="c in dim.items" :key="c.label" class="bar-row sm">
                      <div class="bar-label">{{ c.label }}</div>
                      <div class="bar-track">
                        <div
                          class="bar"
                          :class="c.tag === 'Oportunidade' ? 'fill-warn' : (c.tag === 'Base natural' ? 'fill-ok' : 'fill-accent')"
                          :style="{ width: (c.pct * 100) + '%' }"
                        ></div>
                      </div>
                      <div class="bar-val" :class="c.aff >= 0 ? 'pos' : 'neg'">
                        {{ c.tag }} · {{ c.aff >= 0 ? '+' : '' }}{{ c.aff.toFixed(1) }} pp
                      </div>
                    </div>
                  </div>
                </template>
              </section>
            </div>
            <div class="insight" style="margin-top:14px">
              <b>Dica de abordagem:</b> priorize a conquista de
              <b v-if="perfilAlvo.top.length">{{ perfilAlvo.top.map(o => o.label).join(', ') }}</b>
              <b v-else>nenhum perfil prioritário identificado</b>,
              onde o eleitorado é expressivo e o desempenho de 2022 ficou abaixo da média do candidato.
            </div>
          </section>
        </div>
      </template>
    </template>
  </div>
</template>
