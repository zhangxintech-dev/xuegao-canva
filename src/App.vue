<script setup>
/**
 * Root App component | 根组件
 * Provides naive-ui config and router view
 */
import { computed } from 'vue'
import { NConfigProvider, NMessageProvider, NDialogProvider, darkTheme } from 'naive-ui'
import { isDark } from './stores/theme'

// Naive UI theme based on dark mode | 基于深色模式的 Naive UI 主题
const theme = computed(() => isDark.value ? darkTheme : null)

// Global theme overrides | 全局主题覆盖
const themeOverrides = {
  common: {
    primaryColor: '#38bdf8',
    primaryColorHover: '#0ea5e9',
    primaryColorPressed: '#0284c7',
    primaryColorSuppl: '#7dd3fc',
    borderRadius: '12px',
    borderRadiusSmall: '8px'
  },
  Dialog: {
    borderRadius: '16px',
    padding: '24px'
  },
  Modal: {
    borderRadius: '16px',
    padding: '24px'
  },
  Card: {
    borderRadius: '16px',
    padding: '24px'
  },
  Button: {
    borderRadiusMedium: '10px',
    borderRadiusSmall: '8px',
    borderRadiusLarge: '12px',
    heightMedium: '36px',
    paddingMedium: '0 16px'
  },
  Input: {
    borderRadius: '10px',
    heightMedium: '36px'
  }
}
</script>

<template>
  <n-config-provider :theme="theme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-dialog-provider>
        <router-view />
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<style>
/* Global app styles handled in style.css */
</style>
