<script setup>
defineProps({
  groups: { type: Object, default: () => ({}) },
  categories: { type: Array, default: () => [] },
  active: { type: String, default: '' },
  open: { type: Boolean, default: false }
})
const emit = defineEmits(['select', 'close'])

function onSelect(id) {
  emit('select', id)
  emit('close')
}
</script>

<template>
  <div class="sidebar-overlay" :class="{ visible: open }" @click="emit('close')"></div>
  <aside class="sidebar" :class="{ open }">
    <div class="brand">
      <div class="logo">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#05121a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="7" width="18" height="14" rx="2"/>
          <path d="M8 7V5a4 4 0 0 1 8 0v2"/>
          <polyline points="9 13 11 15 15 11"/>
        </svg>
      </div>
      <div>
        <div class="title">Eleitor<span>Ai</span></div>
        <div class="sub">RO · Eleições 2022</div>
      </div>
    </div>

    <nav class="nav">
      <div class="nav-group">
        <div class="nav-group-label">Estratégia</div>
        <button
          class="nav-item"
          :class="{ active: active === '__dashboard__' }"
          @click="onSelect('__dashboard__')"
        >
          <span class="dot"></span>
          <span class="label">Painel do Candidato</span>
        </button>
        <button
          class="nav-item"
          :class="{ active: active === '__simulador__' }"
          @click="onSelect('__simulador__')"
        >
          <span class="dot"></span>
          <span class="label">Simulador de Votos</span>
        </button>
        <button
          class="nav-item"
          :class="{ active: active === '__eleitos__' }"
          @click="onSelect('__eleitos__')"
        >
          <span class="dot"></span>
          <span class="label">Candidatos Eleitos</span>
        </button>
      </div>
      <div v-for="(themes, year) in groups" :key="year" class="nav-year">
        <div class="nav-year-label">{{ year }}</div>
        <div v-for="(ids, group) in themes" :key="group" class="nav-group">
          <div class="nav-group-label">{{ group }}</div>
          <button
            v-for="id in ids"
            :key="id"
            class="nav-item"
            :class="{ active: id === active }"
            @click="onSelect(id)"
          >
            <span class="dot"></span>
            <span class="label">{{ (categories.find(c => c.id === id) || {}).name }}</span>
            <span class="count">{{ ((categories.find(c => c.id === id) || {}).totalRows || 0).toLocaleString('pt-BR') }}</span>
          </button>
        </div>
      </div>
    </nav>

    <div class="sidebar-foot">
      <b>{{ categories.length }}</b> categorias ·
      <b>{{ categories.reduce((s, c) => s + c.totalRows, 0).toLocaleString('pt-BR') }}</b> registros
    </div>
  </aside>
</template>
