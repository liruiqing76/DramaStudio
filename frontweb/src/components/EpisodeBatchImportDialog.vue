<template>
  <div class="episode-batch-import-trigger">
    <el-button size="small" @click="openDialog">
      <el-icon><Upload /></el-icon>批量导入剧集
    </el-button>

    <el-dialog
      v-model="visible"
      title="批量导入剧集"
      width="920px"
      append-to-body
      destroy-on-close
      @close="resetState"
    >
      <div class="batch-import-dialog">
        <el-tabs v-model="activeTab" class="batch-import-tabs">
          <el-tab-pane :label="$t('episodeImport.tabConfig')" name="config">
            <div class="batch-import-panel">
              <div class="batch-import-toolbar">
                <input ref="fileInputRef" type="file" accept=".txt,text/plain" style="display:none" @change="onFileChange" />
                <el-button @click="fileInputRef?.click()">
                  <el-icon><Upload /></el-icon>{{ $t('episodeImport.selectFile') }}
                </el-button>
                <span class="batch-import-file" :class="{ 'is-empty': !fileName }">
                  {{ fileName || $t('episodeImport.noFileSelected') }}
                </span>
              </div>

              <el-form label-width="120px" class="batch-import-form">
                <el-form-item :label="$t('episodeImport.chapterRegex')">
                  <el-input v-model="chapterPattern" :placeholder="$t('episodeImport.chapterRegexPlaceholder')" />
                </el-form-item>
                <el-form-item :label="$t('episodeImport.chaptersPerEpisode')">
                  <el-input-number v-model="chaptersPerEpisode" :min="1" :max="100" />
                </el-form-item>
              </el-form>

              <div class="batch-import-tip-block">
                <div class="batch-import-tip">{{ $t('episodeImport.tip1') }}</div>
                <div class="batch-import-tip">{{ $t('episodeImport.tip2') }}</div>
                <div class="batch-import-tip">{{ $t('episodeImport.tip3') }}<code class="batch-import-code">^\s*(第\d+章[^\n]*)</code>、<code class="batch-import-code">^\s*(第\d+集[^\n]*)</code></div>
                <div class="batch-import-tip">{{ $t('episodeImport.tip4') }}</div>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane :label="$t('episodeImport.tabPreview')" name="preview" :disabled="!previewReady">
            <div class="batch-import-panel">
              <template v-if="previewEpisodes.length">
                <div class="batch-import-preview-header">
                  <span>{{ $t('episodeImport.previewSummary', { chapters: previewChapters.length, episodes: previewEpisodes.length }) }}</span>
                </div>
                <el-table :data="previewEpisodes" border stripe height="420" class="batch-import-preview-table">
                  <el-table-column prop="episode_number" :label="$t('episodeImport.colEpisode')" width="80" align="center" />
                  <el-table-column prop="title" :label="$t('episodeImport.colTitle')" min-width="220" show-overflow-tooltip />
                  <el-table-column :label="$t('episodeImport.colChapters')" min-width="260" show-overflow-tooltip>
                    <template #default="scope">
                      {{ scope.row.chapter_titles.join('、') || $t('episodeImport.noChapterTitle') }}
                    </template>
                  </el-table-column>
                  <el-table-column :label="$t('episodeImport.colContent')" min-width="320" show-overflow-tooltip>
                    <template #default="scope">
                      <div class="batch-import-preview-cell batch-import-preview-cell--single-line">
                        {{ scope.row.script_content || $t('episodeImport.noContent') }}
                      </div>
                    </template>
                  </el-table-column>
                </el-table>
              </template>
              <div v-else class="batch-import-empty">{{ $t('episodeImport.pleaseConfigFirst') }}</div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
      <template #footer>
        <el-button @click="visible = false">{{ $t('episodeImport.cancel') }}</el-button>
        <el-button v-if="activeTab === 'preview'" @click="activeTab = 'config'">{{ $t('episodeImport.prevStep') }}</el-button>
        <el-button
          v-if="activeTab === 'config'"
          type="primary"
          :disabled="!rawText.trim()"
          @click="confirmConfig"
        >{{ $t('episodeImport.confirmConfig') }}</el-button>
        <el-button
          v-else
          type="primary"
          :disabled="!previewEpisodes.length"
          :loading="importing"
          @click="confirmImport"
        >{{ $t('episodeImport.confirmImport') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Upload } from '@element-plus/icons-vue'

const { t } = useI18n()

const props = defineProps({
  startEpisodeNumber: {
    type: Number,
    default: 1,
  },
})

const emit = defineEmits(['import'])

const visible = ref(false)
const activeTab = ref('config')
const previewReady = ref(false)
const importing = ref(false)
const fileInputRef = ref(null)
const fileName = ref('')
const rawText = ref('')
const chapterPattern = ref('^\\s*(第[0-9０-９零一二三四五六七八九十百千万]+[章回节][^\\n\\r]*)')
const chaptersPerEpisode = ref(1)
const previewChapters = ref([])
const previewEpisodes = ref([])

function openDialog() {
  visible.value = true
  activeTab.value = 'config'
}

defineExpose({
  openDialog,
})

function resetState() {
  visible.value = false
  activeTab.value = 'config'
  previewReady.value = false
  importing.value = false
  fileName.value = ''
  rawText.value = ''
  chapterPattern.value = '^\\s*(第[0-9０-９零一二三四五六七八九十百千万]+[章回节][^\\n\\r]*)'
  chaptersPerEpisode.value = 1
  previewChapters.value = []
  previewEpisodes.value = []
  if (fileInputRef.value) fileInputRef.value.value = ''
}

function onFileChange(event) {
  const file = event.target?.files?.[0]
  if (!file) return
  fileName.value = file.name
  previewReady.value = false
  previewChapters.value = []
  previewEpisodes.value = []
  const reader = new FileReader()
  reader.onload = (ev) => {
    rawText.value = String(ev.target?.result || '')
  }
  reader.onerror = () => {
    ElMessage.error(t('episodeImport.readFileFailed'))
  }
  reader.readAsText(file, 'utf-8')
}

function createChapterRegex(pattern) {
  const source = String(pattern || '').trim()
  if (!source) throw new Error(t('episodeImport.enterRegex'))
  try {
    return new RegExp(source, 'gm')
  } catch {
    throw new Error(t('episodeImport.invalidRegex'))
  }
}

function splitNovelChapters(text, pattern) {
  const normalized = String(text || '').replace(/\r\n/g, '\n').trim()
  if (!normalized) return []
  const regex = createChapterRegex(pattern)
  const matches = [...normalized.matchAll(regex)]
  if (!matches.length) throw new Error(t('episodeImport.noChaptersMatched'))
  return matches.map((match, index) => {
    const title = String(match[1] || match[0] || '').trim()
    const titleStart = match.index ?? 0
    const contentStart = titleStart + String(match[0] || '').length
    const nextTitleStart = index + 1 < matches.length
      ? (matches[index + 1].index ?? normalized.length)
      : normalized.length
    const content = normalized.slice(contentStart, nextTitleStart).trim()
    return {
      title: title || t('episodeImport.defaultChapterTitle', { n: index + 1 }),
      content,
    }
  }).filter((chapter) => chapter.title || chapter.content)
}

function buildEpisodesFromChapters(chapters, sizeValue) {
  const size = Math.max(1, Number(sizeValue) || 1)
  return chapters.reduce((list, chapter, index) => {
    const groupIndex = Math.floor(index / size)
    if (!list[groupIndex]) {
      list[groupIndex] = {
        title: '',
        script_content: '',
        chapter_titles: [],
      }
    }
    list[groupIndex].chapter_titles.push(chapter.title)
    list[groupIndex].script_content = [list[groupIndex].script_content, `${chapter.title}\n${chapter.content}`].filter(Boolean).join('\n\n')
    return list
  }, []).map((episode, index) => ({
    episode_number: props.startEpisodeNumber + index,
    title: episode.chapter_titles.length === 1
      ? episode.chapter_titles[0]
      : `${episode.chapter_titles[0]} - ${episode.chapter_titles[episode.chapter_titles.length - 1]}`,
    script_content: episode.script_content,
    chapter_titles: episode.chapter_titles,
  }))
}

function confirmConfig() {
  if (!rawText.value.trim()) {
    ElMessage.warning(t('episodeImport.selectFileFirst'))
    return
  }
  try {
    const chapters = splitNovelChapters(rawText.value, chapterPattern.value)
    const episodes = buildEpisodesFromChapters(chapters, chaptersPerEpisode.value)
    if (!episodes.length) {
      ElMessage.warning(t('episodeImport.noEpisodesGenerated'))
      return
    }
    previewChapters.value = chapters
    previewEpisodes.value = episodes
    previewReady.value = true
    activeTab.value = 'preview'
    ElMessage.success(t('episodeImport.recognizedResult', { chapters: chapters.length, episodes: episodes.length }))
  } catch (e) {
    previewReady.value = false
    previewChapters.value = []
    previewEpisodes.value = []
    ElMessage.error(e.message || t('episodeImport.previewFailed'))
  }
}

async function confirmImport() {
  if (!previewEpisodes.value.length) {
    ElMessage.warning(t('episodeImport.completePreviewFirst'))
    return
  }
  importing.value = true
  try {
    await emit('import', previewEpisodes.value.map((episode) => ({
      episode_number: episode.episode_number,
      title: episode.title,
      script_content: episode.script_content,
      description: null,
      duration: 0,
    })))
    ElMessage.success(t('episodeImport.importedResult', { count: previewEpisodes.value.length }))
    resetState()
  } catch (e) {
    ElMessage.error(e.message || t('episodeImport.importFailed'))
  } finally {
    importing.value = false
  }
}
</script>

<style scoped>
.episode-batch-import-trigger { display: inline-flex; }
.batch-import-dialog { display: flex; flex-direction: column; }
.batch-import-tabs { width: 100%; }
.batch-import-panel { display: flex; flex-direction: column; gap: 16px; min-height: 420px; }
.batch-import-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.batch-import-file { font-size: 0.85rem; color: #a1a1aa; }
.batch-import-file.is-empty { color: #71717a; }
.batch-import-form { margin-bottom: 0; }
.batch-import-tip-block { display: flex; flex-direction: column; gap: 8px; }
.batch-import-tip { font-size: 0.82rem; color: #71717a; }
.batch-import-code { color: #c084fc; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace; }
.batch-import-empty { min-height: 320px; display: flex; align-items: center; justify-content: center; color: #71717a; border: 1px dashed #3f3f46; border-radius: 12px; }
.batch-import-preview-header { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-bottom: 12px; color: #c084fc; font-size: 0.85rem; flex-wrap: wrap; }
.batch-import-preview-table :deep(.el-table) { --el-table-bg-color: transparent; --el-table-tr-bg-color: transparent; --el-table-border-color: #3f3f46; --el-table-header-bg-color: rgba(39, 39, 42, 0.9); --el-table-row-hover-bg-color: rgba(139, 92, 246, 0.08); color: #e4e4e7; }
.batch-import-preview-table :deep(.el-table__inner-wrapper::before) { display: none; }
.batch-import-preview-table :deep(th.el-table__cell) { color: #fafafa; }
.batch-import-preview-table :deep(td.el-table__cell) { vertical-align: top; }
.batch-import-preview-cell { line-height: 1.6; white-space: pre-wrap; color: #d4d4d8; }
.batch-import-preview-cell--single-line { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.4; }
</style>
