<template>
  <div class="scene-model-map-page">
    <div class="page-header">
      <div class="header-left">
        <p class="page-desc">
          {{ $t('sceneModelMap.pageDesc') }}
        </p>
      </div>
      <div class="header-right">
        <el-button type="primary" @click="openAdd">
          <el-icon><Plus /></el-icon>
          {{ $t('sceneModelMap.addConfig') }}
        </el-button>
      </div>
    </div>

    <div v-if="loading" v-loading="true" class="loading-wrap" />
    
    <template v-else>
      <el-table
        :data="list"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="key" :label="$t('sceneModelMap.colSceneKey')" min-width="220">
          <template #default="{ row }">
            <div class="">
              <code class="scene-key">{{ row.key }}</code>
              <span class="scene-key-label">{{ getSceneKeyLabel(row.key) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="service_type" :label="$t('sceneModelMap.colServiceType')" width="120">
          <template #default="{ row }">
            <el-tag :type="serviceTypeTagType(row.service_type)" size="small">
              {{ serviceTypeLabel(row.service_type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="config_name" :label="$t('sceneModelMap.colAiConfig')" min-width="180">
          <template #default="{ row }">
            <span v-if="row.config_id">{{ row.config_name || ('#' + row.config_id) }}</span>
            <el-tag v-else type="info" size="small">{{ $t('sceneModelMap.useDefaultConfig') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="model_override" :label="$t('sceneModelMap.colModelOverride')" min-width="180">
          <template #default="{ row }">
            <span v-if="row.model_override" class="model-override">{{ row.model_override }}</span>
            <span v-else class="text-muted">{{ $t('sceneModelMap.useDefaultModel') }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="description" :label="$t('sceneModelMap.colDescription')" min-width="200" show-overflow-tooltip />
        <el-table-column :label="$t('sceneModelMap.colAction')" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEdit(row)">{{ $t('sceneModelMap.editBtn') }}</el-button>
            <el-button link type="danger" size="small" @click="onDelete(row)">{{ $t('sceneModelMap.deleteBtn') }}</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="list.length === 0" :description="$t('sceneModelMap.emptyConfig')" />
    </template>

    <!-- 添加/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingKey ? $t('sceneModelMap.editTitle') : $t('sceneModelMap.addTitle')"
      width="560px"
      :close-on-click-modal="false"
      @closed="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <el-form-item prop="key" :label="$t('sceneModelMap.fieldSceneKey')">
          <el-select
            v-model="form.key"
            filterable
            allow-create
            default-first-option
            :placeholder="$t('sceneModelMap.fieldSceneKeyPlaceholder')"
            style="width: 100%"
            :disabled="!!editingKey"
            @change="onKeyChange"
          >
            <el-option
              v-for="k in predefinedKeys"
              :key="k.value"
              :label="k.value + ' - ' + $t(k.labelKey)"
              :value="k.value"
            />
          </el-select>
          <p class="field-tip">{{ $t('sceneModelMap.fieldSceneKeyTip') }}</p>
        </el-form-item>

        <el-form-item prop="service_type" :label="$t('sceneModelMap.colServiceType')">
          <el-select v-model="form.service_type" :placeholder="$t('sceneModelMap.fieldServiceTypePlaceholder')" style="width: 100%" disabled>
            <el-option :label="$t('sceneModelMap.serviceTypeText')" value="text" />
            <el-option :label="$t('sceneModelMap.serviceTypeImage')" value="image" />
            <el-option :label="$t('sceneModelMap.serviceTypeStoryboardImage')" value="storyboard_image" />
            <el-option :label="$t('sceneModelMap.serviceTypeVideo')" value="video" />
            <el-option :label="$t('sceneModelMap.serviceTypeTts')" value="tts" />
          </el-select>
          <p class="field-tip">{{ $t('sceneModelMap.fieldServiceTypeTip') }}</p>
        </el-form-item>

        <el-form-item :label="$t('sceneModelMap.colAiConfig')">
          <el-select
            v-model="form.config_id"
            clearable
            :placeholder="$t('sceneModelMap.fieldAiConfigPlaceholder')"
            style="width: 100%"
            @change="onConfigChange"
          >
            <el-option
              v-for="c in filteredConfigs"
              :key="c.id"
              :label="`${c.name} (${c.provider})`"
              :value="c.id"
            />
          </el-select>
          <p class="field-tip">{{ $t('sceneModelMap.fieldAiConfigTip') }}</p>
        </el-form-item>

        <el-form-item :label="$t('sceneModelMap.colModelOverride')">
          <el-select
            v-model="form.model_override"
            clearable
            :placeholder="$t('sceneModelMap.fieldModelPlaceholder')"
            style="width: 100%"
            :disabled="!selectedConfigModels.length"
          >
            <el-option
              v-for="m in selectedConfigModels"
              :key="m"
              :label="m"
              :value="m"
            />
          </el-select>
          <p class="field-tip">
            {{ selectedConfigModels.length ? $t('sceneModelMap.fieldModelTipHasModels') : $t('sceneModelMap.fieldModelTipNoConfig') }}
          </p>
        </el-form-item>
        <el-form-item prop="description" :label="$t('sceneModelMap.colDescription')">
          <el-input
            v-model="form.description"
            :placeholder="$t('sceneModelMap.fieldDescriptionPlaceholder')"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">{{ $t('sceneModelMap.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="save">{{ $t('sceneModelMap.save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { sceneModelMapAPI } from '@/api/sceneModelMap'
import { aiAPI } from '@/api/ai'
import { getSelectableModels } from '@/utils/modelSelection'

const { t } = useI18n()

const loading = ref(false)
const saving = ref(false)
const list = ref([])
const configs = ref([])
const dialogVisible = ref(false)
const editingKey = ref(null)
const formRef = ref(null)

const form = ref({
  key: '',
  description: '',
  service_type: 'text',
  config_id: null,
  model_override: ''
})

const rules = {
  key: [{ required: true, message: t('sceneModelMap.validateKey'), trigger: 'blur' }],
  service_type: [{ required: true, message: t('sceneModelMap.validateServiceType'), trigger: 'change' }]
}

// 预定义场景键及其对应的服务类型
const predefinedKeys = [
  { value: 'image_polish', labelKey: 'sceneModelMap.sceneKeyImagePolish', service_type: 'text' },
  // 目前程序里只内置了一个场景键：image_polish
  // 以下为新增的场景键，已添加到对应的接口里
  { value: 'role_image_polish', labelKey: 'sceneModelMap.sceneKeyRoleImagePolish', service_type: 'text' },
  { value: 'prop_image_polish', labelKey: 'sceneModelMap.sceneKeyPropImagePolish', service_type: 'text' },
  { value: 'scene_image_polish', labelKey: 'sceneModelMap.sceneKeySceneImagePolish', service_type: 'text' },
  { value: 'role_extraction', labelKey: 'sceneModelMap.sceneKeyRoleExtraction', service_type: 'text' },
  { value: 'prop_extraction', labelKey: 'sceneModelMap.sceneKeyPropExtraction', service_type: 'text' },
  { value: 'scene_extraction', labelKey: 'sceneModelMap.sceneKeySceneExtraction', service_type: 'text' },
  { value: 'storyboard_extraction', labelKey: 'sceneModelMap.sceneKeyStoryboardExtraction', service_type: 'text' },
  { value: 'identity_anchors', labelKey: 'sceneModelMap.sceneKeyIdentityAnchors', service_type: 'text' },
  { value: 'frame_prompt', labelKey: 'sceneModelMap.sceneKeyFramePrompt', service_type: 'text' },
  { value: 'novel_import', labelKey: 'sceneModelMap.sceneKeyNovelImport', service_type: 'text' },
  { value: 'story_generation', labelKey: 'sceneModelMap.sceneKeyStoryGeneration', service_type: 'text' },
  //  以下是其他服务类型...未实现
  // 图片生成
  // { value: 'role_image_gen', label: 'role_image_gen - 角色图片生成', service_type: 'image' },
  // { value: 'prop_image_gen', label: 'prop_image_gen - 道具图片生成', service_type: 'image' },
  // { value: 'scene_image_gen', label: 'scene_image_gen - 场景图片生成', service_type: 'image' },
  // { value: 'storyboard_image_gen', label: 'storyboard_image_gen - 分镜图片生成', service_type: 'image' },
  // { value: 'video_frame_gen', label: 'video_frame_gen - 视频帧生成', service_type: 'video' },// 首尾帧视频生成
  // { value: 'video_full_gen', label: 'video_full_gen - 全能视频生成', service_type: 'video' },// 全能模式视频生成
]

// 根据服务类型筛选配置
const filteredConfigs = computed(() => {
  const currentServiceType = form.value.service_type
  console.log('filteredConfigs computed, service_type:', currentServiceType, 'configs:', configs.value.length)
  const filtered = configs.value.filter(c => {
    const match = c.service_type === currentServiceType && c.is_active
    console.log('  config:', c.name, 'service_type:', c.service_type, 'match:', match)
    return match
  })
  console.log('  filtered result:', filtered.length)
  return filtered
})

// 获取选中配置的可用模型列表
const selectedConfigModels = computed(() => {
  return getSelectableModels(configs.value, form.value.service_type, form.value.config_id)
})

function serviceTypeLabel(type) {
  const map = {
    text: t('sceneModelMap.serviceTypeText'),
    image: t('sceneModelMap.serviceTypeImage'),
    storyboard_image: t('sceneModelMap.serviceTypeStoryboardImage'),
    video: t('sceneModelMap.serviceTypeVideo'),
    tts: t('sceneModelMap.serviceTypeTts')
  }
  return map[type] || type
}

function serviceTypeTagType(type) {
  const map = {
    text: 'primary',
    image: 'success',
    storyboard_image: 'warning',
    video: 'danger',
    tts: 'info'
  }
  return map[type] || ''
}

// 获取场景键的 label
function getSceneKeyLabel(key) {
  const matched = predefinedKeys.find(k => k.value === key)
  if (matched) {
    return t(matched.labelKey)
  }
  return ''
}

// 场景键改变时自动设置服务类型
function onKeyChange(key) {
  console.log('onKeyChange called with key:', key)
  const matched = predefinedKeys.find(k => k.value === key)
  console.log('matched predefined key:', matched)
  if (matched) {
    form.value.service_type = matched.service_type
    console.log('service_type set to:', form.value.service_type)
  }
  // 重置配置和模型选择
  form.value.config_id = null
  form.value.model_override = ''
}

// 配置改变时重置模型选择
function onConfigChange(configId) {
  form.value.model_override = ''
}

async function load() {
  loading.value = true
  try {
    const [mapsData, configsData] = await Promise.all([
      sceneModelMapAPI.list(),
      aiAPI.list()
    ])
    configs.value = configsData || []
    console.log('Loaded configs:', configs.value.map(c => ({ id: c.id, name: c.name, service_type: c.service_type, is_active: c.is_active })))
    
    // 合并配置名称
    list.value = (mapsData || []).map(item => {
      const config = configs.value.find(c => c.id === item.config_id)
      return {
        ...item,
        config_name: config?.name || null
      }
    })
  } catch (err) {
    ElMessage.error(t('sceneModelMap.loadFailed') + (err.message || t('sceneModelMap.unknownError')))
  } finally {
    loading.value = false
  }
}

function openAdd() {
  editingKey.value = null
  form.value = {
    key: '',
    description: '',
    service_type: 'text',
    config_id: null,
    model_override: ''
  }
  dialogVisible.value = true
}

function openEdit(row) {
  editingKey.value = row.key
  form.value = {
    key: row.key,
    description: row.description || '',
    service_type: row.service_type || 'text',
    config_id: row.config_id || null,
    model_override: row.model_override || ''
  }
  dialogVisible.value = true
}

async function save() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    const body = {
      description: form.value.description,
      service_type: form.value.service_type,
      config_id: form.value.config_id || null,
      model_override: form.value.model_override || null
    }
    
    if (editingKey.value) {
      await sceneModelMapAPI.update(editingKey.value, body)
      ElMessage.success(t('sceneModelMap.updateSuccess'))
    } else {
      await sceneModelMapAPI.create({ ...body, key: form.value.key })
      ElMessage.success(t('sceneModelMap.createSuccess'))
    }
    dialogVisible.value = false
    await load()
  } catch (err) {
    ElMessage.error(t('sceneModelMap.saveFailed') + (err.message || t('sceneModelMap.unknownError')))
  } finally {
    saving.value = false
  }
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(
      t('sceneModelMap.confirmDelete', { key: row.key }),
      t('sceneModelMap.confirmDeleteTitle'),
      { type: 'warning' }
    )
    await sceneModelMapAPI.delete(row.key)
    ElMessage.success(t('sceneModelMap.deleteSuccess'))
    await load()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(t('sceneModelMap.deleteFailed') + (err.message || t('sceneModelMap.unknownError')))
    }
  }
}

function resetForm() {
  formRef.value?.resetFields()
}

onMounted(() => {
  load()
})
</script>

<style scoped>
.scene-model-map-page {
  padding: 0;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.page-desc {
  margin: 0;
  color: #666;
  font-size: 14px;
  line-height: 1.6;
}

.loading-wrap {
  padding: 40px;
}

.scene-key {
  background: #f5f7fa;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: #409eff;
  width: fit-content;
}

.scene-key-label {
  font-size: 12px;
  color: #666;
}

.model-override {
  background: #e6f7ff;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: #096dd9;
}

.text-muted {
  color: #999;
  font-size: 13px;
}

.field-tip {
  margin: 6px 0 0;
  font-size: 12px;
  color: #999;
  line-height: 1.4;
}
</style>
