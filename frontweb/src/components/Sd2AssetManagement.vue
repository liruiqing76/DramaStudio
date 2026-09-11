<template>
  <div class="sd2-asset-mgmt tab-content">
    <el-alert type="info" :closable="false" class="sd2-intro" show-icon>
      <template #title>
        <span v-html="$t('sd2Asset.alertContent')"></span>
      </template>
    </el-alert>

    <el-form label-width="120px" class="sd2-form">
      <el-form-item label="Base URL">
        <el-input
          v-model="baseUrl"
          :placeholder="$t('sd2Asset.baseUrlPlaceholder')"
          clearable
        />
        <p class="field-hint" v-html="$t('sd2Asset.baseUrlHint')"></p>
      </el-form-item>
      <el-form-item :label="$t('sd2Asset.authModeLabel')">
        <el-radio-group v-model="authMode">
          <el-radio-button value="volc_sign">{{ $t('sd2Asset.authModeVolcSign') }}</el-radio-button>
          <el-radio-button value="bearer">{{ $t('sd2Asset.authModeBearer') }}</el-radio-button>
        </el-radio-group>
        <p class="field-hint" v-html="$t('sd2Asset.authModeHint')"></p>
      </el-form-item>
      <el-form-item v-if="authMode === 'bearer'" label="API Key">
        <el-input v-model="apiKey" type="password" show-password :placeholder="$t('sd2Asset.apiKeyPlaceholder')" clearable />
      </el-form-item>
      <template v-else>
        <el-form-item label="Access Key ID">
          <el-input v-model="accessKeyId" :placeholder="$t('sd2Asset.accessKeyIdPlaceholder')" clearable />
        </el-form-item>
        <el-form-item label="Secret Key">
          <el-input v-model="secretAccessKey" type="password" show-password :placeholder="$t('sd2Asset.secretKeyPlaceholder')" clearable />
        </el-form-item>
        <el-form-item label="Region">
          <el-input v-model="signRegion" :placeholder="$t('sd2Asset.regionPlaceholder')" clearable />
        </el-form-item>
      </template>
      <el-form-item :label="$t('sd2Asset.pathModeLabel')">
        <el-select v-model="pathMode" style="width: 100%">
          <el-option :label="$t('sd2Asset.pathModeOpenApi')" value="open_api_query" />
          <el-option :label="$t('sd2Asset.pathModeSubpath')" value="asset_subpath" />
          <el-option :label="$t('sd2Asset.pathModeFlat')" value="flat" />
        </el-select>
        <p class="field-hint" v-html="$t('sd2Asset.pathModeHint')"></p>
      </el-form-item>
      <el-form-item label="API Version">
        <el-input v-model="apiVersion" :placeholder="$t('sd2Asset.apiVersionPlaceholder')" clearable />
      </el-form-item>
      <el-form-item v-if="pathMode === 'open_api_query'" :label="$t('sd2Asset.projectNameLabel')">
        <el-input
          v-model="projectName"
          :placeholder="$t('sd2Asset.projectNamePlaceholder')"
          clearable
        />
        <p class="field-hint" v-html="$t('sd2Asset.projectNameHint')"></p>
      </el-form-item>
      <el-form-item :label="$t('sd2Asset.billingModelLabel')">
        <el-input v-model="billingModel" :placeholder="$t('sd2Asset.billingModelPlaceholder')" clearable />
      </el-form-item>
      <el-form-item :label="$t('sd2Asset.fillConfigLabel')">
        <el-select
          v-model="fillConfigId"
          filterable
          clearable
          :placeholder="$t('sd2Asset.fillConfigPlaceholder')"
          style="width: 100%"
          @change="onFillFromSaved"
        >
          <el-option
            v-for="c in videoLikeConfigs"
            :key="c.id"
            :label="`${c.name} · ${c.base_url || ''}`"
            :value="c.id"
          />
        </el-select>
      </el-form-item>
    </el-form>

    <el-row :gutter="16">
      <el-col :span="11">
        <div class="panel-title">{{ $t('sd2Asset.groupTitle') }}</div>
        <div class="panel-actions">
          <el-button type="primary" size="small" :loading="loadingGroups" @click="refreshGroups">{{ $t('sd2Asset.refreshList') }}</el-button>
          <el-button type="success" size="small" @click="openCreateGroup">{{ $t('sd2Asset.newGroup') }}</el-button>
        </div>
        <el-table
          :data="groupRows"
          size="small"
          stripe
          highlight-current-row
          max-height="320"
          @current-change="onGroupRowChange"
        >
          <el-table-column prop="Id" label="Id" min-width="120" show-overflow-tooltip />
          <el-table-column prop="Name" :label="$t('sd2Asset.nameLabel')" min-width="100" show-overflow-tooltip />
          <el-table-column :label="$t('sd2Asset.actionLabel')" width="168" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="getGroupDetail(row)">{{ $t('sd2Asset.detailBtn') }}</el-button>
              <el-button link type="primary" size="small" @click="openEditGroup(row)">{{ $t('sd2Asset.editBtn') }}</el-button>
              <el-button link type="danger" size="small" @click="deleteGroup(row)">{{ $t('sd2Asset.deleteBtn') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-col>
      <el-col :span="13">
        <div class="panel-title">{{ $t('sd2Asset.assetTitle') }}</div>
        <div class="panel-actions row-gap">
          <el-input v-model="assetGroupIdInput" :placeholder="$t('sd2Asset.assetGroupIdInputPlaceholder')" clearable style="flex: 1; min-width: 140px" />
          <el-button type="primary" size="small" :loading="loadingAssets" @click="refreshAssets">{{ $t('sd2Asset.refresh') }}</el-button>
          <el-button type="success" size="small" @click="openCreateAsset">{{ $t('sd2Asset.newAsset') }}</el-button>
        </div>
        <el-table :data="assetRows" size="small" stripe max-height="320">
          <el-table-column prop="Id" label="Id" min-width="120" show-overflow-tooltip />
          <el-table-column prop="Name" :label="$t('sd2Asset.nameLabel')" min-width="90" show-overflow-tooltip />
          <el-table-column prop="AssetType" :label="$t('sd2Asset.typeLabel')" width="88" />
          <el-table-column :label="$t('sd2Asset.actionLabel')" width="168" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="getAssetDetail(row)">{{ $t('sd2Asset.detailBtn') }}</el-button>
              <el-button link type="primary" size="small" @click="openEditAsset(row)">{{ $t('sd2Asset.editBtn') }}</el-button>
              <el-button link type="danger" size="small" @click="deleteAsset(row)">{{ $t('sd2Asset.deleteBtn') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-col>
    </el-row>

    <div class="panel-title" style="margin-top: 16px">{{ $t('sd2Asset.lastResponseTitle') }}</div>
    <el-input v-model="lastRawJson" type="textarea" :rows="6" readonly class="mono" />

    <!-- 新建资产组 -->
    <el-dialog v-model="dlgGroupCreate" title="CreateAssetGroup" width="480px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="Name" required>
          <el-input v-model="formGroupName" :placeholder="$t('sd2Asset.groupNamePlaceholder')" />
        </el-form-item>
        <el-form-item :label="$t('sd2Asset.extraJsonLabel')">
          <el-input v-model="formGroupExtraJson" type="textarea" :rows="3" :placeholder="$t('sd2Asset.extraJsonPlaceholder')" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dlgGroupCreate = false">{{ $t('sd2Asset.cancel') }}</el-button>
        <el-button type="primary" :loading="dlgLoading" @click="submitCreateGroup">{{ $t('sd2Asset.submit') }}</el-button>
      </template>
    </el-dialog>

    <!-- 编辑资产组 -->
    <el-dialog v-model="dlgGroupEdit" title="UpdateAssetGroup" width="520px" destroy-on-close>
      <el-alert type="warning" :closable="false" :title="$t('sd2Asset.editGroupAlertTitle')" style="margin-bottom: 12px" />
      <el-form label-width="100px">
        <el-form-item label="Id" required>
          <el-input v-model="editGroupId" disabled />
        </el-form-item>
        <el-form-item label="Name">
          <el-input v-model="editGroupName" />
        </el-form-item>
        <el-form-item :label="$t('sd2Asset.fullJsonLabel')">
          <el-input v-model="editGroupFullJson" type="textarea" :rows="6" :placeholder="$t('sd2Asset.fullJsonPlaceholderGroup')" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dlgGroupEdit = false">{{ $t('sd2Asset.cancel') }}</el-button>
        <el-button type="primary" :loading="dlgLoading" @click="submitUpdateGroup">{{ $t('sd2Asset.submit') }}</el-button>
      </template>
    </el-dialog>

    <!-- 新建资产 -->
    <el-dialog v-model="dlgAssetCreate" title="CreateAsset" width="520px" destroy-on-close>
      <el-form label-width="110px">
        <el-form-item label="GroupId" required>
          <el-input v-model="formAssetGroupId" :placeholder="$t('sd2Asset.assetGroupIdPlaceholder')" />
        </el-form-item>
        <el-form-item label="Name" required>
          <el-input v-model="formAssetName" />
        </el-form-item>
        <el-form-item label="AssetType">
          <el-select v-model="formAssetType" style="width: 100%">
            <el-option label="Image" value="Image" />
            <el-option label="Video" value="Video" />
            <el-option label="Audio" value="Audio" />
          </el-select>
        </el-form-item>
        <el-form-item label="model">
          <el-input v-model="formAssetModel" :placeholder="$t('sd2Asset.assetModelPlaceholder')" clearable />
        </el-form-item>
        <el-form-item label="URL">
          <el-input v-model="formAssetUrl" type="textarea" :rows="2" :placeholder="$t('sd2Asset.assetUrlPlaceholder')" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dlgAssetCreate = false">{{ $t('sd2Asset.cancel') }}</el-button>
        <el-button type="primary" :loading="dlgLoading" @click="submitCreateAsset">{{ $t('sd2Asset.submit') }}</el-button>
      </template>
    </el-dialog>

    <!-- 编辑资产 -->
    <el-dialog v-model="dlgAssetEdit" title="UpdateAsset" width="520px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="Id" required>
          <el-input v-model="editAssetId" disabled />
        </el-form-item>
        <el-form-item label="Name">
          <el-input v-model="editAssetName" />
        </el-form-item>
        <el-form-item :label="$t('sd2Asset.fullJsonLabel')">
          <el-input v-model="editAssetFullJson" type="textarea" :rows="6" :placeholder="$t('sd2Asset.fullJsonPlaceholderAsset')" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dlgAssetEdit = false">{{ $t('sd2Asset.cancel') }}</el-button>
        <el-button type="primary" :loading="dlgLoading" @click="submitUpdateAsset">{{ $t('sd2Asset.submit') }}</el-button>
      </template>
    </el-dialog>

    <!-- 详情 JSON -->
    <el-dialog v-model="dlgDetail" :title="$t('sd2Asset.detailTitle')" width="640px" destroy-on-close>
      <el-input :model-value="detailJson" type="textarea" :rows="16" readonly class="mono" />
      <template #footer>
        <el-button type="primary" @click="dlgDetail = false">{{ $t('sd2Asset.close') }}</el-button>
      </template>
    </el-dialog>

    <!-- 编辑资产组 -->
    <el-dialog v-model="dlgGroupEdit" title="UpdateAssetGroup" width="520px" destroy-on-close>
      <el-alert type="warning" :closable="false" title="按官方文档填写需更新的字段；以下为常用名称修改。" style="margin-bottom: 12px" />
      <el-form label-width="100px">
        <el-form-item label="Id" required>
          <el-input v-model="editGroupId" disabled />
        </el-form-item>
        <el-form-item label="Name">
          <el-input v-model="editGroupName" />
        </el-form-item>
        <el-form-item label="完整 JSON">
          <el-input v-model="editGroupFullJson" type="textarea" :rows="6" placeholder='若填写则优先整段作为请求体（须含 Id）' />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dlgGroupEdit = false">取消</el-button>
        <el-button type="primary" :loading="dlgLoading" @click="submitUpdateGroup">提交</el-button>
      </template>
    </el-dialog>

    <!-- 新建资产 -->
    <el-dialog v-model="dlgAssetCreate" title="CreateAsset" width="520px" destroy-on-close>
      <el-form label-width="110px">
        <el-form-item label="GroupId" required>
          <el-input v-model="formAssetGroupId" placeholder="资产组 Id" />
        </el-form-item>
        <el-form-item label="Name" required>
          <el-input v-model="formAssetName" />
        </el-form-item>
        <el-form-item label="AssetType">
          <el-select v-model="formAssetType" style="width: 100%">
            <el-option label="Image" value="Image" />
            <el-option label="Video" value="Video" />
            <el-option label="Audio" value="Audio" />
          </el-select>
        </el-form-item>
        <el-form-item label="model">
          <el-input v-model="formAssetModel" placeholder="视频建议 volc-asset-video；音频 volc-asset-audio；图片可空" clearable />
        </el-form-item>
        <el-form-item label="URL">
          <el-input v-model="formAssetUrl" type="textarea" :rows="2" placeholder="公网 URL / data:image/...;base64,..." />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dlgAssetCreate = false">取消</el-button>
        <el-button type="primary" :loading="dlgLoading" @click="submitCreateAsset">提交</el-button>
      </template>
    </el-dialog>

    <!-- 编辑资产 -->
    <el-dialog v-model="dlgAssetEdit" title="UpdateAsset" width="520px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="Id" required>
          <el-input v-model="editAssetId" disabled />
        </el-form-item>
        <el-form-item label="Name">
          <el-input v-model="editAssetName" />
        </el-form-item>
        <el-form-item label="完整 JSON">
          <el-input v-model="editAssetFullJson" type="textarea" :rows="6" placeholder="若填写则整段作为请求体（须含 Id）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dlgAssetEdit = false">取消</el-button>
        <el-button type="primary" :loading="dlgLoading" @click="submitUpdateAsset">提交</el-button>
      </template>
    </el-dialog>

    <!-- 详情 JSON -->
    <el-dialog v-model="dlgDetail" title="详情" width="640px" destroy-on-close>
      <el-input :model-value="detailJson" type="textarea" :rows="16" readonly class="mono" />
      <template #footer>
        <el-button type="primary" @click="dlgDetail = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { aiAPI } from '@/api/ai'

const { t } = useI18n()

const props = defineProps({
  /** AI 配置列表（与 AI 配置页同源），用于一键填入 Base / Key */
  configs: { type: Array, default: () => [] },
})

const baseUrl = ref('')
const apiKey = ref('')
const pathMode = ref('open_api_query')
const apiVersion = ref('2024-01-01')
/** OpenAPI 可选查询参数 ProjectName（与控制台项目对应，便于 IAM 精确到 project/某工程 而非 project/*） */
const projectName = ref('')
const authMode = ref('volc_sign')
const accessKeyId = ref('')
const secretAccessKey = ref('')
const signRegion = ref('')
/** 仅合并到 List / Create 类请求，避免影响 Get/Update/Delete */
const billingModel = ref('')
const fillConfigId = ref(null)
const loadingGroups = ref(false)
const loadingAssets = ref(false)
const dlgLoading = ref(false)
const lastRawJson = ref('')
const assetGroupIdInput = ref('')
const lastListGroupsPayload = ref(null)
const lastListAssetsPayload = ref(null)

const dlgGroupCreate = ref(false)
const formGroupName = ref('')
const formGroupExtraJson = ref('')

const dlgGroupEdit = ref(false)
const editGroupId = ref('')
const editGroupName = ref('')
const editGroupFullJson = ref('')

const dlgAssetCreate = ref(false)
const formAssetGroupId = ref('')
const formAssetName = ref('')
const formAssetType = ref('Image')
const formAssetModel = ref('')
const formAssetUrl = ref('')

const dlgAssetEdit = ref(false)
const editAssetId = ref('')
const editAssetName = ref('')
const editAssetFullJson = ref('')

const dlgDetail = ref(false)
const detailJson = ref('')

const videoLikeConfigs = computed(() => {
  const rows = props.configs || []
  return rows.filter((c) => {
    if (c.service_type !== 'video') return false
    const u = (c.base_url || '').toLowerCase()
    const p = (c.api_protocol || '').toLowerCase()
    return (
      p.includes('volc') ||
      u.includes('volces.com') ||
      u.includes('byteplus') ||
      u.includes('byteplustech') ||
      u.includes('/ark')
    )
  })
})

function setLastJson(obj) {
  try {
    lastRawJson.value = JSON.stringify(obj, null, 2)
  } catch (_) {
    lastRawJson.value = String(obj)
  }
}

function extractRows(resp) {
  if (!resp) return []
  if (Array.isArray(resp)) return resp
  const keys = [
    'Items',
    'List',
    'AssetGroups',
    'Assets',
    'Groups',
    'Data',
  ]
  for (const k of keys) {
    if (Array.isArray(resp[k])) return resp[k]
  }
  const r = resp.Result || resp.result
  if (r && typeof r === 'object') {
    for (const k of keys) {
      if (Array.isArray(r[k])) return r[k]
    }
  }
  return []
}

const groupRows = computed(() => extractRows(lastListGroupsPayload.value))
const assetRows = computed(() => extractRows(lastListAssetsPayload.value))

function onFillFromSaved(id) {
  if (id == null || id === '') return
  const c = (props.configs || []).find((x) => x.id === id)
  if (!c) return
  baseUrl.value = (c.base_url || '').replace(/\/$/, '')
  apiKey.value = c.api_key || ''
  ElMessage.success(t('sd2Asset.filledConfig'))
}

function onGroupRowChange(row) {
  if (row && row.Id) {
    assetGroupIdInput.value = row.Id
  }
}

function mergeBillingModel(payload, withModel) {
  const p = { ...(payload || {}) }
  if (withModel && billingModel.value.trim() && !String(p.model || '').trim()) {
    p.model = billingModel.value.trim()
  }
  return p
}

function connReady() {
  if (!baseUrl.value.trim()) return false
  if (authMode.value === 'volc_sign') {
    return !!(accessKeyId.value.trim() && secretAccessKey.value.trim())
  }
  return !!apiKey.value.trim()
}

function connWarn() {
  if (!baseUrl.value.trim()) return t('sd2Asset.fillBaseUrlFirst')
  if (authMode.value === 'volc_sign') {
    if (!accessKeyId.value.trim() || !secretAccessKey.value.trim()) {
      return t('sd2Asset.fillAkSk')
    }
  } else if (!apiKey.value.trim()) {
    return t('sd2Asset.fillApiKeyFirst')
  }
  if (authMode.value === 'volc_sign' && pathMode.value !== 'open_api_query') {
    return t('sd2Asset.akSkWithPathMode')
  }
  return ''
}

async function call(action, payload, opts = {}) {
  const { withBillingModel = false } = opts
  const body = {
    base_url: baseUrl.value.trim(),
    action,
    path_mode: pathMode.value,
    api_version: apiVersion.value.trim() || undefined,
    auth_mode: authMode.value,
    payload: mergeBillingModel(payload, withBillingModel),
  }
  if (pathMode.value === 'open_api_query' && projectName.value.trim()) {
    body.project_name = projectName.value.trim()
  }
  if (authMode.value === 'bearer') {
    body.api_key = apiKey.value
  } else {
    body.access_key_id = accessKeyId.value.trim()
    body.secret_access_key = secretAccessKey.value.trim()
    if (signRegion.value.trim()) body.sign_region = signRegion.value.trim()
  }
  return aiAPI.modelArkAsset(body)
}

async function refreshGroups() {
  const w = connWarn()
  if (!connReady() || w) {
    ElMessage.warning(w || t('sd2Asset.fillConnInfo'))
    return
  }
  loadingGroups.value = true
  try {
    const body = {
      PageNumber: 1,
      PageSize: 50,
      /** Filter、Filter.GroupType 均为官方 ListAssetGroups 必填；AIGC 为私有资产库常用类型 */
      Filter: {
        GroupType: 'AIGC',
      },
    }
    const data = await call('ListAssetGroups', body, { withBillingModel: true })
    lastListGroupsPayload.value = data
    setLastJson(data)
  } catch (e) {
    lastListGroupsPayload.value = null
  } finally {
    loadingGroups.value = false
  }
}

async function refreshAssets() {
  const gid = assetGroupIdInput.value.trim()
  const w = connWarn()
  if (!connReady() || w) {
    ElMessage.warning(w || t('sd2Asset.fillConnInfo'))
    return
  }
  if (!gid) {
    ElMessage.warning(t('sd2Asset.fillGroupId'))
    return
  }
  loadingAssets.value = true
  try {
    const body = {
      PageNumber: 1,
      PageSize: 50,
      Filter: {
        GroupType: 'AIGC',
        GroupIds: [gid],
      },
    }
    const data = await call('ListAssets', body, { withBillingModel: true })
    lastListAssetsPayload.value = data
    setLastJson(data)
  } catch (e) {
    lastListAssetsPayload.value = null
  } finally {
    loadingAssets.value = false
  }
}

function openCreateGroup() {
  formGroupName.value = ''
  formGroupExtraJson.value = ''
  dlgGroupCreate.value = true
}

async function submitCreateGroup() {
  if (!formGroupName.value.trim()) {
    ElMessage.warning(t('sd2Asset.fillName'))
    return
  }
  dlgLoading.value = true
  try {
    let extra = {}
    if (formGroupExtraJson.value.trim()) {
      try {
        extra = JSON.parse(formGroupExtraJson.value)
      } catch (_) {
        ElMessage.error(t('sd2Asset.extraJsonInvalid'))
        return
      }
    }
    const payload = { Name: formGroupName.value.trim(), ...extra }
    const data = await call('CreateAssetGroup', payload, { withBillingModel: true })
    setLastJson(data)
    ElMessage.success(t('sd2Asset.created'))
    dlgGroupCreate.value = false
    await refreshGroups()
  } finally {
    dlgLoading.value = false
  }
}

async function getGroupDetail(row) {
  dlgLoading.value = true
  try {
    const data = await call('GetAssetGroup', { Id: row.Id })
    detailJson.value = JSON.stringify(data, null, 2)
    dlgDetail.value = true
    setLastJson(data)
  } finally {
    dlgLoading.value = false
  }
}

function openEditGroup(row) {
  editGroupId.value = row.Id
  editGroupName.value = row.Name || ''
  editGroupFullJson.value = ''
  dlgGroupEdit.value = true
}

async function submitUpdateGroup() {
  dlgLoading.value = true
  try {
    let payload
    if (editGroupFullJson.value.trim()) {
      try {
        payload = JSON.parse(editGroupFullJson.value)
      } catch (_) {
        ElMessage.error(t('sd2Asset.fullJsonInvalid'))
        return
      }
    } else {
      payload = { Id: editGroupId.value, Name: editGroupName.value }
    }
    const data = await call('UpdateAssetGroup', payload)
    setLastJson(data)
    ElMessage.success(t('sd2Asset.updated'))
    dlgGroupEdit.value = false
    await refreshGroups()
  } finally {
    dlgLoading.value = false
  }
}

async function deleteGroup(row) {
  try {
    await ElMessageBox.confirm(t('sd2Asset.confirmDeleteGroup', { name: row.Name || row.Id }), 'DeleteAssetGroup', {
      type: 'warning',
    })
  } catch (_) {
    return
  }
  dlgLoading.value = true
  try {
    const data = await call('DeleteAssetGroup', { Id: row.Id })
    setLastJson(data)
    ElMessage.success(t('sd2Asset.deleted'))
    if (assetGroupIdInput.value === row.Id) assetGroupIdInput.value = ''
    await refreshGroups()
  } finally {
    dlgLoading.value = false
  }
}

function openCreateAsset() {
  formAssetGroupId.value = assetGroupIdInput.value.trim()
  formAssetName.value = ''
  formAssetType.value = 'Image'
  formAssetModel.value = ''
  formAssetUrl.value = ''
  dlgAssetCreate.value = true
}

async function submitCreateAsset() {
  if (!formAssetGroupId.value.trim() || !formAssetName.value.trim()) {
    ElMessage.warning(t('sd2Asset.fillGroupIdAndName'))
    return
  }
  dlgLoading.value = true
  try {
    const payload = {
      GroupId: formAssetGroupId.value.trim(),
      Name: formAssetName.value.trim(),
      AssetType: formAssetType.value,
    }
    if (formAssetUrl.value.trim()) payload.URL = formAssetUrl.value.trim()
    if (formAssetModel.value.trim()) payload.model = formAssetModel.value.trim()
    const data = await call('CreateAsset', payload, { withBillingModel: true })
    setLastJson(data)
    ElMessage.success(t('sd2Asset.created'))
    dlgAssetCreate.value = false
    await refreshAssets()
  } finally {
    dlgLoading.value = false
  }
}

async function getAssetDetail(row) {
  dlgLoading.value = true
  try {
    const data = await call('GetAsset', { Id: row.Id })
    detailJson.value = JSON.stringify(data, null, 2)
    dlgDetail.value = true
    setLastJson(data)
  } finally {
    dlgLoading.value = false
  }
}

function openEditAsset(row) {
  editAssetId.value = row.Id
  editAssetName.value = row.Name || ''
  editAssetFullJson.value = ''
  dlgAssetEdit.value = true
}

async function submitUpdateAsset() {
  dlgLoading.value = true
  try {
    let payload
    if (editAssetFullJson.value.trim()) {
      try {
        payload = JSON.parse(editAssetFullJson.value)
      } catch (_) {
        ElMessage.error(t('sd2Asset.fullJsonInvalid'))
        return
      }
    } else {
      payload = { Id: editAssetId.value, Name: editAssetName.value }
    }
    const data = await call('UpdateAsset', payload)
    setLastJson(data)
    ElMessage.success(t('sd2Asset.updated'))
    dlgAssetEdit.value = false
    await refreshAssets()
  } finally {
    dlgLoading.value = false
  }
}

async function deleteAsset(row) {
  try {
    await ElMessageBox.confirm(t('sd2Asset.confirmDeleteAsset', { name: row.Name || row.Id }), 'DeleteAsset', { type: 'warning' })
  } catch (_) {
    return
  }
  dlgLoading.value = true
  try {
    const data = await call('DeleteAsset', { Id: row.Id })
    setLastJson(data)
    ElMessage.success(t('sd2Asset.deleted'))
    await refreshAssets()
  } finally {
    dlgLoading.value = false
  }
}
</script>

<style scoped>
.sd2-asset-mgmt {
  max-width: 1100px;
}
.sd2-intro {
  margin-bottom: 14px;
}
.sd2-intro code {
  font-size: 12px;
}
.sd2-form {
  margin-bottom: 8px;
  max-width: 720px;
}
.field-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}
.field-hint code {
  font-size: 11px;
}
.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}
.panel-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}
.panel-actions.row-gap {
  flex-wrap: nowrap;
}
.mono :deep(textarea) {
  font-family: Menlo, Consolas, monospace;
  font-size: 12px;
}
</style>
