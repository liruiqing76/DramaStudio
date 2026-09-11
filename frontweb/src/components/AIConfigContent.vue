<template>
  <div class="ai-config-content">
    <el-tabs v-model="activeTab" class="config-tabs">
      <el-tab-pane :label="$t('aiConfigContent.tabConfigs')" name="configs">
        <div class="tab-content">
          <!-- 普通模式操作栏 -->
          <div v-if="!vendorLock.enabled" class="content-actions">
            <div class="actions-left">
              <el-button type="primary" @click="openAdd">
                <el-icon><Plus /></el-icon>
                {{ $t('aiConfigContent.addConfig') }}
              </el-button>
              <el-button plain @click="exportConfigs">
                <el-icon><Download /></el-icon>
                {{ $t('aiConfigContent.exportConfig') }}
              </el-button>
              <el-button plain @click="triggerImport">
                <el-icon><Upload /></el-icon>
                {{ $t('aiConfigContent.importConfig') }}
              </el-button>
              <input ref="importFileRef" type="file" accept=".json" style="display:none" @change="importConfigs" />
              <el-button type="success" plain @click="openOneKeyTongyi">
                <el-icon><MagicStick /></el-icon>
                {{ $t('aiConfigContent.oneKeyTongyi') }}
              </el-button>
              <el-button type="success" plain @click="openOneKeyVolc">
                <el-icon><MagicStick /></el-icon>
                {{ $t('aiConfigContent.oneKeyVolc') }}
              </el-button>
            </div>
            <div class="actions-right">
              <transition name="fade-slide">
                <el-button
                  v-if="selectedRows.length > 0"
                  type="danger"
                  :loading="batchDeleting"
                  @click="onBatchDelete"
                >
                  <el-icon><Delete /></el-icon>
                  {{ $t('aiConfigContent.deleteSelected', { count: selectedRows.length }) }}
                </el-button>
              </transition>
            </div>
          </div>
          <!-- 锁定模式提示栏 -->
          <div v-else class="vendor-lock-bar">
            <el-alert
              type="info"
              :closable="false"
              class="vendor-lock-tip"
            >
              <template #title>
                <span v-html="$t('aiConfigContent.vendorLockTip')"></span>
              </template>
            </el-alert>
            <el-button type="primary" size="small" class="vendor-bulk-key-btn" @click="openBulkKey">
              <el-icon><Key /></el-icon>
              {{ $t('aiConfigContent.bulkKey') }}
            </el-button>
          </div>
          <p class="default-tip">{{ $t('aiConfigContent.defaultTip') }}</p>
          <el-table
            v-loading="loading"
            :data="list"
            stripe
            style="width: 100%"
            @selection-change="onSelectionChange"
          >
            <el-table-column v-if="!vendorLock.enabled" type="selection" width="46" />
            <el-table-column prop="name" :label="$t('aiConfigContent.colName')" min-width="130" />
            <el-table-column prop="provider" :label="$t('aiConfigContent.colProvider')" width="96" />
            <el-table-column prop="base_url" label="Base URL" min-width="170" show-overflow-tooltip />
            <el-table-column prop="default_model" :label="$t('aiConfigContent.colDefaultModel')" min-width="130" show-overflow-tooltip>
              <template #default="{ row }">
                {{ row.default_model || (Array.isArray(row.model) && row.model[0]) || '—' }}
              </template>
            </el-table-column>
            <el-table-column prop="service_type" :label="$t('aiConfigContent.colType')" width="148">
              <template #default="{ row }">
                <span :class="['type-badge', 'type-' + row.service_type]">
                  <el-icon class="type-icon">
                    <ChatDotRound v-if="row.service_type === 'text'" />
                    <Picture v-else-if="row.service_type === 'image'" />
                    <Film v-else-if="row.service_type === 'storyboard_image'" />
                    <VideoCamera v-else-if="row.service_type === 'video'" />
                    <Microphone v-else-if="row.service_type === 'tts'" />
                    <Key v-else-if="row.service_type === 'jimeng2_character_auth'" />
                  </el-icon>
                  {{ serviceTypeLabel(row.service_type) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="is_default" :label="$t('aiConfigContent.colDefault')" width="60">
              <template #default="{ row }">
                <el-tag v-if="row.is_default" type="success" size="small">✓</el-tag>
                <span v-else class="no-default">—</span>
              </template>
            </el-table-column>
            <el-table-column :label="$t('aiConfigContent.colAction')" width="180" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="openTest(row)">{{ $t('aiConfigContent.testBtn') }}</el-button>
                <el-button link type="primary" size="small" @click="openEdit(row)">{{ vendorLock.enabled ? $t('aiConfigContent.editKey') : $t('aiConfigContent.editBtn') }}</el-button>
                <el-button v-if="!vendorLock.enabled" link type="danger" size="small" @click="onDelete(row)">{{ $t('aiConfigContent.deleteBtn') }}</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
      <el-tab-pane :label="$t('aiConfigContent.tabPrompts')" name="prompts">
        <div class="tab-content">
          <PromptEditor />
        </div>
      </el-tab-pane>
      <el-tab-pane :label="$t('aiConfigContent.tabSceneModelMap')" name="sceneModelMap">
        <div class="tab-content">
          <SceneModelMap />
        </div>
      </el-tab-pane>
      <el-tab-pane :label="$t('aiConfigContent.tabGeneration')" name="generation">
        <div class="tab-content generation-settings">
          <div class="gs-section-title">{{ $t('aiConfigContent.genSettingTitle') }}</div>
          <p class="gs-desc">{{ $t('aiConfigContent.genSettingDesc') }}</p>

          <div class="gs-row">
            <span class="gs-label">{{ $t('aiConfigContent.imageConcurrency') }}</span>
            <el-select
              v-model="genConcurrencyInput"
              filterable
              allow-create
              default-first-option
              :placeholder="$t('aiConfigContent.concurrencyPlaceholder')"
              style="width: 180px"
              @change="onConcurrencyChange"
            >
              <el-option :label="$t('aiConfigContent.concurrencyOpt1')" :value="1" />
              <el-option :label="$t('aiConfigContent.concurrencyOpt2')" :value="2" />
              <el-option :label="$t('aiConfigContent.concurrencyOpt3')" :value="3" />
              <el-option :label="$t('aiConfigContent.concurrencyOpt5')" :value="5" />
              <el-option :label="$t('aiConfigContent.concurrencyOpt8')" :value="8" />
              <el-option :label="$t('aiConfigContent.concurrencyOpt10')" :value="10" />
            </el-select>
            <span class="gs-unit">{{ $t('aiConfigContent.concurrencyUnit') }}</span>
          </div>

          <div class="gs-row" style="margin-top: 10px">
            <span class="gs-label">{{ $t('aiConfigContent.videoConcurrency') }}</span>
            <el-select
              v-model="genVideoConcurrencyInput"
              filterable
              allow-create
              default-first-option
              :placeholder="$t('aiConfigContent.concurrencyPlaceholder')"
              style="width: 180px"
              @change="onVideoConcurrencyChange"
            >
              <el-option :label="$t('aiConfigContent.concurrencyOpt1')" :value="1" />
              <el-option :label="$t('aiConfigContent.concurrencyOpt2')" :value="2" />
              <el-option :label="$t('aiConfigContent.concurrencyOpt3')" :value="3" />
              <el-option :label="$t('aiConfigContent.concurrencyOpt5')" :value="5" />
              <el-option :label="$t('aiConfigContent.concurrencyOpt8')" :value="8" />
              <el-option :label="$t('aiConfigContent.concurrencyOpt10')" :value="10" />
            </el-select>
            <span class="gs-unit">{{ $t('aiConfigContent.concurrencyUnit') }}</span>
          </div>

          <div style="margin-top: 14px">
            <el-button
              type="primary"
              size="small"
              :loading="genSettingSaving"
              @click="saveGenerationSettings"
            >{{ $t('aiConfigContent.saveBtn') }}</el-button>
          </div>
          <el-alert
            v-if="genSettingSaved"
            type="success"
            :title="$t('aiConfigContent.saved')"
            :closable="false"
            show-icon
            style="margin-top: 12px; width: fit-content"
          />
          <div class="gs-tip-box">
            <div class="gs-tip-title">{{ $t('aiConfigContent.genTipTitle') }}</div>
            <ul class="gs-tip-list">
              <li>{{ $t('aiConfigContent.genTipImage') }}</li>
              <li>{{ $t('aiConfigContent.genTipVideo') }}</li>
            </ul>
          </div>
        </div>
      </el-tab-pane>
      <el-tab-pane :label="$t('aiConfigContent.tabSd2Assets')" name="sd2_assets">
        <div class="tab-content">
          <Sd2AssetManagement :configs="list" />
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 添加/编辑 -->
    <el-dialog
      v-model="dialogVisible"
      :title="vendorLock.enabled ? $t('aiConfigContent.titleEditKey') : (editingId ? $t('aiConfigContent.titleEditConfig') : $t('aiConfigContent.titleAddConfig'))"
      width="520px"
      :close-on-click-modal="false"
      @closed="resetForm"
    >
      <!-- 锁定模式：只展示 api_key 和 default_model -->
      <template v-if="vendorLock.enabled">
        <el-descriptions :column="1" border style="margin-bottom: 16px">
          <el-descriptions-item :label="$t('aiConfigContent.labelName')">{{ form.name }}</el-descriptions-item>
          <el-descriptions-item :label="$t('aiConfigContent.labelType')">{{ serviceTypeLabel(form.service_type) }}</el-descriptions-item>
          <el-descriptions-item :label="$t('aiConfigContent.labelVendor')">{{ form.provider }}</el-descriptions-item>
        </el-descriptions>
        <el-form ref="formRef" :model="form" label-width="100px">
          <el-form-item prop="api_key" :rules="[{ required: true, message: t('aiConfigContent.validateApiKey'), trigger: 'blur' }]">
            <template #label><span class="form-label-tip">API Key</span></template>
            <el-input
              v-model="form.api_key"
              type="password"
              :placeholder="form.provider === 'jimeng_ai_api' ? $t('aiConfigContent.phApiKeyJimeng') : $t('aiConfigContent.phApiKeyGeneral')"
              show-password
            />
          </el-form-item>
          <el-form-item>
            <template #label><span class="form-label-tip">{{ $t('aiConfigContent.labelDefaultModel') }}</span></template>
            <el-select v-model="form.default_model" clearable style="width: 100%">
              <el-option v-for="m in formModelList" :key="m" :label="m" :value="m" />
            </el-select>
            <p class="field-tip">{{ $t('aiConfigContent.fieldTipDefaultModel') }}</p>
          </el-form-item>
          <el-form-item>
            <template #label>
              <span class="form-label-tip">{{ $t('aiConfigContent.labelSetDefault') }}
                <el-tooltip placement="top" popper-class="cfg-tip-popper">
                  <template #content>
                    <div class="cfg-tip-content" v-html="$t('aiConfigContent.tipDefaultModelLock')"></div>
                  </template>
                  <el-icon class="tip-icon"><QuestionFilled /></el-icon>
                </el-tooltip>
              </span>
            </template>
            <el-switch v-model="form.is_default" />
          </el-form-item>
        </el-form>
      </template>

      <!-- 普通模式：完整表单 -->
      <el-form v-else ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item prop="service_type">
          <template #label>
            <span class="form-label-tip">{{ $t('aiConfigContent.labelServiceType') }}
              <el-tooltip placement="top" :show-arrow="true" popper-class="cfg-tip-popper">
                <template #content>
                  <div class="cfg-tip-content" v-html="$t('aiConfigContent.tipServiceType')"></div>
                </template>
                <el-icon class="tip-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-select v-model="form.service_type" :placeholder="$t('aiConfigContent.phSelectType')" style="width: 100%" @change="onServiceTypeChange">
            <el-option :label="$t('aiConfigContent.stText')" value="text" />
            <el-option :label="$t('aiConfigContent.stImage')" value="image" />
            <el-option :label="$t('aiConfigContent.stStoryboardImage')" value="storyboard_image" />
            <el-option :label="$t('aiConfigContent.stVideo')" value="video" />
            <el-option :label="$t('aiConfigContent.stTts')" value="tts" />
            <el-option :label="$t('aiConfigContent.stJimeng2Auth')" value="jimeng2_character_auth" />
          </el-select>
        </el-form-item>
        <el-form-item prop="provider">
          <template #label>
            <span class="form-label-tip">{{ $t('aiConfigContent.labelVendor') }}
              <el-tooltip placement="top" popper-class="cfg-tip-popper">
                <template #content>
                  <div class="cfg-tip-content" v-html="$t('aiConfigContent.tipVendor')"></div>
                </template>
                <el-icon class="tip-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-select
            v-model="form.provider"
            :placeholder="$t('aiConfigContent.phSelectProvider')"
            clearable
            filterable
            allow-create
            default-first-option
            style="width: 100%"
            @change="onProviderChange"
          >
            <el-option
              v-for="p in availableProviderOptions"
              :key="p.id"
              :label="p.name"
              :value="p.id"
              :class="p.id === '__custom__' ? 'provider-custom-option' : ''"
            />
          </el-select>
        </el-form-item>
        <!-- 接口规范：仅图片/分镜/视频类型显示，预设厂商自动填充；自定义厂商必选 -->
        <el-form-item v-if="form.service_type !== 'text' && form.service_type !== 'tts' && form.service_type !== 'jimeng2_character_auth'">
          <template #label>
            <span class="form-label-tip">{{ $t('aiConfigContent.labelProtocol') }}
              <el-icon class="tip-icon" style="cursor:pointer;color:#409eff" @click="showProtocolHelp = true"><QuestionFilled /></el-icon>
            </span>
          </template>
          <el-select v-model="form.api_protocol" style="width: 100%" :placeholder="$t('aiConfigContent.phSelectProtocol')" clearable>
            <el-option :label="$t('aiConfigContent.protoOpenai')" value="openai" />
            <el-option :label="$t('aiConfigContent.protoDashscope')" value="dashscope" />
            <el-option label="MiniMax（海螺）" value="minimax" />
            <!-- 以下协议对应厂商已下线，仅保留以便历史配置可正常显示/回滚 -->
            <el-option :label="$t('aiConfigContent.protoVolcengine')" value="volcengine" />
            <el-option :label="$t('aiConfigContent.protoVolcengineOmni')" value="volcengine_omni" />
            <el-option :label="$t('aiConfigContent.protoGemini')" value="gemini" />
            <el-option :label="$t('aiConfigContent.protoSora')" value="sora" />
            <el-option :label="$t('aiConfigContent.protoVeo3')" value="veo3" />
            <el-option :label="$t('aiConfigContent.protoVidu')" value="vidu" />
            <el-option :label="$t('aiConfigContent.protoKlingOmni')" value="kling_omni" />
            <el-option :label="$t('aiConfigContent.protoXai')" value="xai" />
            <el-option :label="$t('aiConfigContent.protoNanoBanana')" value="nano_banana" />
          </el-select>
        </el-form-item>

        <!-- 接口规范帮助 Dialog -->
        <el-dialog v-model="showProtocolHelp" :title="$t('aiConfigContent.protocolHelpTitle')" width="700px" top="5vh">
          <div class="protocol-help">
            <div class="ph-section-title">{{ $t('aiConfigContent.protocolImgTitle') }}</div>
            <el-collapse accordion>
              <el-collapse-item name="openai-img">
                <template #title><span class="ph-tag ph-tag-img">{{ $t('aiConfigContent.protoTagImg') }}</span> {{ $t('aiConfigContent.phOpenaiImgTitle') }}</template>
                <div class="ph-body" v-html="$t('aiConfigContent.phOpenaiImgBody')"></div>
              </el-collapse-item>
              <el-collapse-item name="volcengine-img">
                <template #title><span class="ph-tag ph-tag-img">{{ $t('aiConfigContent.protoTagImg') }}</span> {{ $t('aiConfigContent.phVolcengineImgTitle') }}</template>
                <div class="ph-body" v-html="$t('aiConfigContent.phVolcengineImgBody')"></div>
              </el-collapse-item>
              <el-collapse-item name="dashscope-img">
                <template #title><span class="ph-tag ph-tag-img">{{ $t('aiConfigContent.protoTagImg') }}</span> {{ $t('aiConfigContent.phDashscopeImgTitle') }}</template>
                <div class="ph-body" v-html="$t('aiConfigContent.phDashscopeImgBody')"></div>
              </el-collapse-item>
              <el-collapse-item name="gemini-img">
                <template #title><span class="ph-tag ph-tag-img">{{ $t('aiConfigContent.protoTagImg') }}</span> {{ $t('aiConfigContent.phGeminiImgTitle') }}</template>
                <div class="ph-body" v-html="$t('aiConfigContent.phGeminiImgBody')"></div>
              </el-collapse-item>
            </el-collapse>

            <div class="ph-section-title" style="margin-top:16px">{{ $t('aiConfigContent.protocolVidTitle') }}</div>
            <el-collapse accordion>
              <el-collapse-item name="openai-vid">
                <template #title><span class="ph-tag ph-tag-vid">{{ $t('aiConfigContent.protoTagVid') }}</span> {{ $t('aiConfigContent.phOpenaiVidTitle') }}</template>
                <div class="ph-body" v-html="$t('aiConfigContent.phOpenaiVidBody')"></div>
              </el-collapse-item>
              <el-collapse-item name="sora-vid">
                <template #title><span class="ph-tag ph-tag-vid">{{ $t('aiConfigContent.protoTagVid') }}</span> {{ $t('aiConfigContent.phSoraVidTitle') }}</template>
                <div class="ph-body" v-html="$t('aiConfigContent.phSoraVidBody')"></div>
              </el-collapse-item>
              <el-collapse-item name="veo3-vid">
                <template #title><span class="ph-tag ph-tag-vid">{{ $t('aiConfigContent.protoTagVid') }}</span> {{ $t('aiConfigContent.phVeo3VidTitle') }}</template>
                <div class="ph-body" v-html="$t('aiConfigContent.phVeo3VidBody')"></div>
              </el-collapse-item>
              <el-collapse-item name="volcengine-vid">
                <template #title><span class="ph-tag ph-tag-vid">{{ $t('aiConfigContent.protoTagVid') }}</span> {{ $t('aiConfigContent.phVolcengineVidTitle') }}</template>
                <div class="ph-body" v-html="$t('aiConfigContent.phVolcengineVidBody')"></div>
              </el-collapse-item>
              <el-collapse-item name="volcengine-omni-vid">
                <template #title><span class="ph-tag ph-tag-vid">{{ $t('aiConfigContent.protoTagVid') }}</span> {{ $t('aiConfigContent.phVolcengineOmniVidTitle') }}</template>
                <div class="ph-body" v-html="$t('aiConfigContent.phVolcengineOmniVidBody')"></div>
              </el-collapse-item>
              <el-collapse-item name="dashscope-vid">
                <template #title><span class="ph-tag ph-tag-vid">{{ $t('aiConfigContent.protoTagVid') }}</span> {{ $t('aiConfigContent.phDashscopeVidTitle') }}</template>
                <div class="ph-body" v-html="$t('aiConfigContent.phDashscopeVidBody')"></div>
              </el-collapse-item>
              <el-collapse-item name="gemini-vid">
                <template #title><span class="ph-tag ph-tag-vid">{{ $t('aiConfigContent.protoTagVid') }}</span> {{ $t('aiConfigContent.phGeminiVidTitle') }}</template>
                <div class="ph-body" v-html="$t('aiConfigContent.phGeminiVidBody')"></div>
              </el-collapse-item>
              <el-collapse-item name="vidu-vid">
                <template #title><span class="ph-tag ph-tag-vid">{{ $t('aiConfigContent.protoTagVid') }}</span> {{ $t('aiConfigContent.phViduVidTitle') }}</template>
                <div class="ph-body" v-html="$t('aiConfigContent.phViduVidBody')"></div>
              </el-collapse-item>
              <el-collapse-item name="jimeng-ai-api-vid">
                <template #title><span class="ph-tag ph-tag-vid">{{ $t('aiConfigContent.protoTagVid') }}</span> {{ $t('aiConfigContent.phJimengAiApiVidTitle') }}</template>
                <div class="ph-body" v-html="$t('aiConfigContent.phJimengAiApiVidBody')"></div>
              </el-collapse-item>
            </el-collapse>
          </div>
          <template #footer>
            <el-button @click="showProtocolHelp = false">{{ $t('aiConfigContent.closeBtn') }}</el-button>
          </template>
        </el-dialog>
        <el-form-item prop="name">
          <template #label>
            <span class="form-label-tip">{{ $t('aiConfigContent.labelName') }}
              <el-tooltip :content="$t('aiConfigContent.tipName')" placement="top" popper-class="cfg-tip-popper">
                <el-icon class="tip-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-input v-model="form.name" :placeholder="$t('aiConfigContent.phName')" />
        </el-form-item>
        <el-form-item prop="base_url">
          <template #label>
            <span class="form-label-tip">{{ form.service_type === 'jimeng2_character_auth' ? $t('aiConfigContent.labelGatewayUrl') : 'Base URL' }}
              <el-tooltip placement="top" popper-class="cfg-tip-popper">
                <template #content>
                  <div class="cfg-tip-content">
                    <template v-if="form.service_type === 'jimeng2_character_auth'">
                      <span v-html="$t('aiConfigContent.tipGatewayUrl')"></span>
                    </template>
                    <template v-else>
                      <span v-html="$t('aiConfigContent.tipBaseUrl')"></span>
                    </template>
                  </div>
                </template>
                <el-icon class="tip-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-input
            v-model="form.base_url"
            :placeholder="form.service_type === 'jimeng2_character_auth' ? $t('aiConfigContent.phGatewayUrl') : $t('aiConfigContent.phBaseUrlAuto')"
          />
        </el-form-item>
        <el-form-item prop="api_key">
          <template #label>
            <span class="form-label-tip">{{ form.service_type === 'jimeng2_character_auth' ? $t('aiConfigContent.labelToken') : $t('aiConfigContent.labelApiKey') }}
              <el-tooltip placement="top" popper-class="cfg-tip-popper">
                <template #content>
                  <div class="cfg-tip-content">
                    <template v-if="form.service_type === 'jimeng2_character_auth'">
                      <span v-html="$t('aiConfigContent.tipToken')"></span>
                    </template>
                    <template v-else>
                      <span v-html="$t('aiConfigContent.tipApiKey')"></span>
                    </template>
                  </div>
                </template>
                <el-icon class="tip-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-input
            v-model="form.api_key"
            type="password"
            :placeholder="form.service_type === 'jimeng2_character_auth' ? $t('aiConfigContent.phBearerToken') : (form.provider === 'jimeng_ai_api' ? $t('aiConfigContent.phApiKeyJimeng') : $t('aiConfigContent.phApiKeyPlain'))"
            show-password
          />
        </el-form-item>
        <el-form-item v-if="form.service_type === 'jimeng2_character_auth'">
          <template #label><span class="form-label-tip">{{ $t('aiConfigContent.labelMaterialList') }}</span></template>
          <div class="jimeng2-assets-actions">
            <el-button type="primary" plain :loading="jimeng2AssetsLoading" @click="openJimeng2MaterialAssetsDialog">
              {{ $t('aiConfigContent.listAssetsBtn') }}
            </el-button>
            <span class="field-tip jimeng2-assets-tip" v-html="$t('aiConfigContent.fieldTipListAssets')"></span>
          </div>
        </el-form-item>
        <el-alert
          v-if="form.service_type === 'jimeng2_character_auth'"
          type="info"
          :closable="false"
          show-icon
          style="margin-bottom: 12px"
          :title="$t('aiConfigContent.jimeng2AlertTitle')"
          :description="$t('aiConfigContent.jimeng2AlertDesc')"
        />
        <template v-if="form.service_type === 'video' && form.api_protocol === 'kling_omni'">
          <el-form-item>
            <template #label><span class="form-label-tip">{{ $t('aiConfigContent.labelAccessKey') }}</span></template>
            <el-input
              v-model="form.kling_access_key"
              type="password"
              show-password
              :placeholder="$t('aiConfigContent.phKlingAccessKey')"
              autocomplete="off"
            />
            <p class="field-tip" v-html="$t('aiConfigContent.fieldTipKlingAccessKey')"></p>
          </el-form-item>
          <el-form-item>
            <template #label><span class="form-label-tip">{{ $t('aiConfigContent.labelSecretKey') }}</span></template>
            <el-input
              v-model="form.kling_secret_key"
              type="password"
              show-password
              :placeholder="$t('aiConfigContent.phKlingSecretKey')"
              autocomplete="off"
            />
            <el-checkbox v-model="form.kling_secret_key_base64" style="margin-top: 8px; display: block">
              {{ $t('aiConfigContent.klingBase64Checkbox') }}
            </el-checkbox>
            <p class="field-tip" v-html="$t('aiConfigContent.fieldTipKlingSecretKey')"></p>
          </el-form-item>
        </template>
        <!-- TTS 专属字段：声音 ID 和 MiniMax Group ID -->
        <template v-if="form.service_type === 'tts'">
          <el-form-item>
            <template #label>
              <span class="form-label-tip">{{ $t('aiConfigContent.labelVoiceId') }}
                <el-tooltip placement="top" popper-class="cfg-tip-popper">
                  <template #content>
                    <div class="cfg-tip-content" v-html="$t('aiConfigContent.tipVoiceId')"></div>
                  </template>
                  <el-icon class="tip-icon"><QuestionFilled /></el-icon>
                </el-tooltip>
              </span>
            </template>
            <el-select
              v-model="form.voice_id"
              filterable
              allow-create
              default-first-option
              :placeholder="$t('aiConfigContent.phVoiceId')"
              style="width: 100%"
            >
              <el-option-group :label="$t('aiConfigContent.voiceGroupFemale')">
                <el-option :label="$t('aiConfigContent.voiceFemaleShaonv')" value="female-shaonv" />
                <el-option :label="$t('aiConfigContent.voiceFemaleChengshu')" value="female-chengshu" />
                <el-option :label="$t('aiConfigContent.voiceFemaleTianmei')" value="female-tianmei" />
                <el-option :label="$t('aiConfigContent.voiceAudiobookFemale2')" value="audiobook_female_2" />
              </el-option-group>
              <el-option-group :label="$t('aiConfigContent.voiceGroupMale')">
                <el-option :label="$t('aiConfigContent.voiceMaleQingxin')" value="male-qingxin" />
                <el-option :label="$t('aiConfigContent.voiceMaleZhicheng')" value="male-zhicheng" />
                <el-option :label="$t('aiConfigContent.voiceAudiobookMale1')" value="audiobook_male_1" />
              </el-option-group>
            </el-select>
            <p class="field-tip">{{ $t('aiConfigContent.fieldTipVoiceId') }}</p>
          </el-form-item>
          <el-form-item>
            <template #label>
              <span class="form-label-tip">{{ $t('aiConfigContent.labelGroupId') }}
                <el-tooltip placement="top" popper-class="cfg-tip-popper">
                  <template #content>
                    <div class="cfg-tip-content" v-html="$t('aiConfigContent.tipGroupId')"></div>
                  </template>
                  <el-icon class="tip-icon"><QuestionFilled /></el-icon>
                </el-tooltip>
              </span>
            </template>
            <el-input v-model="form.group_id" :placeholder="$t('aiConfigContent.phGroupId')" />
            <p class="field-tip">{{ $t('aiConfigContent.fieldTipGroupId') }}</p>
          </el-form-item>
        </template>

        <!-- 端点配置：视频必填（自定义厂商）；图片/分镜在使用代理或特殊厂商时填写 -->
        <template v-if="form.service_type !== 'text' && form.service_type !== 'tts' && form.service_type !== 'jimeng2_character_auth'">
          <el-form-item>
            <template #label>
              <span class="form-label-tip">{{ $t('aiConfigContent.labelSubmitEndpoint') }}
                <el-tooltip placement="top" popper-class="cfg-tip-popper">
                  <template #content>
                    <div class="cfg-tip-content" v-html="$t('aiConfigContent.tipSubmitEndpoint')"></div>
                  </template>
                  <el-icon class="tip-icon"><QuestionFilled /></el-icon>
                </el-tooltip>
              </span>
            </template>
            <el-input v-model="form.endpoint" :placeholder="form.service_type === 'video' ? $t('aiConfigContent.phEndpointVideo') : $t('aiConfigContent.phEndpointImage')" />
          </el-form-item>
          <el-form-item>
            <template #label>
              <span class="form-label-tip">{{ $t('aiConfigContent.labelQueryEndpoint') }}
                <el-tooltip placement="top" popper-class="cfg-tip-popper">
                  <template #content>
                    <div class="cfg-tip-content" v-html="$t('aiConfigContent.tipQueryEndpoint')"></div>
                  </template>
                  <el-icon class="tip-icon"><QuestionFilled /></el-icon>
                </el-tooltip>
              </span>
            </template>
            <el-input v-model="form.query_endpoint" :placeholder="$t('aiConfigContent.phQueryEndpoint')" />
          </el-form-item>
        </template>

        <!-- 接口地址预览：选择厂商/协议后自动展示，帮助用户核对 -->
        <div v-if="endpointPreviewInfo" class="endpoint-preview-box" :class="{ 'ep-box-gemini': endpointPreviewInfo.isGemini }">
          <div class="ep-preview-header">
            <span>{{ $t('aiConfigContent.epHeader') }}</span>
            <span v-if="endpointPreviewInfo.isGemini" class="ep-auto-badge ep-badge-gemini">{{ $t('aiConfigContent.epBadgeGemini') }}</span>
            <span v-else-if="endpointPreviewInfo.isJimeng2Auth" class="ep-auto-badge">{{ $t('aiConfigContent.epBadgeJimeng2') }}</span>
            <span v-else-if="endpointPreviewInfo.isAuto && form.service_type !== 'text'" class="ep-auto-badge">{{ $t('aiConfigContent.epBadgeAuto') }}</span>
          </div>
          <div class="ep-row">
            <span class="ep-label">{{ $t('aiConfigContent.epSubmitLabel') }}</span>
            <code class="ep-url">{{ endpointPreviewInfo.submit }}</code>
          </div>
          <div v-if="endpointPreviewInfo.query" class="ep-row">
            <span class="ep-label">{{ $t('aiConfigContent.epQueryLabel') }}</span>
            <code class="ep-url">{{ endpointPreviewInfo.query }}</code>
          </div>
          <p v-if="endpointPreviewInfo.isGemini" class="ep-tip ep-tip-warn">
            {{ $t('aiConfigContent.epTipGemini') }}
          </p>
          <p v-else-if="endpointPreviewInfo.isJimeng2Auth" class="ep-tip">{{ $t('aiConfigContent.epTipJimeng2') }}</p>
          <p v-else class="ep-tip">{{ $t('aiConfigContent.epTipAuto') }}</p>
        </div>

        <template v-if="form.service_type !== 'jimeng2_character_auth'">
        <el-form-item>
          <template #label>
            <span class="form-label-tip">{{ $t('aiConfigContent.labelModelList') }}
              <el-tooltip placement="top" popper-class="cfg-tip-popper">
                <template #content>
                  <div class="cfg-tip-content" v-html="$t('aiConfigContent.tipModelList')"></div>
                </template>
                <el-icon class="tip-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </span>
          </template>
          <div class="model-row">
            <el-select
              v-model="presetModelPick"
              :placeholder="$t('aiConfigContent.phPresetModel')"
              clearable
              filterable
              style="width: 220px; margin-bottom: 8px"
              @change="onPresetModelSelect"
            >
              <el-option v-for="m in availableModels" :key="m" :label="m" :value="m" />
            </el-select>
          </div>
          <el-input v-model="form.modelText" type="textarea" :rows="2" :placeholder="$t('aiConfigContent.phModelText')" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <span class="form-label-tip">{{ $t('aiConfigContent.labelDefaultModel') }}
              <el-tooltip :content="$t('aiConfigContent.tipDefaultModel')" placement="top" popper-class="cfg-tip-popper">
                <el-icon class="tip-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-select
            v-model="form.default_model"
            :placeholder="formModelList.length ? $t('aiConfigContent.phDefaultModelFromList') : $t('aiConfigContent.phDefaultModelEmpty')"
            clearable
            style="width: 100%"
          >
            <el-option v-for="m in formModelList" :key="m" :label="m" :value="m" />
          </el-select>
          <p class="field-tip">{{ $t('aiConfigContent.fieldTipDefaultModelUsage') }}</p>
        </el-form-item>
        <el-form-item v-if="isDeepSeekOfficialForm">
          <template #label>
            <span class="form-label-tip">{{ $t('aiConfigContent.labelThinkingMode') }}
              <el-tooltip placement="top" popper-class="cfg-tip-popper">
                <template #content>
                  <div class="cfg-tip-content" v-html="$t('aiConfigContent.tipThinkingMode')"></div>
                </template>
                <el-icon class="tip-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </span>
          </template>
          <div class="deepseek-settings">
            <el-radio-group v-model="form.deepseek_thinking">
              <el-radio-button label="disabled">{{ $t('aiConfigContent.thinkingDisabled') }}</el-radio-button>
              <el-radio-button label="enabled">{{ $t('aiConfigContent.thinkingEnabled') }}</el-radio-button>
            </el-radio-group>
            <el-select
              v-if="form.deepseek_thinking === 'enabled'"
              v-model="form.deepseek_reasoning_effort"
              style="width: 140px"
            >
              <el-option label="high" value="high" />
              <el-option label="max" value="max" />
            </el-select>
          </div>
          <p class="field-tip">{{ $t('aiConfigContent.fieldTipDeepseekDeprecation') }}</p>
        </el-form-item>
        </template>
        <el-form-item>
          <template #label>
            <span class="form-label-tip">{{ $t('aiConfigContent.labelPriority') }}
              <el-tooltip :content="$t('aiConfigContent.tipPriority')" placement="top" popper-class="cfg-tip-popper">
                <el-icon class="tip-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-input-number v-model="form.priority" :min="0" :max="999" />
        </el-form-item>
        <el-form-item>
          <template #label>
            <span class="form-label-tip">{{ $t('aiConfigContent.labelSetDefault') }}
              <el-tooltip placement="top" popper-class="cfg-tip-popper">
                <template #content>
                  <div class="cfg-tip-content" v-html="$t('aiConfigContent.tipDefaultModelLock')"></div>
                </template>
                <el-icon class="tip-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-switch v-model="form.is_default" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ $t('aiConfigContent.cancelBtn') }}</el-button>
        <el-button type="primary" :loading="saving" @click="submit">{{ $t('aiConfigContent.confirmBtn') }}</el-button>
      </template>
    </el-dialog>

    <!-- 一键配置通义 -->
    <el-dialog
      v-model="oneKeyTongyiVisible"
      :title="$t('aiConfigContent.oneKeyTongyiTitle')"
      width="520px"
      :close-on-click-modal="false"
      @closed="oneKeyTongyiKey = ''"
    >
      <div class="one-key-help">
        <div class="one-key-section">
          <div class="one-key-section-title">{{ $t('aiConfigContent.oneKeyWillCreate') }}</div>
          <ul class="one-key-list">
            <li v-html="$t('aiConfigContent.oneKeyTongyiItem1')"></li>
            <li v-html="$t('aiConfigContent.oneKeyTongyiItem2')"></li>
            <li v-html="$t('aiConfigContent.oneKeyTongyiItem3')"></li>
            <li v-html="$t('aiConfigContent.oneKeyTongyiItem4')"></li>
            <li v-html="$t('aiConfigContent.oneKeyTongyiItem5')"></li>
          </ul>
        </div>
        <div class="one-key-section">
          <div class="one-key-section-title">{{ $t('aiConfigContent.oneKeyHowToApply') }}</div>
          <ol class="one-key-list">
            <li v-html="$t('aiConfigContent.oneKeyTongyiStep1')"></li>
            <li>{{ $t('aiConfigContent.oneKeyTongyiStep2') }}</li>
            <li>{{ $t('aiConfigContent.oneKeyTongyiStep3') }}</li>
            <li v-html="$t('aiConfigContent.oneKeyTongyiStep4')"></li>
          </ol>
          <p class="one-key-note">{{ $t('aiConfigContent.oneKeyTongyiNote') }}</p>
        </div>
      </div>
      <el-form label-width="0" style="margin-top: 8px">
        <el-form-item>
          <el-input
            v-model="oneKeyTongyiKey"
            type="password"
            :placeholder="$t('aiConfigContent.phTongyiKey')"
            show-password-on="click"
            clearable
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="oneKeyTongyiVisible = false">{{ $t('aiConfigContent.cancelBtn') }}</el-button>
        <el-button type="success" :loading="oneKeyTongyiSaving" :disabled="!oneKeyTongyiKey.trim()" @click="submitOneKeyTongyi">
          {{ $t('aiConfigContent.oneKeyConfirm') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 一键配置火山 -->
    <el-dialog
      v-model="oneKeyVolcVisible"
      :title="$t('aiConfigContent.oneKeyVolcTitle')"
      width="520px"
      :close-on-click-modal="false"
      @closed="oneKeyVolcKey = ''"
    >
      <div class="one-key-help">
        <div class="one-key-section">
          <div class="one-key-section-title">{{ $t('aiConfigContent.oneKeyWillCreate') }}</div>
          <ul class="one-key-list">
            <li v-html="$t('aiConfigContent.oneKeyVolcItem1')"></li>
            <li v-html="$t('aiConfigContent.oneKeyVolcItem2')"></li>
            <li v-html="$t('aiConfigContent.oneKeyVolcItem3')"></li>
            <li v-html="$t('aiConfigContent.oneKeyVolcItem4')"></li>
          </ul>
        </div>
        <div class="one-key-section">
          <div class="one-key-section-title">{{ $t('aiConfigContent.oneKeyHowToApply') }}</div>
          <ol class="one-key-list">
            <li v-html="$t('aiConfigContent.oneKeyVolcStep1')"></li>
            <li>{{ $t('aiConfigContent.oneKeyVolcStep2') }}</li>
            <li>{{ $t('aiConfigContent.oneKeyVolcStep3') }}</li>
            <li>{{ $t('aiConfigContent.oneKeyVolcStep4') }}</li>
          </ol>
          <p class="one-key-note">{{ $t('aiConfigContent.oneKeyVolcNote1') }}</p>
          <p class="one-key-note">{{ $t('aiConfigContent.oneKeyVolcNote2') }}</p>
        </div>
      </div>
      <el-form label-width="0" style="margin-top: 8px">
        <el-form-item>
          <el-input
            v-model="oneKeyVolcKey"
            type="password"
            :placeholder="$t('aiConfigContent.phVolcKey')"
            show-password-on="click"
            clearable
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="oneKeyVolcVisible = false">{{ $t('aiConfigContent.cancelBtn') }}</el-button>
        <el-button type="success" :loading="oneKeyVolcSaving" :disabled="!oneKeyVolcKey.trim()" @click="submitOneKeyVolc">
          {{ $t('aiConfigContent.oneKeyConfirm') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 即梦2角色认证：素材列表 -->
    <el-dialog
      v-model="jimeng2AssetsDialogVisible"
      :title="$t('aiConfigContent.jimeng2AssetsTitle')"
      width="720px"
      class="jimeng2-assets-dialog"
      destroy-on-close
      @closed="onJimeng2AssetsDialogClosed"
    >
      <p class="field-tip" style="margin-top: 0" v-html="$t('aiConfigContent.jimeng2AssetsDoc')"></p>
      <el-table v-loading="jimeng2AssetsLoading" :data="jimeng2AssetsRows" stripe max-height="420" :empty-text="$t('aiConfigContent.jimeng2AssetsEmpty')">
        <el-table-column prop="id" :label="$t('aiConfigContent.colAssetId')" min-width="120" show-overflow-tooltip />
        <el-table-column prop="name" :label="$t('aiConfigContent.colName')" width="100" show-overflow-tooltip />
        <el-table-column prop="asset_type" :label="$t('aiConfigContent.colType')" width="88" />
        <el-table-column prop="status" :label="$t('aiConfigContent.colStatus')" width="96">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : row.status === 'failed' ? 'danger' : 'info'" size="small">
              {{ row.status || '—' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="asset_url" label="asset_url" min-width="160" show-overflow-tooltip />
        <el-table-column prop="url" :label="$t('aiConfigContent.colAssetUrl')" min-width="120" show-overflow-tooltip />
        <el-table-column prop="created_at" :label="$t('aiConfigContent.colCreatedAt')" width="160" show-overflow-tooltip />
      </el-table>
      <div v-if="jimeng2AssetsHasMore" style="margin-top: 12px; text-align: center">
        <el-button :loading="jimeng2AssetsLoading" @click="loadMoreJimeng2MaterialAssets">{{ $t('aiConfigContent.loadMore') }}</el-button>
      </div>
      <template #footer>
        <el-button @click="jimeng2AssetsDialogVisible = false">{{ $t('aiConfigContent.closeBtn') }}</el-button>
      </template>
    </el-dialog>

    <!-- 测试连接 -->
    <el-dialog v-model="testVisible" :title="$t('aiConfigContent.testTitle')" width="420px">
      <p v-if="testResult === null">{{ $t('aiConfigContent.testing') }}</p>
      <template v-else-if="testResult">
        <el-alert
          v-if="testServiceType === 'image' || testServiceType === 'storyboard_image' || testServiceType === 'video'"
          type="success"
          :title="$t('aiConfigContent.testSuccessTitle')"
          :description="$t('aiConfigContent.testSuccessDescMedia')"
          show-icon
          :closable="false"
        />
        <el-alert
          v-else
          type="success"
          :title="$t('aiConfigContent.testSuccessTitle')"
          :description="$t('aiConfigContent.testSuccessDescText')"
          show-icon
          :closable="false"
        />
      </template>
      <el-alert v-else type="error" :title="testError || $t('aiConfigContent.testFailTitle')" show-icon :closable="false" />
      <template #footer>
        <el-button @click="testVisible = false">{{ $t('aiConfigContent.closeBtn') }}</el-button>
      </template>
    </el-dialog>

    <!-- 一键换Key（锁定模式） -->
    <el-dialog v-model="bulkKeyVisible" :title="$t('aiConfigContent.bulkKeyTitle')" width="440px" :close-on-click-modal="false">
      <el-alert
        type="warning"
        :closable="false"
        style="margin-bottom: 16px"
        :title="$t('aiConfigContent.bulkKeyAlert')"
        show-icon
      />
      <el-form label-width="80px">
        <el-form-item :label="$t('aiConfigContent.labelNewApiKey')">
          <el-input
            v-model="bulkKeyInput"
            type="password"
            show-password
            :placeholder="$t('aiConfigContent.phBulkKey')"
            clearable
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bulkKeyVisible = false">{{ $t('aiConfigContent.cancelBtn') }}</el-button>
        <el-button type="primary" :loading="bulkKeySaving" :disabled="!bulkKeyInput.trim()" @click="submitBulkKey">{{ $t('aiConfigContent.bulkKeyConfirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, MagicStick, QuestionFilled, Download, Upload, Delete, ChatDotRound, Picture, Film, VideoCamera, Key, Microphone } from '@element-plus/icons-vue'
import { aiAPI } from '@/api/ai'
import { generationSettingsAPI } from '@/api/prompts'
import PromptEditor from '@/components/PromptEditor.vue'
import SceneModelMap from '@/components/SceneModelMap.vue'
import Sd2AssetManagement from '@/components/Sd2AssetManagement.vue'

const { t } = useI18n()

const activeTab = ref('configs')
const importFileRef = ref(null)

// ---- 生成设置 ----
const genConcurrencyInput = ref(3)
const genVideoConcurrencyInput = ref(3)
const genSettingSaving = ref(false)
const genSettingSaved = ref(false)

async function loadGenerationSettings() {
  try {
    const res = await generationSettingsAPI.get()
    genConcurrencyInput.value = res?.concurrency ?? 3
    genVideoConcurrencyInput.value = res?.video_concurrency ?? 3
  } catch (_) {}
}

function onConcurrencyChange(val) {
  const n = Number(val)
  if (!isNaN(n) && n >= 1) genConcurrencyInput.value = Math.min(20, Math.max(1, Math.round(n)))
}

function onVideoConcurrencyChange(val) {
  const n = Number(val)
  if (!isNaN(n) && n >= 1) genVideoConcurrencyInput.value = Math.min(20, Math.max(1, Math.round(n)))
}

async function saveGenerationSettings() {
  const n = Number(genConcurrencyInput.value)
  const nv = Number(genVideoConcurrencyInput.value)
  if (isNaN(n) || n < 1 || n > 20) {
    ElMessage.warning(t('aiConfigContent.msgImageConcurrencyRange'))
    return
  }
  if (isNaN(nv) || nv < 1 || nv > 20) {
    ElMessage.warning(t('aiConfigContent.msgVideoConcurrencyRange'))
    return
  }
  genSettingSaving.value = true
  genSettingSaved.value = false
  try {
    await generationSettingsAPI.update({ concurrency: Math.round(n), video_concurrency: Math.round(nv) })
    genSettingSaved.value = true
    setTimeout(() => { genSettingSaved.value = false }, 2000)
  } catch (e) {
    ElMessage.error(t('aiConfigContent.msgSaveFailed', { error: (e?.message || '') }))
  } finally {
    genSettingSaving.value = false
  }
}
const loading = ref(false)
const list = ref([])
const selectedRows = ref([])
const batchDeleting = ref(false)
const vendorLock = ref({ enabled: false, config_file: '' })
const dialogVisible = ref(false)
const editingId = ref(null)
const saving = ref(false)
const showProtocolHelp = ref(false)
const bulkKeyVisible = ref(false)
const bulkKeyInput = ref('')
const bulkKeySaving = ref(false)
const jimeng2AssetsDialogVisible = ref(false)
const jimeng2AssetsLoading = ref(false)
const jimeng2AssetsRows = ref([])
const jimeng2AssetsHasMore = ref(false)
const jimeng2AssetsNextCursor = ref(null)
const formRef = ref(null)
const form = ref({
  service_type: 'text',
  name: '',
  provider: '',
  api_protocol: '',
  base_url: '',
  api_key: '',
  endpoint: '',
  query_endpoint: '',
  modelText: '',
  default_model: '',
  deepseek_thinking: 'disabled',
  deepseek_reasoning_effort: 'high',
  priority: 0,
  is_default: false,
  // 可灵 Omni 官方 AK/SK（存 settings，后端生成 JWT）
  kling_access_key: '',
  kling_secret_key: '',
  kling_secret_key_base64: false,
  // TTS 专属字段
  voice_id: '',
  group_id: '',
})
const presetModelPick = ref('')

const formModelList = computed(() => parseModelText(form.value.modelText))

// 保证「生成时默认使用」下拉有可选且选中值在列表内，否则会不显示或修改无效
watch(
  () => [formModelList.value, form.value.default_model],
  () => {
    const list = formModelList.value
    if (list.length === 0) return
    const current = form.value.default_model
    if (!current || !list.includes(current)) {
      form.value.default_model = list[0] || ''
    }
  },
  { immediate: true }
)

function onServiceTypeChange() {
  const st = form.value.service_type || 'text'
  if (st === 'jimeng2_character_auth') {
    if (!form.value.provider || form.value.provider === CUSTOM_PROVIDER_SENTINEL) {
      form.value.provider = 'jimeng_material_api'
    }
    const p = form.value.provider
    const pcfg = (providerConfigs.value.jimeng2_character_auth || []).find((x) => x.id === p)
    if (pcfg) {
      if (!form.value.base_url?.trim()) form.value.base_url = getBaseUrlForProvider(p)
      form.value.modelText = '-'
      form.value.default_model = '-'
      form.value.endpoint = ''
      form.value.query_endpoint = ''
      form.value.api_protocol = ''
    }
    if (!editingId.value && !form.value.name?.trim()) {
      form.value.name = t('aiConfigContent.stlJimeng2Auth')
    }
    return
  }
  const listByType = providerConfigs.value[st] || []
  const current = form.value.provider
  if (!current || !listByType.some((p) => p.id === current)) {
    form.value.provider = ''
    form.value.base_url = ''
    form.value.modelText = ''
    form.value.default_model = ''
  }
}

function onPresetModelSelect(value) {
  if (!value) return
  const listParsed = parseModelText(form.value.modelText)
  if (listParsed.includes(value)) {
    presetModelPick.value = ''
    return
  }
  const append = listParsed.length ? '\n' + value : value
  form.value.modelText = (form.value.modelText || '').trim() + append
  presetModelPick.value = ''
}
const rules = computed(() => ({
  service_type: [{ required: true, message: t('aiConfigContent.validateServiceType'), trigger: 'change' }],
  name: [{ required: true, message: t('aiConfigContent.validateName'), trigger: 'blur' }],
  provider: [{ required: true, message: t('aiConfigContent.validateProvider'), trigger: 'change' }],
  base_url: [{ required: true, message: t('aiConfigContent.validateBaseUrl'), trigger: 'blur' }],
  api_key: [
    {
      validator: (_rule, v, cb) => {
        const st = form.value.service_type
        if (st === 'jimeng2_character_auth') {
          if (v != null && String(v).trim()) return cb()
          return cb(new Error(t('aiConfigContent.validateToken')))
        }
        const proto = form.value.api_protocol
        const ak = (form.value.kling_access_key || '').trim()
        const sk = (form.value.kling_secret_key || '').trim()
        if (st === 'video' && proto === 'kling_omni' && ak && sk) return cb()
        if (v != null && String(v).trim()) return cb()
        cb(new Error(t('aiConfigContent.validateApiKeyOrAkSk')))
      },
      trigger: 'blur',
    },
  ],
}))
const testVisible = ref(false)
const testResult = ref(null)
const testServiceType = ref('')
const testError = ref('')
const oneKeyTongyiVisible = ref(false)
const oneKeyTongyiKey = ref('')
const oneKeyTongyiSaving = ref(false)
const oneKeyVolcVisible = ref(false)
const oneKeyVolcKey = ref('')
const oneKeyVolcSaving = ref(false)

/** 预设厂商与模型（与参考前端一致） */
const providerConfigs = computed(() => ({
  text: [
    { id: 'openai', name: t('aiConfigContent.providerOpenai'), models: ['gpt-4o', 'gpt-4', 'gpt-3.5-turbo'] },
    { id: 'volcengine', name: t('aiConfigContent.providerVolcengine'), models: ['deepseek-v3-2-251201', 'doubao-1-5-pro-32k-250115', 'kimi-k2-thinking-251104'] },
    // { id: 'chatfire', name: 'Chatfire', models: ['gemini-3-flash-preview', 'claude-sonnet-4-5-20250929', 'doubao-seed-1-8-251228'] },
    { id: 'gemini', name: t('aiConfigContent.providerGemini'), models: ['gemini-2.5-pro', 'gemini-3-flash-preview'] },
    { id: 'deepseek', name: t('aiConfigContent.providerDeepseek'), models: ['deepseek-v4-flash', 'deepseek-v4-pro'] },
    { id: 'qwen', name: t('aiConfigContent.providerQwen'), models: ['qwen3-max', 'qwen-plus', 'qwen-flash'] },
    { id: 'agnes', name: t('aiConfigContent.providerAgnes'), models: ['agnes-3.0-flash', 'agnes-2.5-flash', 'agnes-2.0-flash'] }
  ],
  image: [
    { id: 'comfyui', name: t('aiConfigContent.providerComfyui'), models: ['wan2.1_fun_inp_1.3B_bf16.safetensors', 'wan2.1_t2v_14B_fp8_scaled.safetensors'] },
    { id: 'volcengine', name: t('aiConfigContent.providerVolcengine'), models: ['doubao-seedream-4-5-251128', 'doubao-seedream-4-0-250828'] },
    { id: 'kling', name: t('aiConfigContent.providerKling'), models: ['kling-image', 'kling-omni-image'] },
    { id: 'nano_banana', name: t('aiConfigContent.providerNanoBanana'), models: ['nano-banana-2', 'nano-banana-pro', 'nano-banana'] },
    // { id: 'chatfire', name: 'Chatfire', models: ['nano-banana-pro', 'doubao-seedream-4-5-251128', 'qwen-image'] },
    { id: 'gemini', name: t('aiConfigContent.providerGemini'), models: ['gemini-2.5-flash-image', 'gemini-2.5-flash-image-preview', 'gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview'] },
    { id: 'openai', name: t('aiConfigContent.providerOpenai'), models: ['dall-e-3', 'dall-e-2'] },
    { id: 'dashscope', name: t('aiConfigContent.providerDashscope'), models: ['wan2.6-image', 'qwen-image-edit-plus-2026-01-09', 'qwen-image-edit-plus', 'qwen-image-edit-max'] },
    { id: 'qwen_image', name: t('aiConfigContent.providerQwenImage'), models: ['qwen-image-max', 'qwen-image-plus', 'qwen-image'] },
    { id: 'agnes', name: t('aiConfigContent.providerAgnes'), models: ['agnes-image-2.5-flash', 'agnes-image-2.1-flash'] }
  ],
  storyboard_image: [
    { id: 'comfyui', name: t('aiConfigContent.providerComfyui'), models: ['wan2.1_fun_inp_1.3B_bf16.safetensors', 'wan2.1_t2v_14B_fp8_scaled.safetensors'] },
    { id: 'dashscope', name: t('aiConfigContent.providerDashscope'), models: ['wan2.6-image', 'qwen-image-edit-plus-2026-01-09', 'qwen-image-edit-plus', 'qwen-image-edit-max'] },
    { id: 'volcengine', name: t('aiConfigContent.providerVolcengine'), models: ['doubao-seedream-4-5-251128', 'doubao-seedream-4-0-250828'] },
    { id: 'kling', name: t('aiConfigContent.providerKling'), models: ['kling-image', 'kling-omni-image'] },
    { id: 'nano_banana', name: t('aiConfigContent.providerNanoBanana'), models: ['nano-banana-2', 'nano-banana-pro', 'nano-banana'] },
    // { id: 'chatfire', name: 'Chatfire', models: ['nano-banana-pro', 'doubao-seedream-4-5-251128', 'qwen-image'] },
    { id: 'gemini', name: t('aiConfigContent.providerGemini'), models: ['gemini-2.5-flash-image', 'gemini-2.5-flash-image-preview', 'gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview'] },
    { id: 'openai', name: t('aiConfigContent.providerOpenai'), models: ['dall-e-3', 'dall-e-2'] },
    { id: 'agnes', name: t('aiConfigContent.providerAgnes'), models: ['agnes-image-2.5-flash', 'agnes-image-2.1-flash'] }
  ],
  // 视频模型：仅保留 3 家主力（WAN 3.0 / MiniMax H3 / Agnes）。
  // 其余厂商（kling / vidu / volces-seedance / gemini-veo / sora / xai / jimeng / comfyui）
  // 已在产品侧收敛下线，后端适配器代码仍保留，未来如需恢复只需在此加回条目。
  video: [
    { id: 'dashscope', name: t('aiConfigContent.providerDashscopeVideo'), models: ['wan3.0-t2v', 'wan3.0-i2v', 'wan3.0-kf2v', 'wan3.0-r2v'] },
    { id: 'minimax', name: t('aiConfigContent.providerMinimax'), models: ['MiniMax-Hailuo-03', 'MiniMax-Hailuo-03-Fast'] },
    { id: 'agnes', name: t('aiConfigContent.providerAgnes'), models: ['agnes-video-2.5-flash', 'agnes-video-2.5'] },
  ],
  tts: [
    { id: 'minimax', name: t('aiConfigContent.providerMinimaxTts'), models: ['speech-02-hd', 'speech-02-turbo'] },
  ],
  jimeng2_character_auth: [
    { id: 'jimeng_material_api', name: t('aiConfigContent.providerJimengMaterial'), models: ['-'] },
  ],
}))

/** 厂商 id → 默认接口规范（api_protocol） */
const providerProtocolMap = {
  // image / storyboard_image / video
  comfyui: 'comfyui',
  // image / storyboard_image
  volcengine: 'volcengine',
  volces: 'volcengine',
  volc: 'volcengine',
  nano_banana: 'nano_banana',
  dashscope: 'dashscope',
  qwen_image: 'dashscope',
  gemini: 'gemini',
  google: 'gemini',
  kling: 'kling',
  ffir: 'kling_omni',
  klingai: 'kling_omni',
  // video
  vidu: 'vidu',
  xai: 'xai',
  grok: 'xai',
  minimax: 'minimax',
  openai: 'openai',
  chatfire: 'openai',
  qwen: 'openai',
  deepseek: 'openai',
  jimeng_ai_api: 'jimeng_ai_api',
  jimeng_material_api: '',
  agnes: 'agnes',
}

/** 厂商 id → 默认 Base URL（与参考前端 AIConfigDialog 757-775 一致） */
function getBaseUrlForProvider(provider) {
  if (!provider) return ''
  const p = String(provider).toLowerCase()
  if (p === 'gemini' || p === 'google') return 'https://generativelanguage.googleapis.com'
  if (p === 'minimax') return 'https://api.minimaxi.com/v1'
  if (p === 'volces' || p === 'volcengine') return 'https://ark.cn-beijing.volces.com/api/v3'
  if (p === 'openai') return 'https://api.openai.com/v1'
  if (p === 'deepseek') return 'https://api.deepseek.com'
  if (p === 'dashscope') return 'https://dashscope.aliyuncs.com'
  if (p === 'qwen_image') return 'https://dashscope.aliyuncs.com'
  if (p === 'qwen') return 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  if (p === 'nano_banana') return 'https://api.nanobananaapi.ai'
  if (p === 'vidu') return 'https://api.vidu.cn'
  if (p === 'kling') return 'https://api.klingai.com'
  if (p === 'klingai') return 'https://api-beijing.klingai.com'
  if (p === 'ffir') return 'https://ffir.cn'
  if (p === 'jimeng_ai_api') return 'http://127.0.0.1:8000'
  if (p === 'jimeng_material_api') return 'https://silvamux.tingyutech.com'
  if (p === 'xai' || p === 'grok') return 'https://api.x.ai'
  if (p === 'agnes') return 'https://api.agnes-ai.cn/v1'
  return 'https://api.chatfire.site/v1'
}

const CUSTOM_PROVIDER_SENTINEL = '__custom__'

function parseSettings(settings) {
  if (!settings) return {}
  if (typeof settings === 'object') return settings
  try {
    const parsed = JSON.parse(settings)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (_) {
    return {}
  }
}

function isDeepSeekOfficial(provider, baseUrl) {
  const p = String(provider || '').trim().toLowerCase()
  const base = String(baseUrl || '').trim().toLowerCase()
  return p === 'deepseek' || base.includes('api.deepseek.com')
}

function resolveDeepSeekFormSettings(row) {
  const s = parseSettings(row?.settings)
  const nested = s.deepseek && typeof s.deepseek === 'object' ? s.deepseek : {}
  let thinking = s.deepseek_thinking || s.thinking || nested.thinking || nested.type || ''
  const model = String(row?.default_model || '').toLowerCase()
  if (!thinking && model === 'deepseek-chat') thinking = 'disabled'
  if (!thinking && model === 'deepseek-reasoner') thinking = 'enabled'
  if (thinking !== 'enabled' && thinking !== 'disabled') thinking = 'disabled'

  let effort = s.deepseek_reasoning_effort || s.reasoning_effort || nested.reasoning_effort || nested.effort || 'high'
  effort = String(effort).toLowerCase() === 'max' ? 'max' : 'high'
  return { thinking, effort }
}

const isDeepSeekOfficialForm = computed(() => (
  form.value.service_type === 'text'
  && isDeepSeekOfficial(form.value.provider, form.value.base_url)
))

/** 当前服务类型下的预设厂商列表（编辑时若当前 provider 不在列表则补一项；末尾始终附一项自定义入口） */
const availableProviderOptions = computed(() => {
  const st = form.value.service_type || 'text'
  const listByType = providerConfigs.value[st] || []
  const current = form.value.provider
  let result = [...listByType]
  if (editingId.value && current && current !== CUSTOM_PROVIDER_SENTINEL && !listByType.some((p) => p.id === current)) {
    result = [{ id: current, name: t('aiConfigContent.providerCurrent', { name: current }), models: [] }, ...result]
  }
  result.push({ id: CUSTOM_PROVIDER_SENTINEL, name: t('aiConfigContent.providerCustom'), models: [] })
  return result
})

/** 当前厂商的预设模型列表（用于追加预设模型） */
const availableModels = computed(() => {
  const st = form.value.service_type
  const provider = form.value.provider
  if (!st || !provider) return []
  const p = (providerConfigs.value[st] || []).find((x) => x.id === provider)
  return p?.models || []
})

/** 根据当前厂商/协议/base_url 推算实际将使用的接口地址，供用户核对 */
const endpointPreviewInfo = computed(() => {
  const { provider, api_protocol, base_url, service_type, endpoint, query_endpoint } = form.value
  const p = String(provider || '').toLowerCase()
  const proto = api_protocol || providerProtocolMap[p] || ''
  const base = (base_url || '').replace(/\/$/, '')

  if (service_type === 'jimeng2_character_auth') {
    const root = base || t('aiConfigContent.epFillGateway')
    const hasReal = !root.startsWith('(')
    return {
      submit: `${root}/api/business/v1/assets`,
      query: hasReal ? `${root}/api/business/v1/assets/{assetId}` : null,
      isAuto: true,
      isJimeng2Auth: true,
    }
  }

  if (!base && !proto && !p) return null

  let submitPath = '', queryPath = ''

  if (service_type === 'text') {
    submitPath = '/chat/completions'
  } else if (service_type === 'tts') {
    if (p === 'minimax') {
      submitPath = '/t2a_v2?GroupId={group_id}'
    } else {
      submitPath = endpoint || '/tts'
    }
  } else if (service_type === 'image' || service_type === 'storyboard_image') {
    if (endpoint) {
      submitPath = endpoint
    } else if (proto === 'volcengine' || p === 'volcengine' || p === 'volces') {
      submitPath = '/images/generations'
    } else if (proto === 'dashscope' || p === 'dashscope' || p === 'qwen_image') {
      submitPath = '/api/v1/services/aigc/multimodal-generation/generation'
    } else if (proto === 'gemini' || p === 'gemini') {
      const m = form.value.default_model || t('aiConfigContent.epModelPlaceholder')
      submitPath = `/v1beta/models/${m}:generateContent?key=***`
      return { submit: base + submitPath, query: null, isAuto: true, isGemini: true }
    } else if (proto === 'nano_banana' || p === 'nano_banana') {
      submitPath = '/v1/images/generations'  // nano_banana base_url 无 /v1
    } else if (proto === 'kling' || p === 'kling' || p === 'klingai') {
      submitPath = '/v1/images/generations'
    } else {
      submitPath = '/images/generations'  // openai 兼容：base_url 已含 /v1
    }
    } else if (service_type === 'video') {
    if (endpoint) {
      submitPath = endpoint
    } else if (proto === 'volcengine_omni') {
      submitPath = '/contents/generations/tasks'
    } else if (proto === 'volcengine' || p === 'volces' || p === 'volcengine') {
      submitPath = '/videos/generations'
    } else if (proto === 'dashscope' || p === 'dashscope') {
      submitPath = '/api/v1/services/aigc/video-generation/video-synthesis'
    } else if (proto === 'gemini' || p === 'gemini') {
      const m = form.value.default_model || t('aiConfigContent.epModelPlaceholder')
      return {
        submit: `${base}/v1beta/models/${m}:predictLongRunning` + t('aiConfigContent.epGeminiVideoSubmitSuffix'),
        query: `${base}/v1beta/{operationName}` + t('aiConfigContent.epGeminiVideoQuerySuffix'),
        isAuto: true,
        isGemini: true
      }
    } else if (proto === 'vidu' || p === 'vidu') {
      submitPath = '/ent/v2/img2video'
    } else if (proto === 'sora') {
      submitPath = '/v1/videos'
    } else if (proto === 'xai') {
      submitPath = '/v1/videos/generations'
    } else if (proto === 'veo3') {
      submitPath = '/v1/video/create'
    } else if (proto === 'jimeng_ai_api' || p === 'jimeng_ai_api') {
      submitPath = endpoint || '/v1/videos/generations'
      return {
        submit: (base || t('aiConfigContent.epFillBaseUrl')) + submitPath + t('aiConfigContent.epJimengBearerSuffix'),
        query: null,
        isAuto: true,
      }
    } else if (proto === 'kling_omni' || p === 'ffir' || p === 'klingai') {
      const omniFfir = p === 'ffir' || /ffir\.cn/i.test(base)
      const omniKlingOfficial = p === 'klingai' || /api(-beijing|-singapore)?\.klingai\.com/i.test(base)
      submitPath = omniFfir ? '/kling/v1/videos/omni-video' : omniKlingOfficial ? '/v1/videos/omni-video' : '/kling/v1/videos/omni-video'
    } else if (proto === 'kling' || p === 'kling' || p === 'klingai') {
      submitPath = t('aiConfigContent.epKlingT2vOrI2v')
    } else if (p === 'minimax') {
      submitPath = '/video_generation'  // minimax base_url 已含 /v1
    } else {
      submitPath = '/v1/video/create'
    }

    if (query_endpoint) {
      queryPath = query_endpoint
    } else if (proto === 'volcengine_omni') {
      queryPath = '/contents/generations/tasks/{taskId}'
    } else if (proto === 'volcengine' || p === 'volces' || p === 'volcengine') {
      queryPath = '/tasks/{taskId}/info'
    } else if (proto === 'dashscope' || p === 'dashscope') {
      queryPath = '/api/v1/tasks/{taskId}/info'
    } else if (proto === 'vidu' || p === 'vidu') {
      queryPath = '/ent/v2/tasks/{taskId}/creations'
    } else if (proto === 'sora') {
      queryPath = '/v1/videos/{taskId}'
    } else if (proto === 'xai') {
      queryPath = '/v1/videos/{taskId}'
    } else if (proto === 'veo3') {
      queryPath = '/v1/video/query?id={taskId}'
    } else if (proto === 'kling_omni' || p === 'ffir' || p === 'klingai') {
      const omniFfirQ = p === 'ffir' || /ffir\.cn/i.test(base)
      const omniKlingOfficialQ = p === 'klingai' || /api(-beijing|-singapore)?\.klingai\.com/i.test(base)
      queryPath = omniFfirQ
        ? '/kling/v1/images/omni-image/{taskId}'
        : omniKlingOfficialQ
          ? '/v1/videos/omni-video/{taskId}'
          : '/kling/v1/images/omni-image/{taskId}'
    } else if (proto === 'kling' || p === 'kling' || p === 'klingai') {
      queryPath = t('aiConfigContent.epKlingQueryAuto')
    } else if (p === 'minimax') {
      queryPath = '/query/video_generation?task_id={taskId}'  // minimax base_url 已含 /v1
    } else if (proto !== 'gemini' && p !== 'gemini') {
      queryPath = '/v1/video/query?id={taskId}'
    }
  }

  const submitUrl = base ? (base + submitPath) : (t('aiConfigContent.epUnfilledBaseUrl') + submitPath)
  const queryUrl = queryPath ? (base ? base + queryPath : t('aiConfigContent.epUnfilledBaseUrl') + queryPath) : null

  if (!submitPath) return null
  return {
    submit: submitUrl,
    query: queryUrl,
    isAuto: !endpoint  // 端点是自动推断的（非用户手填）
  }
})

function onProviderChange(providerId) {
  if (providerId === CUSTOM_PROVIDER_SENTINEL) {
    form.value.provider = ''
    form.value.api_protocol = ''
    form.value.base_url = ''
    form.value.modelText = ''
    form.value.default_model = ''
    return
  }
  const st = form.value.service_type || 'text'
  const p = (providerConfigs.value[st] || []).find((x) => x.id === providerId)
  if (!p) {
    form.value.base_url = ''
    form.value.modelText = ''
    form.value.default_model = ''
    return
  }
  form.value.base_url = getBaseUrlForProvider(providerId)
  form.value.modelText = (p.models || []).join('\n')
  form.value.default_model = (p.models && p.models[0]) || ''
  if (providerId === 'deepseek') {
    form.value.deepseek_thinking = 'disabled'
    form.value.deepseek_reasoning_effort = 'high'
  }
  // 自动填充接口规范
  form.value.api_protocol = providerProtocolMap[providerId] || (st === 'text' ? '' : 'openai')
  if (st === 'video' && providerId === 'jimeng_ai_api') {
    form.value.endpoint = ''
    form.value.query_endpoint = ''
  }
  if (st === 'video' && (providerId === 'ffir' || providerId === 'klingai')) {
    if (providerId === 'ffir') {
      form.value.endpoint = '/kling/v1/videos/omni-video'
      form.value.query_endpoint = '/kling/v1/images/omni-image/{taskId}'
    } else {
      form.value.endpoint = '/v1/videos/omni-video'
      form.value.query_endpoint = '/v1/videos/omni-video/{taskId}'
    }
  }
  if (!editingId.value) {
    form.value.name = (p.name || providerId) + ' ' + serviceTypeLabel(st)
  }
}

/** 通义一键配置用 */
const TONGYI_CONFIGS = computed(() => [
  { service_type: 'text', name: t('aiConfigContent.tongyiNameText'), base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', provider: 'qwen', model: ['qwen-plus'] },
  { service_type: 'image', name: t('aiConfigContent.tongyiNameImage'), base_url: 'https://dashscope.aliyuncs.com', provider: 'dashscope', model: ['wan2.6-image'] },
  { service_type: 'image', name: t('aiConfigContent.tongyiNameQwenImage'), base_url: 'https://dashscope.aliyuncs.com', provider: 'qwen_image', model: ['qwen-image-max', 'qwen-image-plus', 'qwen-image'] },
  { service_type: 'storyboard_image', name: t('aiConfigContent.tongyiNameStoryboard'), base_url: 'https://dashscope.aliyuncs.com', provider: 'dashscope', model: ['wan2.6-image'] },
  { service_type: 'video', name: t('aiConfigContent.tongyiNameVideo'), base_url: 'https://dashscope.aliyuncs.com', provider: 'dashscope', model: ['wan3.0-i2v', 'wan3.0-kf2v', 'wan3.0-t2v', 'wan3.0-r2v'] }
])

/** 火山引擎一键配置用 */
const VOLCENGINE_CONFIGS = computed(() => [
  { service_type: 'text', name: t('aiConfigContent.volcNameText'), base_url: 'https://ark.cn-beijing.volces.com/api/v3', provider: 'volcengine', model: ['deepseek-v3-2-251201', 'doubao-1-5-pro-32k-250115', 'kimi-k2-thinking-251104'] },
  { service_type: 'image', name: t('aiConfigContent.volcNameImage'), base_url: 'https://ark.cn-beijing.volces.com/api/v3', provider: 'volcengine', model: ['doubao-seedream-4-5-251128'] },
  { service_type: 'storyboard_image', name: t('aiConfigContent.volcNameStoryboard'), base_url: 'https://ark.cn-beijing.volces.com/api/v3', provider: 'volcengine', model: ['doubao-seedream-4-5-251128'] },
  { service_type: 'video', name: t('aiConfigContent.volcNameVideo'), base_url: 'https://ark.cn-beijing.volces.com/api/v3', provider: 'volces', model: ['doubao-seedance-1-5-pro-251215'] }
])

function serviceTypeLabel(st) {
  const map = {
    text: t('aiConfigContent.stlText'),
    image: t('aiConfigContent.stlImage'),
    storyboard_image: t('aiConfigContent.stlStoryboardImage'),
    video: t('aiConfigContent.stlVideo'),
    tts: t('aiConfigContent.stlTts'),
    jimeng2_character_auth: t('aiConfigContent.stlJimeng2Auth'),
  }
  return map[st] || st
}

async function loadList() {
  loading.value = true
  try {
    list.value = await aiAPI.list()
  } catch (_) {
    list.value = []
  } finally {
    loading.value = false
  }
}

function parseModelText(text) {
  if (!text || !String(text).trim()) return []
  return String(text)
    .split(/[\n,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function resetForm() {
  editingId.value = null
  presetModelPick.value = ''
  // 保留当前已选的 service_type（由 Tab 点击决定），避免重置回 text 导致显示不符
  const currentServiceType = form.value.service_type || 'text'
  form.value = {
    service_type: currentServiceType,
    name: '',
    provider: '',
    api_protocol: '',
    base_url: '',
    api_key: '',
    endpoint: '',
    query_endpoint: '',
    modelText: '',
    default_model: '',
    deepseek_thinking: 'disabled',
    deepseek_reasoning_effort: 'high',
    priority: 0,
    is_default: true,  // 新增时默认勾选「设为默认」，便于理解当前会使用哪条配置
    voice_id: '',
    group_id: '',
    kling_access_key: '',
    kling_secret_key: '',
    kling_secret_key_base64: false,
  }
  formRef.value?.resetFields?.()
}

function openAdd() {
  resetForm()
  dialogVisible.value = true
}

function openEdit(row) {
  editingId.value = row.id
  const model = Array.isArray(row.model) ? row.model : (row.model ? [row.model] : [])
  const modelList = model.map((m) => String(m).trim()).filter(Boolean)
  const defaultInList = row.default_model && modelList.includes(row.default_model)
  // TTS / 可灵 Omni 等从 settings 解析
  let voice_id = row.voice_id || ''
  let group_id = row.group_id || ''
  let kling_access_key = ''
  let kling_secret_key = ''
  let kling_secret_key_base64 = false
  const deepseekSettings = resolveDeepSeekFormSettings(row)
  if (row.settings) {
    try {
      const s = JSON.parse(row.settings)
      if (row.service_type === 'tts') {
        voice_id = s.voice_id || voice_id
        group_id = s.group_id || group_id
      }
      if (row.service_type === 'video' && row.api_protocol === 'kling_omni') {
        kling_access_key = s.kling_access_key || ''
        kling_secret_key = s.kling_secret_key || ''
        kling_secret_key_base64 = !!s.kling_secret_key_base64
      }
    } catch (_) {}
  }
  form.value = {
    service_type: row.service_type,
    name: row.name,
    provider: row.provider,
    api_protocol: row.api_protocol || '',
    base_url: row.base_url,
    api_key: row.api_key,
    endpoint: row.endpoint || '',
    query_endpoint: row.query_endpoint || '',
    modelText: modelList.join('\n'),
    default_model: defaultInList ? row.default_model : (modelList[0] || ''),
    deepseek_thinking: deepseekSettings.thinking,
    deepseek_reasoning_effort: deepseekSettings.effort,
    priority: row.priority ?? 0,
    is_default: !!row.is_default,
    voice_id,
    group_id,
    kling_access_key,
    kling_secret_key,
    kling_secret_key_base64,
  }
  dialogVisible.value = true
}

async function submit() {
  await formRef.value?.validate?.().catch(() => {})
  saving.value = true
  try {
    let modelList = parseModelText(form.value.modelText)
    if (form.value.service_type === 'jimeng2_character_auth' && modelList.length === 0) {
      modelList = ['-']
    }
    const defaultModel = form.value.default_model && modelList.includes(form.value.default_model)
      ? form.value.default_model
      : modelList[0] || null
    // TTS / 可灵 Omni 官方 AKSK / DeepSeek V4 参数打包进 settings
    let settings = undefined
    if (form.value.service_type === 'tts') {
      const s = {}
      if (form.value.voice_id) s.voice_id = form.value.voice_id
      if (form.value.group_id) s.group_id = form.value.group_id
      settings = Object.keys(s).length ? JSON.stringify(s) : null
    } else if (form.value.service_type === 'video' && form.value.api_protocol === 'kling_omni') {
      let baseS = {}
      if (editingId.value) {
        const prev = list.value.find((r) => r.id === editingId.value)
        if (prev?.settings) {
          try {
            baseS = JSON.parse(prev.settings)
          } catch (_) {}
        }
      }
      if ((form.value.kling_access_key || '').trim()) baseS.kling_access_key = form.value.kling_access_key.trim()
      else delete baseS.kling_access_key
      if ((form.value.kling_secret_key || '').trim()) baseS.kling_secret_key = form.value.kling_secret_key.trim()
      else delete baseS.kling_secret_key
      if (form.value.kling_secret_key_base64) baseS.kling_secret_key_base64 = true
      else delete baseS.kling_secret_key_base64
      settings = Object.keys(baseS).length ? JSON.stringify(baseS) : null
    } else if (isDeepSeekOfficialForm.value) {
      const prev = editingId.value ? list.value.find((r) => r.id === editingId.value) : null
      const baseS = parseSettings(prev?.settings)
      baseS.deepseek_thinking = form.value.deepseek_thinking === 'enabled' ? 'enabled' : 'disabled'
      if (baseS.deepseek_thinking === 'enabled') {
        baseS.deepseek_reasoning_effort = form.value.deepseek_reasoning_effort === 'max' ? 'max' : 'high'
      } else {
        delete baseS.deepseek_reasoning_effort
      }
      settings = Object.keys(baseS).length ? JSON.stringify(baseS) : null
    }
    const payload = {
      service_type: form.value.service_type,
      name: form.value.name,
      provider: form.value.provider,
      api_protocol: form.value.api_protocol || '',
      base_url: form.value.base_url,
      api_key: form.value.api_key,
      endpoint: form.value.endpoint || '',
      query_endpoint: form.value.query_endpoint || '',
      model: modelList,
      default_model: defaultModel,
      priority: form.value.priority,
      is_default: form.value.is_default,
      ...(settings !== undefined ? { settings } : {}),
    }
    if (editingId.value) {
      await aiAPI.update(editingId.value, payload)
      ElMessage.success(t('aiConfigContent.msgSaveSuccess'))
    } else {
      await aiAPI.create(payload)
      ElMessage.success(t('aiConfigContent.msgAddSuccess'))
    }
    dialogVisible.value = false
    await loadList()
  } catch (e) {
    // request 已统一报错
  } finally {
    saving.value = false
  }
}

function openBulkKey() {
  bulkKeyInput.value = ''
  bulkKeyVisible.value = true
}

async function submitBulkKey() {
  const key = bulkKeyInput.value.trim()
  if (!key) return
  bulkKeySaving.value = true
  try {
    const res = await aiAPI.bulkUpdateKey(key)
    ElMessage.success(res?.message || t('aiConfigContent.msgBulkKeyUpdated'))
    bulkKeyVisible.value = false
    await loadList()
  } catch (_) {
  } finally {
    bulkKeySaving.value = false
  }
}

function onJimeng2AssetsDialogClosed() {
  jimeng2AssetsRows.value = []
  jimeng2AssetsNextCursor.value = null
  jimeng2AssetsHasMore.value = false
}

async function fetchJimeng2MaterialAssets(firstPage) {
  if (!form.value.base_url?.trim() || !form.value.api_key?.trim()) {
    ElMessage.warning(t('aiConfigContent.msgFillGatewayAndToken'))
    return
  }
  if (firstPage) {
    jimeng2AssetsRows.value = []
    jimeng2AssetsNextCursor.value = null
    jimeng2AssetsHasMore.value = false
    jimeng2AssetsDialogVisible.value = true
  }
  jimeng2AssetsLoading.value = true
  try {
    const data = await aiAPI.listJimeng2MaterialAssets({
      base_url: form.value.base_url.trim(),
      api_key: form.value.api_key,
      limit: 20,
      cursor: firstPage ? undefined : jimeng2AssetsNextCursor.value || undefined,
    })
    const items = Array.isArray(data?.items) ? data.items : []
    if (firstPage) {
      jimeng2AssetsRows.value = items
    } else {
      jimeng2AssetsRows.value = [...jimeng2AssetsRows.value, ...items]
    }
    jimeng2AssetsNextCursor.value = data?.next_cursor ?? null
    jimeng2AssetsHasMore.value = !!data?.has_more
  } catch (_) {
    /* request 拦截器已 ElMessage */
  } finally {
    jimeng2AssetsLoading.value = false
  }
}

function openJimeng2MaterialAssetsDialog() {
  fetchJimeng2MaterialAssets(true)
}

function loadMoreJimeng2MaterialAssets() {
  if (!jimeng2AssetsHasMore.value || !jimeng2AssetsNextCursor.value) return
  fetchJimeng2MaterialAssets(false)
}

async function openTest(row) {
  if (row.service_type === 'jimeng2_character_auth') {
    ElMessage.info(t('aiConfigContent.msgJimeng2NoTest'))
    return
  }
  testVisible.value = true
  testResult.value = null
  testError.value = ''
  testServiceType.value = row.service_type || 'text'
  try {
    await aiAPI.testConnection({
      base_url: row.base_url,
      api_key: row.api_key,
      model: Array.isArray(row.model) ? row.model[0] : row.model,
      provider: row.provider,
      endpoint: row.endpoint,
      service_type: row.service_type,
      settings: row.settings
    })
    testResult.value = true
  } catch (e) {
    testResult.value = false
    testError.value = e?.message || t('aiConfigContent.msgRequestFailed')
  }
}

async function onDelete(row) {
  await ElMessageBox.confirm(t('aiConfigContent.msgConfirmDelete', { name: row.name }), t('aiConfigContent.msgDeleteConfirmTitle'), {
    type: 'warning'
  })
  try {
    await aiAPI.delete(row.id)
    ElMessage.success(t('aiConfigContent.msgDeleted'))
    await loadList()
  } catch (_) {}
}

function onSelectionChange(rows) {
  selectedRows.value = rows
}

async function onBatchDelete() {
  if (!selectedRows.value.length) return
  await ElMessageBox.confirm(
    t('aiConfigContent.msgConfirmBatchDelete', { count: selectedRows.value.length }),
    t('aiConfigContent.msgBatchDeleteTitle'),
    { type: 'warning', confirmButtonText: t('aiConfigContent.msgConfirmDeleteBtn'), confirmButtonClass: 'el-button--danger' }
  )
  batchDeleting.value = true
  let success = 0, failed = 0
  for (const row of selectedRows.value) {
    try {
      await aiAPI.delete(row.id)
      success++
    } catch (_) { failed++ }
  }
  batchDeleting.value = false
  selectedRows.value = []
  ElMessage.success(t('aiConfigContent.msgBatchDeleted', { success, failed: failed ? t('aiConfigContent.msgBatchDeletedFailedPart', { failed }) : '' }))
  await loadList()
}

function openOneKeyTongyi() {
  oneKeyTongyiKey.value = ''
  oneKeyTongyiVisible.value = true
}

async function submitOneKeyTongyi() {
  const apiKey = oneKeyTongyiKey.value.trim()
  if (!apiKey) return
  oneKeyTongyiSaving.value = true
  try {
    for (const cfg of TONGYI_CONFIGS.value) {
      const models = cfg.model || []
      await aiAPI.create({
        service_type: cfg.service_type,
        name: cfg.name,
        provider: cfg.provider,
        base_url: cfg.base_url,
        api_key: apiKey,
        model: models,
        default_model: models[0] || null,
        priority: 10,
        is_default: true
      })
    }
    ElMessage.success(t('aiConfigContent.msgTongyiCreated'))
    oneKeyTongyiVisible.value = false
    await loadList()
  } catch (_) {
    // 错误已由 request 统一提示
  } finally {
    oneKeyTongyiSaving.value = false
  }
}

function openOneKeyVolc() {
  oneKeyVolcKey.value = ''
  oneKeyVolcVisible.value = true
}

async function submitOneKeyVolc() {
  const apiKey = oneKeyVolcKey.value.trim()
  if (!apiKey) return
  oneKeyVolcSaving.value = true
  try {
    for (const cfg of VOLCENGINE_CONFIGS.value) {
      const models = cfg.model || []
      await aiAPI.create({
        service_type: cfg.service_type,
        name: cfg.name,
        provider: cfg.provider,
        base_url: cfg.base_url,
        api_key: apiKey,
        model: models,
        default_model: models[0] || null,
        priority: 10,
        is_default: true
      })
    }
    ElMessage.success(t('aiConfigContent.msgVolcCreated'))
    oneKeyVolcVisible.value = false
    await loadList()
  } catch (_) {
    // 错误已由 request 统一提示
  } finally {
    oneKeyVolcSaving.value = false
  }
}

async function exportConfigs() {
  try {
    const configs = await aiAPI.list()
    const exportData = configs.map(({ id, created_at, updated_at, ...rest }) => rest)
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ai-configs-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success(t('aiConfigContent.msgExported', { count: exportData.length }))
  } catch (e) {
    ElMessage.error(t('aiConfigContent.msgExportFailed'))
  }
}

function triggerImport() {
  importFileRef.value?.click()
}

async function importConfigs(event) {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const configs = JSON.parse(text)
    if (!Array.isArray(configs)) {
      ElMessage.error(t('aiConfigContent.msgImportInvalidFormat'))
      return
    }
    let success = 0
    let failed = 0
    for (const cfg of configs) {
      try {
        const models = Array.isArray(cfg.model) ? cfg.model : (cfg.model ? [cfg.model] : [])
        await aiAPI.create({
          service_type: cfg.service_type,
          name: cfg.name,
          provider: cfg.provider,
          api_protocol: cfg.api_protocol || null,
          base_url: cfg.base_url,
          api_key: cfg.api_key || '',
          endpoint: cfg.endpoint || null,
          query_endpoint: cfg.query_endpoint || null,
          model: models,
          default_model: cfg.default_model || null,
          priority: cfg.priority ?? 0,
          is_default: !!cfg.is_default,
          settings: cfg.settings || null
        })
        success++
      } catch (_) {
        failed++
      }
    }
    ElMessage.success(t('aiConfigContent.msgImportComplete', { success, failed: failed ? t('aiConfigContent.msgImportCompleteFailedPart', { failed }) : '' }))
    await loadList()
  } catch (e) {
    ElMessage.error(t('aiConfigContent.msgImportFailed', { error: (e.message || t('aiConfigContent.msgImportParseError')) }))
  } finally {
    event.target.value = ''
  }
}

async function loadVendorLock() {
  try {
    vendorLock.value = await aiAPI.getVendorLock()
  } catch (_) {
    vendorLock.value = { enabled: false, config_file: '' }
  }
}

onMounted(() => {
  loadVendorLock()
  loadList()
  loadGenerationSettings()
})
</script>

<style>
.provider-custom-option {
  border-top: 1px solid var(--el-border-color-light, #e4e7ed);
  margin-top: 4px;
  padding-top: 4px;
  color: var(--el-color-primary, #409eff) !important;
  font-style: italic;
}
</style>

<style scoped>
.ai-config-content {
  padding: 0;
}
.config-tabs {
  margin-top: -4px;
}
.tab-content {
  padding-top: 16px;
  max-height: calc(100vh - 320px);
  overflow-y: auto;
}
.content-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 16px;
}
.actions-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.actions-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* 过渡动画 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.2s ease;
}
.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(8px);
}

/* 类型徽章 */
.type-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  border: 1px solid transparent;
}
.type-icon {
  font-size: 13px;
  flex-shrink: 0;
}

/* 文本/对话 — 蓝色 */
.type-text {
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
  border-color: rgba(59, 130, 246, 0.25);
}
/* 文本生成图片 — 绿色 */
.type-image {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
  border-color: rgba(16, 185, 129, 0.25);
}
/* 分镜图片生成 — 紫色 */
.type-storyboard_image {
  background: rgba(139, 92, 246, 0.12);
  color: #8b5cf6;
  border-color: rgba(139, 92, 246, 0.25);
}
/* 视频 — 橙色 */
.type-video {
  background: rgba(249, 115, 22, 0.12);
  color: #f97316;
  border-color: rgba(249, 115, 22, 0.25);
}
.jimeng2-assets-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  width: 100%;
}
.jimeng2-assets-tip {
  flex: 1;
  min-width: 200px;
  margin: 0;
  line-height: 1.5;
}

.type-jimeng2_character_auth {
  background: rgba(20, 184, 166, 0.14);
  color: #0d9488;
  border-color: rgba(20, 184, 166, 0.28);
}

.no-default {
  color: #9ca3af;
  font-size: 13px;
}
.one-key-tip {
  margin: 0 0 12px;
  color: #606266;
  font-size: 13px;
  line-height: 1.5;
}
.one-key-help {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.one-key-section {
  background: var(--el-fill-color-light, #f5f7fa);
  border-radius: 8px;
  padding: 12px 14px;
}
.one-key-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary, #303133);
  margin-bottom: 8px;
}
.one-key-list {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: var(--el-text-color-regular, #606266);
  line-height: 1.8;
}
.one-key-list li {
  margin-bottom: 2px;
}
.one-key-link {
  color: var(--el-color-primary, #409eff);
  text-decoration: none;
}
.one-key-link:hover {
  text-decoration: underline;
}
.one-key-note {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
  line-height: 1.5;
}
.one-key-note + .one-key-note {
  margin-top: 4px;
}
code {
  background: var(--el-fill-color, #f0f2f5);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 12px;
  font-family: monospace;
}
.cfg-tip-content code {
  background: none;
  padding: 0;
  border-radius: 0;
  font-size: inherit;
  font-family: monospace;
}
.default-tip {
  margin: 0 0 16px;
  padding: 10px 12px;
  background: #f0f9ff;
  border-radius: 6px;
  font-size: 13px;
  color: #0369a1;
  line-height: 1.5;
}
.vendor-lock-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.vendor-lock-bar .vendor-lock-tip {
  flex: 1;
  margin-bottom: 0;
}
.vendor-bulk-key-btn {
  white-space: nowrap;
  flex-shrink: 0;
  color: #fff !important;
}
.vendor-lock-tip {
  margin-bottom: 16px;
}
.model-row { margin-bottom: 4px; }
.deepseek-settings {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.field-tip {
  margin: 6px 0 0;
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
}
.form-label-tip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.ph-section-title {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  padding: 4px 0 6px;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 4px;
}
.ph-tag {
  display: inline-block;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  margin-right: 6px;
  font-weight: 600;
  vertical-align: middle;
}
.ph-tag-img {
  background: #ecf5ff;
  color: #409eff;
  border: 1px solid #b3d8ff;
}
.ph-tag-vid {
  background: #f0f9eb;
  color: #67c23a;
  border: 1px solid #b3e19d;
}
.protocol-help .ph-body {
  font-size: 13px;
  line-height: 1.7;
  color: #303133;
}
.protocol-help .ph-body pre {
  background: #f5f7fa;
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.6;
  overflow-x: auto;
  margin: 6px 0 2px;
  white-space: pre-wrap;
  word-break: break-all;
}
.protocol-help .ph-body code {
  background: #f0f2f5;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 12px;
}
.tip-icon {
  font-size: 13px;
  color: #909399;
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.15s;
}
.tip-icon:hover {
  color: #409eff;
}
.endpoint-preview-box {
  background: #f0f7ff;
  border: 1px solid #c6e0ff;
  border-radius: 6px;
  padding: 10px 14px;
  margin: -4px 0 14px;
  font-size: 12px;
}
.ep-preview-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #409eff;
  margin-bottom: 8px;
  font-size: 12px;
}
.ep-auto-badge {
  background: #e6f1ff;
  color: #409eff;
  border: 1px solid #b3d8ff;
  border-radius: 3px;
  padding: 0 5px;
  font-size: 11px;
  font-weight: 400;
}
.ep-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 5px;
  gap: 6px;
  line-height: 1.5;
}
.ep-row:last-of-type {
  margin-bottom: 0;
}
.ep-label {
  flex-shrink: 0;
  color: #606266;
  min-width: 68px;
}
.ep-url {
  word-break: break-all;
  color: #303133;
  background: rgba(255,255,255,0.7);
  border: 1px solid #dce8fa;
  border-radius: 3px;
  padding: 1px 6px;
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 11.5px;
  line-height: 1.6;
}
.ep-tip {
  margin: 8px 0 0;
  font-size: 11px;
  color: #909399;
  line-height: 1.4;
}
.ep-tip-warn {
  color: #e6a23c;
}
.ep-box-gemini {
  background: #fffbf0;
  border-color: #f5dfa0;
}
.ep-box-gemini .ep-preview-header {
  color: #b8860b;
}
.ep-badge-gemini {
  background: #fef6e0;
  color: #b8860b;
  border-color: #f0d080;
}
.generation-settings {
  max-width: 600px;
}
.gs-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}
.gs-desc {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
  margin-bottom: 20px;
}
.gs-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.gs-label {
  font-size: 13px;
  color: #303133;
  font-weight: 500;
  white-space: nowrap;
}
.gs-unit {
  font-size: 13px;
  color: #606266;
  white-space: nowrap;
}
.gs-tip-box {
  margin-top: 20px;
  background: #f5f7fa;
  border-radius: 8px;
  padding: 14px 16px;
  font-size: 13px;
}
.gs-tip-title {
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}
.gs-tip-list {
  margin: 0 0 8px 16px;
  padding: 0;
  color: #606266;
  line-height: 1.8;
}
.gs-tip-note {
  color: #909399;
  font-size: 12px;
}
</style>
