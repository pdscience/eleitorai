import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC_DIR = path.join(ROOT, 'votacao_2022_RO')
const OUT_DIR = path.join(ROOT, 'public', 'data')

/* ------------------------------------------------------------------ *
 *  Definição das categorias de dados eleitorais (TSE / RO 2022)
 * ------------------------------------------------------------------ */
const CATEGORIES = [
  {
    id: 'candidatos',
    name: 'Votação por Candidato',
    group: 'Resultados',
    year: 2022,
    description: 'Votos nominais de cada candidato por município e zona eleitoral.',
    file: 'votacao_candidato_munzona_2022_RO.csv',
    pageSize: 5000
  },
  {
    id: 'partidos',
    name: 'Votação por Partido',
    group: 'Resultados',
    year: 2022,
    description: 'Votos nominais válidos agregados por partido e cargo.',
    file: 'votacao_partido_munzona_2022_RO.csv',
    pageSize: 5000
  },
  {
    id: 'secoes-detalhe',
    name: 'Detalhe por Seção',
    group: 'Resultados',
    year: 2022,
    description: 'Aptos, comparecimento, abstenções e votos por seção eleitoral.',
    file: 'detalhe_votacao_secao_2022_RO.csv',
    pageSize: 5000
  },
  {
    id: 'votacao-secao',
    name: 'Votação por Seção (Candidato)',
    group: 'Resultados',
    year: 2022,
    description: 'Votos de cada candidato em cada seção. Base completa de votação.',
    file: 'votacao_secao_2022_RO.csv',
    pageSize: 10000
  },
  {
    id: 'qtde-votacao-2022',
    name: 'Quantitativos de Votação',
    group: 'Agregados',
    year: 2022,
    description: 'Resumo quantitativo da votação por município, turno e cargo (2022).',
    file: 'qtde_votacao_2022.csv',
    pageSize: 5000
  },
  {
    id: 'cruzamento-cargo-mun',
    name: 'Votação × Cargo × Município',
    group: 'Cruzamentos',
    year: 2022,
    description: 'Comparecimento, abstenção e votos válidos por cargo e município.',
    file: 'cruzamento_votacao-cargo-mun_2022_ro.csv',
    pageSize: 5000
  },
  {
    id: 'cruzamento-eleitorado-mun',
    name: 'Votação × Eleitorado × Município',
    group: 'Cruzamentos',
    year: 2022,
    description: 'Cruzamento entre votação e perfil do eleitorado por município.',
    file: 'cruzamento_votacao-eleitorado-mun_2022_ro.csv',
    pageSize: 5000
  },
  {
    id: 'cruzamento-zona',
    name: 'Votação por Zona',
    group: 'Cruzamentos',
    year: 2022,
    description: 'Indicadores de votação agregados por zona eleitoral.',
    file: 'cruzamento_votacao-zona_2022_ro.csv',
    pageSize: 5000
  },
  {
    id: 'eleitorado-estadocivil',
    name: 'Eleitorado × Estado Civil',
    group: 'Perfil do Eleitorado',
    year: 2022,
    description: 'Distribuição do eleitorado por estado civil e situação de voto.',
    file: 'cruzamento_eleitorado-estadocivil_2022_ro.csv',
    pageSize: 5000
  },
  {
    id: 'eleitorado-faixaetaria',
    name: 'Eleitorado × Faixa Etária',
    group: 'Perfil do Eleitorado',
    year: 2022,
    description: 'Distribuição do eleitorado por faixa etária.',
    file: 'cruzamento_eleitorado-faixaetaria_2022_ro.csv',
    pageSize: 5000
  },
  {
    id: 'eleitorado-genero',
    name: 'Eleitorado × Gênero',
    group: 'Perfil do Eleitorado',
    year: 2022,
    description: 'Distribuição do eleitorado por gênero.',
    file: 'cruzamento_eleitorado-genero_2022_ro.csv',
    pageSize: 5000
  },
  {
    id: 'eleitorado-grau',
    name: 'Eleitorado × Grau de Instrução',
    group: 'Perfil do Eleitorado',
    year: 2022,
    description: 'Distribuição do eleitorado por escolaridade.',
    file: 'cruzamento_eleitorado-grau_2022_ro.csv',
    pageSize: 5000
  },
  {
    id: 'eleitorado-raca',
    name: 'Eleitorado × Cor / Raça',
    group: 'Perfil do Eleitorado',
    year: 2022,
    description: 'Distribuição do eleitorado por cor/raça e biometria.',
    file: 'cruzamento_eleitorado-raça_2022_ro.csv',
    pageSize: 5000
  },
  {
    id: 'eleitorado-2026',
    name: 'Eleitorado 2026 (Agregado)',
    group: 'Agregados',
    year: 2026,
    description: 'Perfil do eleitorado projetado para 2026 por município e atributos.',
    file: 'qtde_eleitorado_2026.csv',
    pageSize: 5000
  },
  {
    id: 'eleitorado-estadocivil-2026',
    name: 'Eleitorado × Estado Civil',
    group: 'Perfil do Eleitorado',
    year: 2026,
    description: 'Distribuição projetada do eleitorado 2026 por estado civil e situação de voto.',
    file: 'cruzamento_eleitorado-estadocivil_2026_ro.csv',
    pageSize: 5000
  },
  {
    id: 'eleitorado-faixaetaria-2026',
    name: 'Eleitorado × Faixa Etária',
    group: 'Perfil do Eleitorado',
    year: 2026,
    description: 'Distribuição projetada do eleitorado 2026 por faixa etária.',
    file: 'cruzamento_eleitorado-faixaetaria_2026_ro.csv',
    pageSize: 5000
  },
  {
    id: 'eleitorado-genero-2026',
    name: 'Eleitorado × Gênero',
    group: 'Perfil do Eleitorado',
    year: 2026,
    description: 'Distribuição projetada do eleitorado 2026 por gênero.',
    file: 'cruzamento_eleitorado-genero_2026_ro.csv',
    pageSize: 5000
  },
  {
    id: 'eleitorado-grau-2026',
    name: 'Eleitorado × Grau de Instrução',
    group: 'Perfil do Eleitorado',
    year: 2026,
    description: 'Distribuição projetada do eleitorado 2026 por escolaridade.',
    file: 'cruzamento_eleitorado-grau_2026_ro.csv',
    pageSize: 5000
  },
  {
    id: 'eleitorado-raca-2026',
    name: 'Eleitorado × Cor / Raça',
    group: 'Perfil do Eleitorado',
    year: 2026,
    description: 'Distribuição projetada do eleitorado 2026 por cor/raça.',
    file: 'cruzamento_eleitorado-raça_2026_ro.csv',
    pageSize: 5000
  }
]

