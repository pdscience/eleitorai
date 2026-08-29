<script setup>
defineProps({
  columns: { type: Array, default: () => [] },
  rows: { type: Array, default: () => [] },
  sortKey: { type: String, default: '' },
  sortDir: { type: String, default: 'asc' }
})
const emit = defineEmits(['sort'])

function pretty(name) {
  return name
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function fmt(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'number') {
    return value.toLocaleString('pt-BR', { maximumFractionDigits: 4 })
  }
  return value
}

function onSort(col) {
  emit('sort', col)
}
</script>

<template>
  <div class="table-wrap">
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th
              v-for="col in columns"
              :key="col.name"
              :class="{ num: col.type === 'number', active: sortKey === col.name }"
              @click="onSort(col.name)"
            >
              {{ pretty(col.name) }}
              <span v-if="sortKey === col.name" class="arrow">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in rows" :key="i">
            <td
              v-for="col in columns"
              :key="col.name"
              :class="{ num: col.type === 'number', mono: col.name.startsWith('NM_') || col.name.startsWith('DS_') }"
            >
              {{ fmt(row[col.name]) }}
            </td>
          </tr>
          <tr v-if="rows.length === 0">
            <td class="empty" :colspan="columns.length || 1">Nenhum registro nesta página.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
