<template>
  <el-dropdown @command="changeLang" trigger="click">
    <span class="lang-switcher">
      {{ currentLabel }}
      <el-icon class="el-icon--right"><ArrowDown /></el-icon>
    </span>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item command="zh-CN" :class="{ 'is-active': current === 'zh-CN' }">中文</el-dropdown-item>
        <el-dropdown-item command="en-US" :class="{ 'is-active': current === 'en-US' }">English</el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDown } from '@element-plus/icons-vue'

const { locale } = useI18n()
const current = computed(() => locale.value)
const currentLabel = computed(() => current.value === 'en-US' ? 'English' : '中文')

function changeLang(lang) {
  locale.value = lang
  localStorage.setItem('locale', lang)
}
</script>

<style scoped>
.lang-switcher {
  cursor: pointer;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.is-active {
  font-weight: 600;
  color: var(--el-color-primary);
}
</style>