/* ------------------------------------------------------------------ *
 *  Parser de CSV (delimitador ';', suporte a aspas, encoding Latin1)
 * ------------------------------------------------------------------ */
function parseCsv(text) {
  const rows = []
  let field = ''
  let row = []
  let inQuotes = false
  let i = 0
  const n = text.length

  while (i < n) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += ch
      i++
      continue
    }

    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === ';') {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
      if (text[i] === '\r') i++
      continue
    }
    if (ch === '\r') {
      i++
      continue
    }
    field += ch
    i++
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function columnType(values) {
  let numeric = 0
  let nonEmpty = 0
  for (const v of values) {
    if (v === '' || v == null) continue
    nonEmpty++
    const cleaned = v.toString().replace(/\./g, '').replace(',', '.').trim()
    if (cleaned !== '' && !isNaN(Number(cleaned))) numeric++
  }
  if (nonEmpty > 0 && numeric === nonEmpty) return 'number'
  return 'text'
}

function normalizeValue(value, type) {
  if (value === '' || value == null) return type === 'number' ? null : ''
  if (type === 'number') {
    const cleaned = value.toString().replace(/\./g, '').replace(',', '.').trim()
    const num = Number(cleaned)
    return isNaN(num) ? value : num
  }
  return value
}

/* ------------------------------------------------------------------ *
 *  Geração dos dados paginados
 * ------------------------------------------------------------------ */
function buildCategory(cat) {
  const filePath = path.join(SRC_DIR, cat.file)
  if (!fs.existsSync(filePath)) {
    console.warn(`  ! arquivo ausente: ${cat.file}`)
    return null
  }

  const buffer = fs.readFileSync(filePath, 'latin1')
  const rows = parseCsv(buffer)
  if (rows.length === 0) return null

  const header = rows[0].map((h) => h.trim())
  const dataRows = rows.slice(1).filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ''))

  const types = header.map((_, colIdx) =>
    columnType(dataRows.map((r) => (r[colIdx] !== undefined ? r[colIdx] : '')))
  )

  const normalized = dataRows.map((r) =>
    header.reduce((obj, col, idx) => {
      obj[col] = normalizeValue(r[idx], types[idx])
      return obj
    }, {})
  )

  const catDir = path.join(OUT_DIR, cat.id)
  fs.mkdirSync(catDir, { recursive: true })
  fs.mkdirSync(path.join(catDir, 'pages'), { recursive: true })

  const pageSize = cat.pageSize || 5000
  const pageCount = Math.max(1, Math.ceil(normalized.length / pageSize))

  for (let p = 0; p < pageCount; p++) {
    const slice = normalized.slice(p * pageSize, (p + 1) * pageSize)
    const pageName = `page-${String(p + 1).padStart(4, '0')}.json`
    fs.writeFileSync(path.join(catDir, 'pages', pageName), JSON.stringify(slice))
  }

  const meta = {
    id: cat.id,
    name: cat.name,
    group: cat.group,
    year: cat.year || 2022,
    description: cat.description,
    totalRows: normalized.length,
    pageSize,
    pageCount,
    columns: header.map((name, idx) => ({ name, type: types[idx] }))
  }
  fs.writeFileSync(path.join(catDir, 'meta.json'), JSON.stringify(meta))

  return meta
}

function main() {
  console.log('EleitorAi · Gerando dados paginados a partir dos CSVs...\n')
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const groups = {}
  const index = { generatedAt: new Date().toISOString(), categories: [] }

  for (const cat of CATEGORIES) {
    console.log(`  → ${cat.name} (${cat.file})`)
    const meta = buildCategory(cat)
    if (!meta) continue
    index.categories.push(meta)
    const year = String(meta.year)
    groups[year] = groups[year] || {}
    groups[year][meta.group] = groups[year][meta.group] || []
    groups[year][meta.group].push(meta.id)
    console.log(`    ${meta.totalRows} linhas · ${meta.pageCount} páginas`)
  }

  index.groups = groups
  index.totalRows = index.categories.reduce((s, c) => s + c.totalRows, 0)

  fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify(index))
  console.log(`\nConcluído. ${index.categories.length} categorias · ${index.totalRows} registros.`)
}

main()
