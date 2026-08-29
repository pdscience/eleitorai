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
const qtde = ref(null)
const eleit = ref(null)

const selectedCargo = ref('')
const userVotos = ref('')

const fmt = (v) => (v || 0).toLocaleString('pt-BR')
const fmtPct = (v) => (v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%'

const cargos = [
  { label: 'Governador', value: 'Governador', tipo: 'majoritario' },
  { label: 'Senador', value: 'Senador', tipo: 'majoritario' },
  { label: 'Deputado Federal', value: 'Deputado Federal', tipo: 'proporcional' },
  { label: 'Deputado Estadual', value: 'Deputado Estadual', tipo: 'proporcional' }
]

const cargoInfo = computed(() => cargos.find(c => c.value === selectedCargo.value))

// Número de vagas derivado dos dados de 2022
const vagas = computed(() => {
  if (!cats.value || !selectedCargo.value) return 0
  const elected = cats.value.filter(r =>
    r.DS_CARGO === selectedCargo.value &&
    ['ELEITO', 'ELEITO POR QP', 'ELEITO POR MEDIA'].includes(r.DS_SIT_TOT_TURNO)
  )
  return new Set(elected.map(r => r.NR_CANDIDATO)).size || 1
})

// Dados de votação 2022 para o cargo selecionado
const cargoQtde = computed(() => {
  if (!qtde.value || !selectedCargo.value) return null
  const rows = qtde.value.filter(r => r.Cargo === selectedCargo.value && r.Turno === 1)
  let totalValidos = 0
  let totalAptos = 0
  let totalNominais = 0
  for (const r of rows) {
    totalValidos += Number(r['Votos válidos']) || 0
    totalAptos += Number(r['Eleitorado apto']) || 0
    totalNominais += Number(r['Votos nominais válidos']) || 0
  }
  return { totalValidos, totalAptos, totalNominais, municipios: rows.length }
})

// Projeção eleitorado 2026
const eleitorado2026 = computed(() => {
  if (!eleit.value) return 0
  const seen = {}
  for (const r of eleit.value) {
    const key = r['Município'] || r.Municipio
    if (!seen[key]) {
      seen[key] = Number(r['Eleitorado']) || 0
    }
  }
  return Object.values(seen).reduce((s, v) => s + v, 0)
})

// Quociente eleitoral
const quociente = computed(() => {
  if (!cargoQtde.value || !vagas.value) return 0
  return Math.floor(cargoQtde.value.totalNominais / vagas.value)
})

// Ranking dos candidatos 2022
const ranking2022 = computed(() => {
  if (!cats.value || !selectedCargo.value) return []
  const map = new Map()
  for (const r of cats.value) {
    if (r.DS_CARGO !== selectedCargo.value || String(r.NR_TURNO) !== '1') continue
    const key = r.NR_CANDIDATO
    const c = map.get(key) || { nr: key, nome: r.NM_URNA_CANDIDATO || r.NM_CANDIDATO, partido: r.SG_PARTIDO, votos: 0 }
    c.votos += Number(r.QT_VOTOS_NOMINAIS_VALIDOS) || 0
    map.set(key, c)
  }
  return [...map.values()].sort((a, b) => b.votos - a.votos)
})

// Resultado da simulação
const simulacao = computed(() => {
  if (!selectedCargo.value || !userVotos.value) return null
  const votos = Number(userVotos.value) || 0
  if (votos <= 0) return null
  const tipo = cargoInfo.value?.tipo
  const qtdeValidos = cargoQtde.value?.totalNominais || 0
  const totalVagas = vagas.value

  if (tipo === 'proporcional') {
    const qe = quociente.value
    const cadeiras = qe > 0 ? Math.floor(votos / qe) : 0
    const faltam = qe > 0 ? Math.max(0, qe - votos) : 0
    const posicao = ranking2022.value.filter(c => c.votos > votos).length + 1
    return {
      tipo,
      eleito: cadeiras > 0,
      cadeiras,
      quociente: qe,
      faltam,
      posicao,
      totalCands: ranking2022.value.length,
      pctValidos: qtdeValidos ? votos / qtdeValidos : 0
    }
  } else {
    const lider = ranking2022.value[0]
    const liderVotos = lider?.votos || 0
    const faltam = Math.max(0, liderVotos - votos + 1)
    const posicao = ranking2022.value.filter(c => c.votos > votos).length + 1
    const totalAptos = eleitorado2026.value
    const pctAptos = totalAptos ? votos / totalAptos : 0
    return {
      tipo,
      eleito: posicao <= totalVagas,
      faltam,
      posicao,
      totalCands: ranking2022.value.length,
      liderNome: lider?.nome || '',
      liderVotos,
      pctAptos,
      segundoTurno: pctAptos < 0.5 && posicao <= 2
    }
  }
})

// Meta visual (barra de progresso)
const metaProgress = computed(() => {
  if (!simulacao.value || !cargoQtde.value) return 0
  const votos = Number(userVotos.value) || 0
  if (simulacao.value.tipo === 'proporcional') {
    const qe = quociente.value
    return qe > 0 ? Math.min(100, (votos / qe) * 100) : 0
  } else {
    const lider = ranking2022.value[0]
    return lider ? Math.min(100, (votos / lider.votos) * 100) : 0
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
    selectedCargo.value = 'Governador'
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="sim">
    <header class="dash-head">
      <div>
        <span class="badge">Simulador · RO</span>
        <h1 style="margin-top:10px">Simulador de Meta de Votos</h1>
        <p class="desc">
          Descubra quantos votos precisa para se eleger ou simule cenários com diferentes quantidades de votos.
        </p>
      </div>
    </header>

    <div v-if="loading" class="loading"><div class="spinner"></div><div>Carregando dados eleitorais…</div></div>
    <div v-else-if="error" class="loading">Erro: {{ error }}</div>

    <template v-else>
      <!-- Seleção de cargo -->
      <div class="sim-toolbar">
        <label class="dash-select">
          <span>Cargo</span>
          <select v-model="selectedCargo">
            <option v-for="c in cargos" :key="c.value" :value="c.value">{{ c.label }}</option>
          </select>
        </label>
      </div>

      <!-- Info do cargo -->
      <section class="kpis" v-if="cargoQtde">
        <div class="kpi">
          <div class="k">Eleitores aptos (2026)</div>
          <div class="v">{{ fmt(eleitorado2026) }}</div>
          <div class="s">projeção para RO</div>
        </div>
        <div class="kpi">
          <div class="k">Votos nominais válidos (2022)</div>
          <div class="v">{{ fmt(cargoQtde.totalNominais) }}</div>
          <div class="s">base de cálculo</div>
        </div>
        <div class="kpi" v-if="cargoInfo?.tipo === 'proporcional'">
          <div class="k">Quociente eleitoral</div>
          <div class="v">{{ fmt(quociente) }}</div>
          <div class="s">{{ fmt(cargoQtde.totalNominais) }} ÷ {{ vagas }} vagas</div>
        </div>
        <div class="kpi">
          <div class="k">Vagas</div>
          <div class="v">{{ vagas }}</div>
          <div class="s">{{ cargoInfo?.tipo === 'proporcional' ? 'proporcional' : 'maioria' }}</div>
        </div>
      </section>

      <!-- Input de simulação -->
      <section class="sim-input-card card">
        <h2>Simule seus votos</h2>
        <div class="sub">
          Informe a quantidade de votos que pretende obter e veja o resultado para <b>{{ selectedCargo }}</b>.
        </div>
        <div class="sim-input-row">
          <label class="sim-label">
            <span>Quantos votos você pretende ter?</span>
            <input
              v-model="userVotos"
              type="number"
              min="0"
              :placeholder="cargoInfo?.tipo === 'proporcional' ? `Ex: ${fmt(quociente)}` : `Ex: ${fmt(ranking2022[0]?.votos || 0)}`"
              class="sim-input"
            />
          </label>
        </div>

        <!-- Resultado da simulação -->
        <template v-if="simulacao">
          <!-- Barra de progresso -->
          <div class="sim-progress-wrap">
            <div class="sim-progress-bar">
              <div
                class="sim-progress-fill"
                :class="simulacao.eleito ? 'ok' : 'warn'"
                :style="{ width: metaProgress + '%' }"
              ></div>
            </div>
            <div class="sim-progress-label">
              <span v-if="simulacao.tipo === 'proporcional'">
                {{ fmt(Number(userVotos)) }} de {{ fmt(quociente) }} (quociente eleitoral)
              </span>
              <span v-else>
                {{ fmt(Number(userVotos)) }} de {{ fmt(simulacao.liderVotos) }} (líder em 2022)
              </span>
              <span class="sim-progress-pct">{{ metaProgress.toFixed(1) }}%</span>
            </div>
          </div>

          <!-- Resultado -->
          <div class="sim-result" :class="simulacao.eleito ? 'eleito' : 'nao-eleito'">
            <div class="sim-result-icon">{{ simulacao.eleito ? '✓' : '✗' }}</div>
            <div class="sim-result-text">
              <template v-if="simulacao.tipo === 'proporcional'">
                <div class="sim-result-title" v-if="simulacao.eleito">
                 {{ simulacao.cadeiras }} cadeira{{ simulacao.cadeiras > 1 ? 's' : '' }} conquistada{{ simulacao.cadeiras > 1 ? 's' : '' }}
                </div>
                <div class="sim-result-title" v-else>
                  Não atinge o quociente eleitoral
                </div>
                <div class="sim-result-detail">
                  Faltam <b>{{ fmt(simulacao.faltam) }}</b> votos para atingir o quociente de <b>{{ fmt(simulacao.quociente) }}</b>
                </div>
              </template>
              <template v-else>
                <div class="sim-result-title" v-if="simulacao.eleito">
                  {{ simulacao.segundoTurno ? 'Possível 2º turno' : 'Eleito (maioria)' }}
                </div>
                <div class="sim-result-title" v-else>
                  Não eleito
                </div>
                <div class="sim-result-detail">
                  Posição: <b>{{ simulacao.posicao }}º</b> de {{ simulacao.totalCands }} candidatos
                  <template v-if="!simulacao.eleito">
                    · Faltam <b>{{ fmt(simulacao.faltam) }}</b> votos para ultrapassar o líder
                  </template>
                </div>
                <div class="sim-result-detail" v-if="simulacao.liderNome">
                  Líder em 2022: <b>{{ simulacao.liderNome }}</b> com {{ fmt(simulacao.liderVotos) }} votos
                </div>
              </template>
            </div>
          </div>

          <!-- Top 10 ranking 2022 -->
          <div class="sim-ranking" v-if="ranking2022.length">
            <h3 class="block-title">Top 10 — {{ selectedCargo }} (2022)</h3>
            <div class="sim-ranking-table">
              <div
                v-for="(c, i) in ranking2022.slice(0, 10)"
                :key="c.nr"
                class="sim-ranking-row"
                :class="{ highlight: Number(userVotos) > c.votos }"
              >
                <span class="sim-rank">{{ i + 1 }}º</span>
                <span class="sim-rank-name">{{ c.nome }}</span>
                <span class="sim-rank-party">{{ c.partido }}</span>
                <span class="sim-rank-votes">{{ fmt(c.votos) }}</span>
              </div>
            </div>
          </div>
        </template>
      </section>
    </template>
  </div>
</template>
