<template>
  <div class="storyboard-board">
    <div class="board-toolbar">
      <div class="board-stats">
        <span>{{ t('storyboardBoard.total', { n: storyboards.length }) }}</span>
        <span v-if="selectedIds.size > 0" class="selected-count">
          {{ t('storyboardBoard.selected', { n: selectedIds.size }) }}
        </span>
      </div>
      <div class="board-actions" v-if="selectedIds.size > 0">
        <el-button size="small" type="primary" @click="$emit('batch-action', 'generate-image', [...selectedIds])">
          {{ t('storyboardBoard.batchGenImage') }}
        </el-button>
        <el-button size="small" type="success" @click="$emit('batch-action', 'generate-video', [...selectedIds])">
          {{ t('storyboardBoard.batchGenVideo') }}
        </el-button>
        <el-button size="small" type="danger" plain @click="$emit('batch-action', 'delete', [...selectedIds])">
          {{ t('common.delete') }}
        </el-button>
        <el-button size="small" @click="clearSelection">{{ t('storyboardBoard.clearSelection') }}</el-button>
      </div>
    </div>

    <div class="board-grid" v-if="storyboards.length > 0">
      <div
        v-for="(sb, i) in storyboards"
        :key="sb.id"
        class="board-card"
        :class="{
          selected: selectedIds.has(sb.id),
          dragging: dragId === sb.id,
          'drag-over': dragOverId === sb.id,
        }"
        draggable="true"
        @dragstart="onDragStart($event, sb, i)"
        @dragover.prevent="onDragOver($event, sb, i)"
        @dragleave="onDragLeave"
        @drop.prevent="onDrop($event, i)"
        @dragend="onDragEnd"
        @click="onCardClick($event, sb)"
      >
        <div class="card-header">
          <span class="card-number">{{ sb.storyboard_number ?? i + 1 }}</span>
          <el-tag size="small" :type="statusTagType(sb.status)">{{ statusLabel(sb.status) }}</el-tag>
        </div>
        <div class="card-thumbnail">
          <img v-if="getThumbnail(sb)" :src="getThumbnail(sb)" :alt="sb.title" />
          <div v-else class="thumbnail-placeholder">
            <el-icon><Picture /></el-icon>
          </div>
        </div>
        <div class="card-body">
          <div class="card-title" :title="sb.title">{{ sb.title || t('common.unnamed') }}</div>
          <div class="card-desc" :title="sb.description">{{ sb.description || '' }}</div>
        </div>
        <div class="card-footer">
          <span v-if="sb.shot_type" class="card-tag">{{ sb.shot_type }}</span>
          <span v-if="sb.duration" class="card-tag">{{ sb.duration }}s</span>
          <span v-if="sb.segment_title" class="card-tag segment">{{ sb.segment_title }}</span>
        </div>
      </div>
    </div>
    <el-empty v-else :description="t('common.empty')" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Picture } from '@element-plus/icons-vue'

const { t } = useI18n()

const props = defineProps({
  storyboards: { type: Array, default: () => [] },
  thumbnails: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['reorder', 'select', 'batch-action'])

const selectedIds = ref(new Set())
const dragId = ref(null)
const dragOverId = ref(null)

function getThumbnail(sb) {
  return props.thumbnails[sb.id] || sb.image_url || null
}

function statusLabel(status) {
  const map = {
    draft: t('storyboardBoard.statusDraft'),
    image_ready: t('storyboardBoard.statusImageReady'),
    video_ready: t('storyboardBoard.statusVideoReady'),
    completed: t('storyboardBoard.statusCompleted'),
    error: t('storyboardBoard.statusError'),
  }
  return map[status] || status || t('storyboardBoard.statusDraft')
}

function statusTagType(status) {
  const map = {
    draft: 'info',
    image_ready: 'warning',
    video_ready: 'primary',
    completed: 'success',
    error: 'danger',
  }
  return map[status] || 'info'
}

function onCardClick(e, sb) {
  if (e.ctrlKey || e.metaKey) {
    if (selectedIds.value.has(sb.id)) {
      selectedIds.value.delete(sb.id)
    } else {
      selectedIds.value.add(sb.id)
    }
    selectedIds.value = new Set(selectedIds.value)
  } else {
    emit('select', sb)
  }
}

function clearSelection() {
  selectedIds.value = new Set()
}

function onDragStart(e, sb, i) {
  dragId.value = sb.id
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', String(sb.id))
}

function onDragOver(e, sb, i) {
  e.dataTransfer.dropEffect = 'move'
  if (dragId.value !== sb.id) {
    dragOverId.value = sb.id
  }
}

function onDragLeave() {
  dragOverId.value = null
}

function onDrop(e, dropIndex) {
  dragOverId.value = null
  const fromId = dragId.value
  if (!fromId) return
  const fromIndex = props.storyboards.findIndex(s => s.id === fromId)
  if (fromIndex === -1 || fromIndex === dropIndex) return
  emit('reorder', { fromIndex, toIndex: dropIndex, id: fromId })
}

function onDragEnd() {
  dragId.value = null
  dragOverId.value = null
}
</script>

<style scoped>
.storyboard-board {
  padding: 16px;
}
.board-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 8px;
}
.board-stats {
  display: flex;
  gap: 16px;
  font-size: 14px;
  color: var(--text-secondary, #71717a);
}
.selected-count {
  color: var(--el-color-primary);
  font-weight: 600;
}
.board-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.board-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}
.board-card {
  border: 1px solid var(--el-border-color, #e4e7ed);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--el-bg-color, #fff);
}
.board-card:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}
.board-card.selected {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px var(--el-color-primary);
}
.board-card.dragging {
  opacity: 0.5;
}
.board-card.drag-over {
  border-color: var(--el-color-success);
  border-style: dashed;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: var(--el-fill-color-light, #f5f7fa);
}
.card-number {
  font-weight: 600;
  font-size: 14px;
}
.card-thumbnail {
  width: 100%;
  aspect-ratio: 16/9;
  overflow: hidden;
  background: var(--el-fill-color, #f0f0f0);
  display: flex;
  align-items: center;
  justify-content: center;
}
.card-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.thumbnail-placeholder {
  color: var(--el-text-color-placeholder, #c0c4cc);
  font-size: 32px;
}
.card-body {
  padding: 8px 10px;
}
.card-title {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-desc {
  font-size: 12px;
  color: var(--text-secondary, #71717a);
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-footer {
  display: flex;
  gap: 6px;
  padding: 4px 10px 8px;
  flex-wrap: wrap;
}
.card-tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--el-fill-color, #f0f0f0);
  color: var(--text-secondary, #71717a);
}
.card-tag.segment {
  background: var(--el-color-primary-light-9, #ecf5ff);
  color: var(--el-color-primary);
}
</style>