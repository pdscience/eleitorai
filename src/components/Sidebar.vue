<script setup>
defineProps({
  groups: { type: Object, default: () => ({}) },
  categories: { type: Array, default: () => [] },
  active: { type: String, default: '' }
})
const emit = defineEmits(['select'])
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <div class="logo">E</div>
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
          @click="emit('select', '__dashboard__')"
        >
          <span class="dot"></span>
          <span class="label">Painel do Candidato</span>
        </button>
        <button
          class="nav-item"
          :class="{ active: active === '__simulador__' }"
          @click="emit('select', '__simulador__')"
        >
          <span class="dot"></span>
          <span class="label">Simulador de Votos</span>
        </button>
        <button
          class="nav-item"
          :class="{ active: active === '__eleitos__' }"
          @click="emit('select', '__eleitos__')"
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
            @click="emit('select', id)"
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
