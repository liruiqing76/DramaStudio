<template>
  <div class="film-create" :class="{ 'sidebar-collapsed': navCollapsed }">
    <!-- 顶部 -->
    <header class="header">
      <div class="header-inner">
        <h1 class="logo" @click="goList">
          <span class="logo-main">{{ $t('t001') }}</span>
          <span class="logo-sub">LocalMiniDrama</span>
        </h1>
        <span class="breadcrumb-sep">›</span>
        <span class="page-title">{{ dramaId ? (store.drama?.title || $t('t002')) : $t('t003') }}</span>
        <el-select
          v-if="dramaId"
          v-model="selectedEpisodeId"
          class="header-episode-select"
          :placeholder="$t('t004')"
          clearable
          size="small"
          style="width: 130px"
          @change="onEpisodeSelect"
        >
          <el-option
            v-for="ep in (store.drama?.episodes || [])"
            :key="ep.id"
            :label="ep.title || $t('t005') + (ep.episode_number || 0) + $t('t006')"
            :value="ep.id"
          />
        </el-select>
        <el-button v-if="dramaId" class="btn-back-drama" @click="router.push('/drama/' + dramaId)">
          <el-icon><ArrowLeft /></el-icon>
          {{ $t('t007') }}
        </el-button>
        <div class="header-actions">
          <el-button class="btn-theme" :title="isDark ? $t('t008') : $t('t009')" @click="toggleTheme">
            <el-icon><Sunny v-if="isDark" /><Moon v-else /></el-icon>
            {{ isDark ? $t('t010') : $t('t011') }}
          </el-button><el-button class="btn-ai-config" @click="showAiConfigDialog = true">
            <el-icon><Setting /></el-icon>
            {{ $t('t012') }}
          </el-button>
        </div>
      </div>
    </header>

    <!-- 左侧固定侧边栏 -->
    <nav class="quick-nav" :class="{ collapsed: navCollapsed }" :aria-label="$t('t013')">
      <div class="nav-sidebar-header">
        <span v-if="!navCollapsed" class="nav-sidebar-title">{{ $t('t014') }}</span>
        <div class="nav-toggle" :title="navCollapsed ? $t('t015') : $t('t016')" @click="toggleNav()">
          <el-icon><Expand v-if="navCollapsed" /><Fold v-else /></el-icon>
        </div>
      </div>

      <!-- 步骤列表 -->
      <div class="nav-steps">
        <div
          v-for="(step, idx) in navSteps"
          :key="step.key"
          class="nav-step"
          :class="['status-' + step.status]"
          @click="scrollToAnchor(step.anchor)"
        >
          <!-- 左侧连接线 -->
          <div class="step-connector-wrap">
            <div v-if="idx > 0" class="step-line step-line-top" :class="{ filled: navSteps[idx - 1].status === 'done' }" />
            <div
              class="step-dot"
              :class="['dot-' + step.status]"
            >
              <el-icon v-if="step.status === 'done'" class="dot-icon"><Check /></el-icon>
              <el-icon v-else-if="step.status === 'generating'" class="dot-icon spin"><Loading /></el-icon>
              <span v-else class="dot-num">{{ idx + 1 }}</span>
            </div>
            <div v-if="idx < navSteps.length - 1" class="step-line step-line-bottom" :class="{ filled: step.status === 'done' }" />
          </div>

          <!-- 右侧文字 + 状态徽章 -->
          <div class="step-body">
            <span class="step-label">{{ step.label }}</span>
            <span v-if="step.count > 0 && step.status !== 'done'" class="step-count">{{ step.count }}</span>
            <span v-if="step.status === 'partial'" class="step-badge partial-badge" :title="$t('t017')">
              <el-icon><WarningFilled /></el-icon>
            </span>
            <span v-else-if="step.status === 'generating'" class="step-badge gen-badge" :title="$t('t018')">
              <el-icon class="spin"><Loading /></el-icon>
            </span>
          </div>
        </div>
      </div>

      <!-- 分镜子列表 -->
      <div v-if="!navCollapsed && storyboards.length > 0" class="nav-group">
        <div class="nav-sub-toggle" @click="storyboardMenuExpanded = !storyboardMenuExpanded">
          <el-icon><Minus v-if="storyboardMenuExpanded" /><Plus v-else /></el-icon>
          <span>{{ $t('t019') }}</span>
        </div>
        <div v-show="storyboardMenuExpanded" class="nav-sub-list">
          <template v-for="(sb, i) in storyboards" :key="sb.id">
            <!-- 段落标题行 -->
            <div
              v-if="sb.segment_title && (i === 0 || sb.segment_index !== storyboards[i - 1].segment_index)"
              class="nav-segment-label"
            >
              <span class="nav-segment-dot" />
              {{ sb.segment_title }}
            </div>
            <div
              class="nav-sub-item"
              :title="sb.title || $t('t020') + (i + 1)"
              @click="scrollToAnchor('sb-' + sb.id)"
            >
              {{ i + 1 }}. {{ sb.title || $t('t021') }}
            </div>
          </template>
        </div>
      </div>

      <!-- 当前任务面板 -->
      <div v-if="allActiveTasks.length > 0" class="atp-panel">
        <!-- 折叠态：只显示旋转点和数量 -->
        <div v-if="navCollapsed" class="atp-collapsed-badge" :title="allActiveTasks.join('\n')">
          <span class="atp-spin-dot" />
          <span class="atp-collapsed-count">{{ allActiveTasks.length }}</span>
        </div>
        <!-- 展开态：标题 + 任务列表 -->
        <template v-else>
          <div class="atp-header">
            <span class="atp-spin-dot" />
            <span class="atp-title">{{ $t('t022') }}</span>
            <span class="atp-count-badge">{{ allActiveTasks.length }}</span>
          </div>
          <div class="atp-list">
            <el-tooltip
              v-for="(label, i) in allActiveTasks.slice(0, 8)"
              :key="i"
              :content="label"
              placement="right"
              :show-after="200"
              :enterable="false"
            >
              <div class="atp-item">
                <span class="atp-item-dot" />
                <span class="atp-item-label">{{ label }}</span>
              </div>
            </el-tooltip>
            <el-tooltip
              v-if="allActiveTasks.length > 8"
              :content="allActiveTasks.slice(8).join('\n')"
              placement="right"
              :show-after="200"
            >
              <div class="atp-more">
                {{ $t('t023') }} {{ allActiveTasks.length - 8 }} {{ $t('t024') }}
              </div>
            </el-tooltip>
          </div>
        </template>
      </div>
    </nav>

    <main class="main">
      <!-- 角色/道具/场景上传图片用，单例放在外层避免 v-for 导致 ref 为数组 -->
      <input
        ref="resourceImageFileInput"
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        style="display: none"
        @change="onResourceImageFileChange"
      />
      <!-- 分镜图上传图片用，单例放在外层避免 v-for 导致 ref 为数组 -->
      <input
        ref="sbImageFileInput"
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        style="display: none"
        @change="onSbImageFileChange"
      />
      <!-- 剧本工作台：单卡片 + 选项卡（创作 / 选择） -->
      <section class="section card script-workbench-unified">
        <el-tabs v-model="scriptWorkbenchMode" class="script-workbench-tabs">
          <el-tab-pane :label="$t('t025')" name="create">
            <div class="script-pane-inner">
              <div class="script-sub-block">
                <h2 class="section-title">{{ $t('t026') }}</h2>
                <p class="section-desc">{{ $t('t027') }}</p>
                <el-input
                  v-model="storyInput"
                  type="textarea"
                  :rows="4"
                  :placeholder="$t('t028')"
                  class="story-textarea"
                />
                <div class="row gap" style="margin-top: 10px; flex-wrap: wrap;">
                  <el-select v-model="storyStyle" :placeholder="$t('t029')" clearable style="width: 120px" @change="() => saveProjectSettings(false)">
                    <el-option :label="$t('t030')" value="modern" />
                    <el-option :label="$t('t031')" value="ancient" />
                    <el-option :label="$t('t032')" value="fantasy" />
                    <el-option :label="$t('t033')" value="daily" />
                  </el-select>
                  <el-select v-model="storyType" :placeholder="$t('t034')" clearable style="width: 120px" @change="() => saveProjectSettings(false)">
                    <el-option :label="$t('t035')" value="drama" />
                    <el-option :label="$t('t036')" value="comedy" />
                    <el-option :label="$t('t037')" value="adventure" />
                  </el-select>
                  <el-select v-model="storyEpisodeCount" :placeholder="$t('t038')" style="width: 120px">
                    <el-option :label="$t('t039')" :value="1" />
                    <el-option :label="$t('t040')" :value="2" />
                    <el-option :label="$t('t041')" :value="3" />
                    <el-option :label="$t('t042')" :value="4" />
                    <el-option :label="$t('t043')" :value="5" />
                    <el-option :label="$t('t044')" :value="6" />
                  </el-select>
                  <el-button type="primary" :loading="storyGenerating" @click="onGenerateStory">
                    {{ $t('t045') }}
                  </el-button>
                  <el-button plain @click="showNovelImport = true">
                    <el-icon><DocumentAdd /></el-icon>
                    {{ $t('t046') }}
                  </el-button>
                </div>
              </div>
              <div class="script-sub-divider" />
              <div id="anchor-script" class="script-sub-block">
                <h2 class="section-title">{{ $t('t047') }}</h2>
                <div class="row gap" style="margin-bottom: 10px; flex-wrap: wrap;">
                  <el-select
                    v-model="selectedEpisodeId"
                    :placeholder="$t('t004')"
                    clearable
                    style="width: 130px"
                    :disabled="!dramaId"
                    @change="onEpisodeSelect"
                  >
                    <el-option
                      v-for="ep in (store.drama?.episodes || [])"
                      :key="ep.id"
                      :label="ep.title || $t('t005') + (ep.episode_number || 0) + $t('t006')"
                      :value="ep.id"
                    />
                  </el-select>
                  <el-input v-model="scriptTitle" :placeholder="$t('t048')" style="width: 150px" />
                  <el-button v-if="dramaId" style="margin-left: auto" @click="onAddEpisode">
                    <el-icon><Plus /></el-icon>{{ $t('t049') }}
                  </el-button>
                </div>
                <el-input
                  v-model="scriptContent"
                  type="textarea"
                  :rows="8"
                  :placeholder="$t('t050')"
                  class="story-textarea"
                />
                <div class="row gap" style="margin-top: 8px; flex-wrap: wrap;">
                  <el-button
                    :loading="scriptGenerating"
                    :disabled="!!dramaId && (store.drama?.episodes?.length > 0) && !currentEpisodeId"
                    @click="onGenerateScript"
                  >
                    {{ $t('t051') }}
                  </el-button>
                </div>
              </div>
            </div>
          </el-tab-pane>
          <el-tab-pane :label="$t('t052')" name="select">
            <p class="section-desc script-mode-hint">
              {{ $t('t053') }}
            </p>
            <el-button type="primary" @click="openSelectScriptDialog">
              <el-icon><Document /></el-icon>
              {{ $t('t054') }}
            </el-button>
            <div v-if="dramaId && (store.drama?.episodes?.length || storyInput)" class="script-preview-wrap">
              <h3 class="preview-block-title">{{ $t('t055') }}</h3>
              <el-input
                :model-value="storyInput"
                type="textarea"
                :rows="3"
                readonly
                class="story-textarea"
              />
              <template v-if="(store.drama?.episodes || []).length > 1">
                <h3 class="preview-block-title">{{ $t('t056') }}</h3>
                <el-tabs v-model="selectPreviewEpisodeId" class="preview-ep-tabs">
                  <el-tab-pane
                    v-for="ep in (store.drama?.episodes || [])"
                    :key="ep.id"
                    :label="ep.title || ($t('t005') + (ep.episode_number || 0) + $t('t006'))"
                    :name="String(ep.id)"
                  >
                    <el-input
                      :model-value="ep.script_content || ''"
                      type="textarea"
                      :rows="12"
                      readonly
                      class="story-textarea"
                    />
                  </el-tab-pane>
                </el-tabs>
              </template>
              <template v-else>
                <h3 class="preview-block-title">{{ $t('t057') }}</h3>
                <el-input
                  :model-value="scriptContent"
                  type="textarea"
                  :rows="12"
                  readonly
                  class="story-textarea"
                />
              </template>
              <div class="preview-actions">
                <el-button type="primary" plain @click="scriptWorkbenchMode = 'create'">{{ $t('t058') }}</el-button>
              </div>
            </div>
            <p v-else class="script-select-empty">{{ $t('t059') }}</p>
          </el-tab-pane>
        </el-tabs>
      </section>

      <el-dialog
        v-model="showSelectScriptDialog"
        :title="$t('t060')"
        width="640px"
        destroy-on-close
        @open="loadSelectScriptList"
      >
        <div v-loading="selectScriptLoading || selectScriptImporting" class="select-script-list">
          <div
            v-for="d in selectableScriptDramas"
            :key="d.id"
            class="select-script-item"
            :class="{ disabled: selectScriptImporting }"
            @click="!selectScriptImporting && onPickScriptFromDialog(d.id)"
          >
            <div class="select-script-title">{{ d.title || $t('t061') }}</div>
            <div class="select-script-desc">{{ (d.description || $t('t062')).slice(0, 200) }}{{ (d.description && d.description.length > 200) ? '…' : '' }}</div>
          </div>
          <div v-if="!selectScriptLoading && selectScriptDramas.length === 0" class="select-script-empty">{{ $t('t063') }}</div>
          <div v-else-if="!selectScriptLoading && selectableScriptDramas.length === 0" class="select-script-empty">{{ $t('t064') }}</div>
        </div>
      </el-dialog>

      <!-- 一键全流程生成 -->
      <section class="section card pipeline-section">
        <div class="one-click-actions">
          <span class="one-click-label">{{ $t('t065') }}</span>
          <el-select v-model="projectAspectRatio" style="width: 130px" @change="() => saveProjectSettings(false)">
            <el-option :label="$t('t066')" value="16:9" />
            <el-option :label="$t('t067')" value="9:16" />
            <el-option :label="$t('t068')" value="3:4" />
            <el-option :label="$t('t069')" value="1:1" />
            <el-option label="4:3" value="4:3" />
            <el-option :label="$t('t070')" value="21:9" />
          </el-select>
          <el-select v-model="videoClipDuration" style="width: 105px" @change="() => saveProjectSettings(false)">
            <el-option :label="$t('t071')" :value="4" />
            <el-option :label="$t('t072')" :value="5" />
            <el-option :label="$t('t073')" :value="8" />
            <el-option :label="$t('t074')" :value="10" />
            <el-option :label="$t('t075')" :value="12" />
            <el-option :label="$t('t076')" :value="15" />
          </el-select>
          <el-select v-model="scriptLanguage" :placeholder="$t('t077')" clearable style="width: 105px">
            <el-option :label="$t('t078')" value="zh" />
            <el-option :label="$t('t079')" value="en" />
          </el-select>
          <StylePickerButton
            v-model="generationStyle"
            :options="generationStyleOptions"
            @change="() => saveProjectSettings(true)"
          />
          <el-button
            type="primary"
            :loading="pipelineRunning && !pipelinePaused"
            :disabled="!currentEpisodeId || pipelineRunning"
            @click="startOneClickPipeline"
          >
            {{ $t('t080') }}
          </el-button>
          <el-button
            :loading="pipelineRunning && !pipelinePaused"
            :disabled="!currentEpisodeId || pipelineRunning"
            :title="$t('t081')"
            @click="startTextFrameworkPipeline"
          >
            {{ $t('t082') }}
          </el-button>
          <template v-if="pipelineRunning">
            <el-button v-if="!pipelinePaused" type="warning" @click="pipelinePaused = true">{{ $t('t083') }}</el-button>
            <el-button v-else type="success" @click="onPipelineResume">{{ $t('t084') }}</el-button>
            <el-button type="danger" @click="requestPipelineCancel">{{ $t('t304') }}</el-button>
          </template>
        </div>
        <div v-if="pipelineRunning || pipelineErrorLog.length > 0" class="pipeline-status">
          <div v-if="pipelineCurrentStep" class="pipeline-current-step">
            <span v-if="pipelineStepIndex > 0" class="pipeline-step-badge">{{ pipelineStepIndex }}/{{ pipelineStepTotal }}</span>
            {{ pipelineCurrentStep.replace(/^\[步骤 \d+\/\d+\] /, '') }}
          </div>
          <!-- 阶段间倒计时 -->
          <div v-if="pipelineCountdown > 0" class="pipeline-countdown">
            <div class="pipeline-countdown-ring">
              <span class="pipeline-countdown-num">{{ pipelineCountdown }}</span>
              <span class="pipeline-countdown-unit">{{ $t('t085') }}</span>
            </div>
            <div class="pipeline-countdown-body">
              <p class="pipeline-countdown-msg">{{ pipelineCountdownMsg }}</p>
              <div class="pipeline-countdown-actions">
                <el-button size="small" type="success" @click="skipPipelineCountdown">{{ $t('t086') }}</el-button>
                <el-button v-if="!pipelinePaused" size="small" type="warning" @click="pipelinePaused = true">{{ $t('t087') }}</el-button>
                <span v-else class="pipeline-countdown-paused">{{ $t('t088') }}</span>
              </div>
            </div>
          </div>
          <div v-if="pipelineActiveTasks.size > 0" class="pipeline-active-tasks">
            <span
              v-for="label in Array.from(pipelineActiveTasks)"
              :key="label"
              class="pipeline-task-chip"
            >
              <span class="pipeline-task-dot" />{{ label }}
            </span>
          </div>
          <div v-if="pipelineErrorLog.length > 0" class="pipeline-error-log">
            <div class="pipeline-error-title">{{ $t('t089') }}</div>
            <div v-for="(entry, idx) in pipelineErrorLog" :key="idx" class="pipeline-error-line">
              [{{ entry.step }}] {{ entry.message }}
            </div>
          </div>
        </div>
      </section>

      <!-- 资源管理：角色 / 道具 / 场景 -->
      <section class="section card resource-panel">
        <div class="collapse-header" @click="resourcePanelCollapsed = !resourcePanelCollapsed">
          <h2 class="section-title">{{ $t('t090') }}</h2>
          <el-icon class="collapse-icon"><ArrowUp v-if="!resourcePanelCollapsed" /><ArrowDown v-else /></el-icon>
        </div>
        <div v-show="!resourcePanelCollapsed" class="resource-panel-body">
          <!-- 角色生成 -->
          <div id="anchor-characters" class="resource-block card">
            <div class="collapse-header resource-block-header" @click="charactersBlockCollapsed = !charactersBlockCollapsed">
              <h3 class="resource-block-title">{{ $t('t091') }}</h3>
              <el-icon class="collapse-icon"><ArrowUp v-if="!charactersBlockCollapsed" /><ArrowDown v-else /></el-icon>
            </div>
            <div v-show="!charactersBlockCollapsed" class="resource-block-body">
              <div class="asset-actions">
                <el-button type="primary" size="small" :loading="charactersGenerating" :disabled="!dramaId" @click="onGenerateCharacters">
                  {{ $t('t092') }}
                </el-button>
                <el-button size="small" :disabled="!dramaId" @click="openAddCharacter">{{ $t('t093') }}</el-button>
                <el-button size="small" @click="showCharLibrary = true">{{ $t('t094') }}</el-button>
              </div>
              <div class="asset-list asset-list-two">
                <div v-for="char in characters" :key="char.id" class="asset-item asset-item-left-right">
                  <div class="asset-info">
                    <div class="asset-name">
                      <span style="display:inline-flex;align-items:center;gap:4px;flex:1;min-width:0;overflow:hidden">
                        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ char.name }}</span>
                        <el-tag v-if="char.role" size="small" effect="plain" :type="char.role === 'main' ? 'danger' : char.role === 'supporting' ? 'warning' : 'info'" style="flex-shrink:0;padding:0 5px;font-size:11px;height:18px;line-height:18px">{{ charRoleLabel(char.role) }}</el-tag>
                      </span>
                      <el-button type="danger" text size="small" class="btn-delete-icon" :title="$t('t095')" @click="onDeleteCharacter(char)">
                        <el-icon><Delete /></el-icon>
                      </el-button>
                    </div>
                    <div class="asset-desc-full">{{ char.appearance || char.description || $t('t096') }}</div>
                    <div class="asset-btns">
                      <el-button size="small" @click="editCharacter(char)">{{ $t('t097') }}</el-button>
                      <el-button size="small" :loading="addingCharToLibraryId === char.id" :disabled="!hasAssetImage(char)" @click="onAddCharacterToLibrary(char)">
                        {{ $t('t098') }}
                      </el-button>
                      <el-button size="small" :loading="addingCharToMaterialId === char.id" :disabled="!hasAssetImage(char)" @click="onAddCharacterToMaterialLibrary(char)">
                        {{ $t('t099') }}
                      </el-button><el-button
                        size="small"
                        :type="char.seedance2_asset?.status === 'active' ? 'success' : 'warning'"
                        plain
                        :loading="sd2CertifyingId === char.id"
                        :disabled="!hasAssetImage(char)"
                        @click="onSd2PrimaryAction(char)"
                      >
                        {{ sd2ActionLabel(char) }}
                      </el-button>
                    </div>

                    <!-- Seedance 2.0 音色参考（仅该模型有效，其他模型不生效） -->
                    <div class="sd2-voice-row" style="margin-top:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                      <template v-if="char.seedance2_voice_asset?.status === 'active'">
                        <!-- 音色参考已设置：显示试听 + 更换 -->
                        <el-button
                          size="small"
                          type="success"
                          plain
                          @click="playSd2Voice(char)"
                        >
                          <el-icon><VideoPlay /></el-icon>
                          <span style="margin-left:4px">{{ $t('t100') }}</span>
                        </el-button>
                        <el-button
                          size="small"
                          type="primary"
                          plain
                          :loading="sd2VoiceUploadingId === char.id"
                          @click="onSd2VoiceReplace(char)"
                        >
                          {{ $t('t101') }}
                        </el-button>
                        <span style="font-size:11px;color:#67c23a">{{ $t('t102') }}</span>
                      </template>
                      <template v-else>
                        <el-button
                          size="small"
                          :type="char.seedance2_voice_asset?.status === 'stale' ? 'warning' : 'info'"
                          plain
                          :loading="sd2VoiceUploadingId === char.id"
                          @click="onSd2VoicePrimaryAction(char)"
                        >
                          {{ sd2VoiceActionLabel(char) }}
                        </el-button>
                        <span v-if="char.seedance2_voice_asset?.status === 'stale'" style="font-size:11px;color:#e6a23c">{{ $t('t103') }}</span>
                      </template>
                      <span style="font-size:10px;color:#909399">{{ $t('t104') }}</span>
                    </div>
                    <div v-if="getCharAffectedStoryboards(char.id).length" class="asset-storyboard-link">
                      <span class="asl-label">{{ $t('t105') }}</span>
                      <span
                        v-for="sb in getCharAffectedStoryboards(char.id)"
                        :key="sb.id"
                        class="asl-chip"
                        :title="$t('t106')"
                        @click="scrollToStoryboard(sb.id)"
                      >#{{ sb.storyboard_number }}</span>
                      <span v-if="regenSbImagesForAsset.has('char-' + char.id) && regenSbImagesProgress['char-' + char.id]" class="asl-progress">
                        {{ regenSbImagesProgress['char-' + char.id].current }}/{{ regenSbImagesProgress['char-' + char.id].total }}
                      </span>
                      <el-button
                        size="small"
                        class="asl-regen-btn"
                        :loading="regenSbImagesForAsset.has('char-' + char.id)"
                        @click="onRegenAffectedSbImages('char-' + char.id, getCharAffectedStoryboards(char.id))"
                      >
                        <span v-if="!regenSbImagesForAsset.has('char-' + char.id)">{{ $t('t107') }}</span>
                      </el-button>
                    </div>
                  </div>
                  <div class="asset-cover-wrap">
                    <div
                      class="asset-cover"
                      :class="{ 'asset-cover--clickable': hasAssetImage(char), 'asset-cover--dragover': dragOverResourceKey === 'char-' + char.id }"
                      role="button"
                      tabindex="0"
                      @click="hasAssetImage(char) && openImagePreview(assetImageUrl(char))"
                      @dragover="onResourceDragOver($event, 'character', char.id)"
                      @dragleave="onResourceDragLeave($event, 'char-' + char.id)"
                      @drop="onResourceDrop($event, 'character', char.id)"
                    >
                      <img v-if="hasAssetImage(char)" :src="assetImageUrl(char)" class="cover-img" alt="" />
                      <div v-else-if="char.error_msg || char.errorMsg" class="cover-placeholder error" :title="char.error_msg || char.errorMsg">{{ char.error_msg || char.errorMsg }}</div>
                      <div v-else class="cover-placeholder">{{ $t('t108') }}</div>
                      <div v-if="dragOverResourceKey === 'char-' + char.id" class="asset-cover-drop-hint">{{ $t('t109') }}</div>
                    </div>
                    <!-- 额外参考图条 -->
                    <div v-if="parseExtraImages(char).length" class="extra-images-strip">
                      <div v-for="ep in parseExtraImages(char)" :key="ep" class="extra-thumb" :title="$t('t110')">
                        <img :src="localPathToUrl(ep)" alt="" @click="onSetPrimaryImage('character', char, ep)" />
                        <button class="thumb-preview-btn" :title="$t('t111')" @click.stop="openImagePreview(localPathToUrl(ep))">
                          <el-icon :size="10"><ZoomIn /></el-icon>
                        </button>
                        <button class="extra-thumb-remove" :title="$t('t112')" @click.stop="onRemoveExtraImage('character', char, ep)">×</button>
                      </div>
                    </div>
                    <div class="asset-cover-actions">
                      <el-button type="primary" size="small" :loading="generatingCharIds.has(char.id)" @click="onGenerateCharacterImage(char)">
                        <el-icon v-if="!generatingCharIds.has(char.id)"><MagicStick /></el-icon>
                        {{ $t('t113') }}
                      </el-button>
                      <el-button type="success" size="small" :loading="uploadingResourceId === 'char-' + char.id" @click="onUploadResourceClick('character', char.id)">
                        <el-icon v-if="uploadingResourceId !== 'char-' + char.id"><Upload /></el-icon>
                        {{ $t('t114') }}
                      </el-button>
                    </div>
                  </div>
                </div>
                <div v-if="characters.length === 0" class="empty-tip">{{ $t('t115') }}</div>
              </div>
            </div>
          </div>

          <!-- 道具生成 -->
          <div id="anchor-props" class="resource-block card">
            <div class="collapse-header resource-block-header" @click="propsBlockCollapsed = !propsBlockCollapsed">
              <h3 class="resource-block-title">{{ $t('t116') }}</h3>
              <el-icon class="collapse-icon"><ArrowUp v-if="!propsBlockCollapsed" /><ArrowDown v-else /></el-icon>
            </div>
            <div v-show="!propsBlockCollapsed" class="resource-block-body">
              <div class="asset-actions">
                <el-button type="primary" size="small" :loading="propsExtracting" :disabled="!currentEpisodeId" @click="onExtractProps">{{ $t('t117') }}</el-button>
                <el-button size="small" :disabled="!dramaId" @click="showAddProp = true">{{ $t('t118') }}</el-button>
                <el-button size="small" @click="showPropLibrary = true">{{ $t('t119') }}</el-button>
              </div>
              <div class="prop-gen-mode" style="margin: 8px 0; font-size: 13px;">
                <el-checkbox v-model="propUseQuadGrid">{{ $t('t120') }}</el-checkbox>
              </div>
              <div class="asset-list asset-list-two">
                <div v-for="prop in props" :key="prop.id" class="asset-item asset-item-left-right">
                  <div class="asset-info">
                    <div class="asset-name">
                      <span>{{ prop.name }}</span>
                      <el-button type="danger" text size="small" class="btn-delete-icon" :title="$t('t095')" @click="onDeleteProp(prop)">
                        <el-icon><Delete /></el-icon>
                      </el-button>
                    </div>
                    <div class="asset-desc-full">{{ prop.description || prop.prompt || $t('t096') }}</div>
                    <div class="asset-btns">
                      <el-button size="small" @click="editProp(prop)">{{ $t('t097') }}</el-button>
                      <el-button size="small" :loading="addingPropToLibraryId === prop.id" :disabled="!hasAssetImage(prop)" @click="onAddPropToLibrary(prop)">
                        {{ $t('t098') }}
                      </el-button>
                      <el-button size="small" :loading="addingPropToMaterialId === prop.id" :disabled="!hasAssetImage(prop)" @click="onAddPropToMaterialLibrary(prop)">
                        {{ $t('t099') }}
                      </el-button></div>
                    <div v-if="getPropAffectedStoryboards(prop.id).length" class="asset-storyboard-link">
                      <span class="asl-label">{{ $t('t105') }}</span>
                      <span
                        v-for="sb in getPropAffectedStoryboards(prop.id)"
                        :key="sb.id"
                        class="asl-chip"
                        :title="$t('t106')"
                        @click="scrollToStoryboard(sb.id)"
                      >#{{ sb.storyboard_number }}</span>
                      <span v-if="regenSbImagesForAsset.has('prop-' + prop.id) && regenSbImagesProgress['prop-' + prop.id]" class="asl-progress">
                        {{ regenSbImagesProgress['prop-' + prop.id].current }}/{{ regenSbImagesProgress['prop-' + prop.id].total }}
                      </span>
                      <el-button
                        size="small"
                        class="asl-regen-btn"
                        :loading="regenSbImagesForAsset.has('prop-' + prop.id)"
                        @click="onRegenAffectedSbImages('prop-' + prop.id, getPropAffectedStoryboards(prop.id))"
                      >
                        <span v-if="!regenSbImagesForAsset.has('prop-' + prop.id)">{{ $t('t107') }}</span>
                      </el-button>
                    </div>
                  </div>
                  <div class="asset-cover-wrap">
                    <div
                      class="asset-cover"
                      :class="{ 'asset-cover--clickable': hasAssetImage(prop), 'asset-cover--dragover': dragOverResourceKey === 'prop-' + prop.id }"
                      role="button"
                      tabindex="0"
                      @click="hasAssetImage(prop) && openImagePreview(assetImageUrl(prop))"
                      @dragover="onResourceDragOver($event, 'prop', prop.id)"
                      @dragleave="onResourceDragLeave($event, 'prop-' + prop.id)"
                      @drop="onResourceDrop($event, 'prop', prop.id)"
                    >
                      <img v-if="hasAssetImage(prop)" :src="assetImageUrl(prop)" class="cover-img" alt="" />
                      <div v-else-if="prop.error_msg || prop.errorMsg" class="cover-placeholder error" :title="prop.error_msg || prop.errorMsg">{{ prop.error_msg || prop.errorMsg }}</div>
                      <div v-else class="cover-placeholder">{{ $t('t108') }}</div>
                      <div v-if="dragOverResourceKey === 'prop-' + prop.id" class="asset-cover-drop-hint">{{ $t('t109') }}</div>
                    </div>
                    <div v-if="parseExtraImages(prop).length" class="extra-images-strip">
                      <div v-for="ep in parseExtraImages(prop)" :key="ep" class="extra-thumb" :title="$t('t110')">
                        <img :src="localPathToUrl(ep)" alt="" @click="onSetPrimaryImage('prop', prop, ep)" />
                        <button class="thumb-preview-btn" :title="$t('t111')" @click.stop="openImagePreview(localPathToUrl(ep))">
                          <el-icon :size="10"><ZoomIn /></el-icon>
                        </button>
                        <button class="extra-thumb-remove" :title="$t('t112')" @click.stop="onRemoveExtraImage('prop', prop, ep)">×</button>
                      </div>
                    </div>
                    <div class="asset-cover-actions">
                      <el-tooltip :content="propUseQuadGrid ? $t('t121') : $t('t122')" placement="top">
                        <el-button type="primary" size="small" :loading="generatingPropIds.has(prop.id)" @click="onGeneratePropImage(prop, propUseQuadGrid)">
                          <el-icon v-if="!generatingPropIds.has(prop.id)"><MagicStick /></el-icon>
                          {{ $t('t113') }}
                        </el-button>
                      </el-tooltip>
                      <el-button type="success" size="small" :loading="uploadingResourceId === 'prop-' + prop.id" @click="onUploadResourceClick('prop', prop.id)">
                        <el-icon v-if="uploadingResourceId !== 'prop-' + prop.id"><Upload /></el-icon>
                        {{ $t('t114') }}
                      </el-button>
                    </div>
                  </div>
                </div>
                <div v-if="props.length === 0" class="empty-tip">{{ $t('t123') }}</div>
              </div>
            </div>
          </div>

          <!-- 场景生成 -->
          <div id="anchor-scenes" class="resource-block card">
            <div class="collapse-header resource-block-header" @click="scenesBlockCollapsed = !scenesBlockCollapsed">
              <h3 class="resource-block-title">{{ $t('t124') }}</h3>
              <el-icon class="collapse-icon"><ArrowUp v-if="!scenesBlockCollapsed" /><ArrowDown v-else /></el-icon>
            </div>
            <div v-show="!scenesBlockCollapsed" class="resource-block-body">
              <div class="asset-actions">
                <el-button type="primary" size="small" :loading="scenesExtracting" :disabled="!currentEpisodeId" @click="onExtractScenes">
                  {{ $t('t125') }}
                </el-button>
                <el-button size="small" :disabled="!dramaId" @click="openAddScene">{{ $t('t126') }}</el-button>
                <el-button size="small" @click="showSceneLibrary = true">{{ $t('t127') }}</el-button>
              </div>
              <div class="scene-gen-mode" style="margin: 8px 0; font-size: 13px;">
                <el-checkbox v-model="sceneUseQuadGrid">{{ $t('t128') }}</el-checkbox>
              </div>
              <div class="asset-list asset-list-two">
                <div v-for="scene in scenes" :key="scene.id" class="asset-item asset-item-left-right">
                  <div class="asset-info">
                    <div class="asset-name">
                      <span>{{ scene.location }}</span>
                      <el-button type="danger" text size="small" class="btn-delete-icon" :title="$t('t095')" @click="onDeleteScene(scene)">
                        <el-icon><Delete /></el-icon>
                      </el-button>
                    </div>
                    <div class="asset-desc-full">{{ scene.description || scene.prompt || scene.time || $t('t096') }}</div>
                    <div class="asset-btns">
                      <el-button size="small" @click="editScene(scene)">{{ $t('t097') }}</el-button>
                      <el-button size="small" :loading="addingSceneToLibraryId === scene.id" :disabled="!hasAssetImage(scene)" @click="onAddSceneToLibrary(scene)">
                        {{ $t('t098') }}
                      </el-button>
                      <el-button size="small" :loading="addingSceneToMaterialId === scene.id" :disabled="!hasAssetImage(scene)" @click="onAddSceneToMaterialLibrary(scene)">
                        {{ $t('t099') }}
                      </el-button></div>
                    <div v-if="getSceneAffectedStoryboards(scene.id).length" class="asset-storyboard-link">
                      <span class="asl-label">{{ $t('t105') }}</span>
                      <span
                        v-for="sb in getSceneAffectedStoryboards(scene.id)"
                        :key="sb.id"
                        class="asl-chip"
                        :title="$t('t106')"
                        @click="scrollToStoryboard(sb.id)"
                      >#{{ sb.storyboard_number }}</span>
                      <span v-if="regenSbImagesForAsset.has('scene-' + scene.id) && regenSbImagesProgress['scene-' + scene.id]" class="asl-progress">
                        {{ regenSbImagesProgress['scene-' + scene.id].current }}/{{ regenSbImagesProgress['scene-' + scene.id].total }}
                      </span>
                      <el-button
                        size="small"
                        class="asl-regen-btn"
                        :loading="regenSbImagesForAsset.has('scene-' + scene.id)"
                        @click="onRegenAffectedSbImages('scene-' + scene.id, getSceneAffectedStoryboards(scene.id))"
                      >
                        <span v-if="!regenSbImagesForAsset.has('scene-' + scene.id)">{{ $t('t107') }}</span>
                      </el-button>
                    </div>
                  </div>
                  <div class="asset-cover-wrap">
                    <div
                      class="asset-cover"
                      :class="{ 'asset-cover--clickable': hasAssetImage(scene), 'asset-cover--dragover': dragOverResourceKey === 'scene-' + scene.id }"
                      role="button"
                      tabindex="0"
                      @click="hasAssetImage(scene) && openImagePreview(assetImageUrl(scene))"
                      @dragover="onResourceDragOver($event, 'scene', scene.id)"
                      @dragleave="onResourceDragLeave($event, 'scene-' + scene.id)"
                      @drop="onResourceDrop($event, 'scene', scene.id)"
                    >
                      <img v-if="hasAssetImage(scene)" :src="assetImageUrl(scene)" class="cover-img" alt="" />
                      <div v-else-if="scene.error_msg || scene.errorMsg" class="cover-placeholder error" :title="scene.error_msg || scene.errorMsg">{{ scene.error_msg || scene.errorMsg }}</div>
                      <div v-else class="cover-placeholder">{{ $t('t108') }}</div>
                      <div v-if="dragOverResourceKey === 'scene-' + scene.id" class="asset-cover-drop-hint">{{ $t('t109') }}</div>
                    </div>
                    <div v-if="parseExtraImages(scene).length" class="extra-images-strip">
                      <div v-for="ep in parseExtraImages(scene)" :key="ep" class="extra-thumb" :title="$t('t110')">
                        <img :src="localPathToUrl(ep)" alt="" @click="onSetPrimaryImage('scene', scene, ep)" />
                        <button class="thumb-preview-btn" :title="$t('t111')" @click.stop="openImagePreview(localPathToUrl(ep))">
                          <el-icon :size="10"><ZoomIn /></el-icon>
                        </button>
                        <button class="extra-thumb-remove" :title="$t('t112')" @click.stop="onRemoveExtraImage('scene', scene, ep)">×</button>
                      </div>
                    </div>
                    <div class="asset-cover-actions">
                      <el-tooltip :content="sceneUseQuadGrid ? $t('t129') : $t('t130')" placement="top">
                        <el-button type="primary" size="small" :loading="generatingSceneIds.has(scene.id)" @click="onGenerateSceneImage(scene, sceneUseQuadGrid)">
                          <el-icon v-if="!generatingSceneIds.has(scene.id)"><MagicStick /></el-icon>
                          {{ $t('t113') }}
                        </el-button>
                      </el-tooltip>
                      <el-button type="success" size="small" :loading="uploadingResourceId === 'scene-' + scene.id" @click="onUploadResourceClick('scene', scene.id)">
                        <el-icon v-if="uploadingResourceId !== 'scene-' + scene.id"><Upload /></el-icon>
                        {{ $t('t114') }}
                      </el-button>
                    </div>
                  </div>
                </div>
                <div v-if="scenes.length === 0" class="empty-tip">{{ $t('t131') }}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 6. 分镜生成 -->
      <section id="anchor-storyboard" class="section card">
        <h2 class="section-title">
          <span>{{ $t('t132') }}</span>
          <span class="step-desc">{{ $t('t133') }}</span>
        </h2>
        <div class="sb-config-row">
          <label class="sb-config-item">
            <span class="sb-config-label">{{ $t('t134') }}</span>
            <el-input-number v-model="storyboardCount" :min="1" :max="200" :step="5" :placeholder="$t('t135')" class="sb-config-input" />
            <span class="sb-config-hint sb-config-hint--estimate" :title="scriptEstimateStoryboardTitle">{{ $t('t136') }}{{ scriptEstimateStoryboardHint }}</span>
          </label>
          <span class="sb-config-divider">｜</span>
          <label class="sb-config-item">
            <span class="sb-config-label">{{ $t('t137') }}</span>
            <el-input-number v-model="videoDuration" :min="10" :max="600" :step="5" :placeholder="$t('t135')" class="sb-config-input" />
            <span class="sb-config-hint sb-config-hint--estimate" :title="scriptEstimateVideoDurationTitle">{{ $t('t136') }}{{ scriptEstimateVideoDurationHint }}</span>
          </label>
          <span class="sb-config-divider">｜</span>
          <label class="sb-config-item">
            <span class="sb-config-label">{{ $t('t138') }}</span>
            <el-select v-model="gridMode" size="small" style="width:110px" :disabled="storyboardUseFirstLastFrame">
              <el-option :label="$t('t139')" value="single" />
              <el-option :label="$t('t140')" value="quad_grid" />
              <el-option :label="$t('t141')" value="nine_grid" />
            </el-select>
            <span class="sb-config-hint">{{ $t('t142') }}</span>
          </label>
        </div>
        <div class="sb-config-row sb-narration-export-row" style="margin-top:10px;flex-wrap:wrap;align-items:center;gap:12px">
          <el-checkbox v-model="storyboardUseFirstLastFrame" @change="onStoryboardUseFirstLastFrameChange">
            {{ $t('t143') }}
          </el-checkbox>
          <el-checkbox v-model="storyboardUniversalOmni" @change="() => saveProjectSettings(false)">
            {{ $t('t144') }}
          </el-checkbox>
          <el-checkbox v-model="storyboardIncludeNarration" @change="() => saveProjectSettings(false)">
            {{ $t('t145') }}
          </el-checkbox>
          <el-button
            v-if="storyboards.length > 0"
            class="sb-export-srt-btn"
            size="small"
            plain
            type="primary"
            :disabled="!currentEpisodeId"
            :loading="exportingStoryboardSheet"
            @click="onExportStoryboardSheet"
          >
            {{ $t('t146') }}
          </el-button>
          <el-button
            v-if="storyboards.length > 0"
            class="sb-export-srt-btn"
            size="small"
            plain
            type="primary"
            :disabled="!currentEpisodeId"
            @click="onExportNarrationSrt"
          >
            {{ $t('t147') }}
          </el-button>
        </div>
        <div class="asset-actions sb-batch-actions">
          <div class="flex">
            <el-button
              type="primary"
              size="large"
              :loading="storyboardGenerating || universalOmniPolishRunning"
              :disabled="!currentEpisodeId || storyboardGenerating || universalOmniPolishRunning"
              @click="onGenerateStoryboard"
            >
              {{ storyboards.length > 0 ? $t('t148') : $t('t149') }}
            </el-button>
            <ElButton type="info" plain size="large" @click="onAddSingleStoryboard">
            {{ $t('t150') }}
            </ElButton>
          </div>
          <template v-if="storyboards.length > 0">
            <div class="sb-batch-right">
              <el-button
                type="success"
                plain
                size="large"
                :loading="batchImageRunning"
                :disabled="!currentEpisodeId || batchImageRunning || batchVideoRunning || pipelineRunning || storyboardGenerating || universalOmniPolishRunning"
                @click="startBatchImageGeneration"
              >
                {{ $t('t151') }}
              </el-button>
              <el-button
                type="warning"
                plain
                size="large"
                :loading="batchVideoRunning"
                :disabled="!currentEpisodeId || batchImageRunning || batchVideoRunning || pipelineRunning || storyboardGenerating || universalOmniPolishRunning"
                @click="startBatchVideoGeneration"
              >
                {{ $t('t152') }}
              </el-button>
              <el-button v-if="batchImageRunning" size="large" type="danger" plain @click="batchImageStopping = true">{{ $t('t153') }}</el-button>
              <el-button v-if="batchVideoRunning" size="large" type="danger" plain @click="batchVideoStopping = true">{{ $t('t154') }}</el-button>
            </div>
            <!-- 连贯帧模式 UI 暂时隐藏（保留变量与批量生成逻辑，后续可快速恢复） -->
            <div v-if="false" class="batch-video-options" style="margin-top:8px;display:flex;align-items:center;gap:8px;font-size:13px;">
              <el-checkbox v-model="videoFrameContiguity" size="small">
                {{ $t('t155') }}
              </el-checkbox>
              <el-tooltip placement="top" :show-after="100">
                <template #content>
                  <div style="max-width:320px;line-height:1.7">
                    <div style="font-weight:600;margin-bottom:4px">{{ $t('t156') }}</div>
                    <div>{{ $t('t157') }}<b>{{ $t('t158') }}</b>{{ $t('t159') }}<b>{{ $t('t160') }}</b>{{ $t('t161') }}</div>
                    <div style="margin-top:8px;font-weight:600">{{ $t('t162') }}</div>
                    <div style="margin-top:4px">
                      {{ $t('t163') }}<br/>
                      {{ $t('t164') }}
                    </div>
                    <div style="margin-top:8px;color:#faad14">{{ $t('t165') }}</div>
                  </div>
                </template>
                <el-icon style="color:#9ca3af;cursor:help"><QuestionFilled /></el-icon>
              </el-tooltip>
            </div>
          </template>
        </div>
        <!-- 批量生成进度 -->
        <div v-if="batchImageRunning || batchVideoRunning || batchImageErrors.length || batchVideoErrors.length" class="batch-status">
          <div v-if="batchImageRunning" class="batch-progress">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span>{{ $t('t166') }}{{ batchImageProgress.current }}/{{ batchImageProgress.total }}</span>
            <span v-if="batchImageProgress.failed > 0" class="batch-failed">{{ batchImageProgress.failed }} {{ $t('t167') }}</span>
            <span v-if="batchImageStopping" class="batch-stopping">{{ $t('t168') }}</span>
          </div>
          <div v-if="batchVideoRunning" class="batch-progress">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span>{{ $t('t169') }}{{ batchVideoProgress.current }}/{{ batchVideoProgress.total }}</span>
            <span v-if="batchVideoProgress.failed > 0" class="batch-failed">{{ batchVideoProgress.failed }} {{ $t('t167') }}</span>
            <span v-if="batchVideoStopping" class="batch-stopping">{{ $t('t168') }}</span>
          </div>
          <div v-if="batchImageErrors.length > 0" class="batch-error-log">
            <div class="batch-error-title">{{ $t('t170') }}</div>
            <div v-for="(e, i) in batchImageErrors" :key="i" class="batch-error-line">{{ e }}</div>
          </div>
          <div v-if="batchVideoErrors.length > 0" class="batch-error-log">
            <div class="batch-error-title">{{ $t('t171') }}</div>
            <div v-for="(e, i) in batchVideoErrors" :key="i" class="batch-error-line">{{ e }}</div>
          </div>
        </div>
        <div v-if="storyboardGenerating || universalOmniPolishRunning" class="storyboard-generating-tip">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span v-if="universalOmniPolishRunning">
            {{ $t('t172') }} {{ universalOmniPolishProgress.current }} / {{ universalOmniPolishProgress.total }} {{ $t('t173') }}
            <template v-if="universalOmniPolishProgress.label">（{{ universalOmniPolishProgress.label }}）</template>
            …
          </span>
          <span v-else>{{ $t('t174') }}</span>
        </div>
        <div v-if="sbTruncatedWarning && !sbTruncatedDismissed && storyboards.length > 0" class="sb-truncated-warning">
          <el-icon><WarningFilled /></el-icon>
          <span>{{ $t('t175') }}</span>
          <el-button size="small" text @click="sbTruncatedDismissed = true">{{ $t('t176') }}</el-button>
        </div>
        <el-radio-group v-if="storyboards.length > 0" v-model="storyboardViewMode" size="small" style="margin-bottom: 12px;">
          <el-radio-button value="list">{{ $t('storyboardBoard.listView') }}</el-radio-button>
          <el-radio-button value="board">{{ $t('storyboardBoard.boardView') }}</el-radio-button>
        </el-radio-group>
        <template v-if="storyboards.length > 0 && storyboardViewMode === 'list'">
          <template v-for="(sb, i) in storyboards" :key="sb.id">
            <!-- 段落分隔标头：segment_title 存在且是新段落的第一个镜头时显示 -->
            <div
              v-if="sb.segment_title && (i === 0 || sb.segment_index !== storyboards[i - 1].segment_index)"
              class="segment-header"
            >
              <div class="segment-header-inner">
                <span class="segment-index-badge">{{ $t('t005') }} {{ (sb.segment_index ?? 0) + 1 }} {{ $t('t177') }}</span>
                <span class="segment-title-text">{{ sb.segment_title }}</span>
                <span class="segment-shot-range">
                  {{ $t('t178') }} {{ i + 1 }}–{{ (() => {
                    let end = i
                    while (end + 1 < storyboards.length && storyboards[end + 1].segment_index === sb.segment_index) end++
                    return end + 1
                  })() }}
                </span>
              </div>
            </div>
          <!-- 分镜控制栏（卡片外，缩进表示属于当前幕） -->
          <div class="sb-ctrl-bar">
            <span class="sb-ctrl-num">{{ i + 1 }}</span>
            <span class="sb-ctrl-title">{{ sb.title || $t('t179') }}</span>
            <el-tag v-if="sb.movement" size="small" effect="plain" type="info" class="sb-movement-tag">{{ getMovementLabel(sb.movement) }}</el-tag>
            <el-button size="small" plain class="sb-ctrl-btn sb-ctrl-config-btn" @click="onOpenVideoParamsDialog(sb)">{{ $t('t180') }}</el-button>
            <el-button
              size="small"
              plain
              class="sb-ctrl-btn sb-ctrl-mode-btn"
              :title="isSbUniversalMode(sb.id) ? $t('t181') : $t('t182')"
              @click="onToggleSbUniversalMode(sb)"
            >
              {{ isSbUniversalMode(sb.id) ? $t('t183') : $t('t184') }}
            </el-button>
            <el-button size="small" plain class="sb-ctrl-btn" :title="$t('t185')" @click="onInsertStoryboardBefore(sb)">{{ $t('t186') }}</el-button>
            <el-button
              class="sb-ctrl-delete"
              type="danger"
              text
              size="small"
              :title="$t('t187', { arg0: i + 1 })"
              @click="onDeleteSingleStoryboard(sb.id)"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
          <div :id="'sb-' + sb.id" class="storyboard-row">
            <!-- 左：分镜脚本 -->
            <div class="sb-panel sb-script">
              <div class="sb-script-row sb-script-selects">
                <el-select
                  :model-value="getSbCharacterIds(sb.id)"
                  :placeholder="$t('t188')"
                  multiple
                  collapse-tags
                  collapse-tags-tooltip
                  size="small"
                  class="sb-select"
                  @update:model-value="(v) => setSbCharacterIds(sb.id, v)"
                >
                  <el-option
                    v-for="c in (characters || [])"
                    :key="String(c.id)"
                    :label="c.name || $t('t061')"
                    :value="c.id"
                  />
                  <template v-if="!(characters || []).length" #empty>
                    <span class="sb-select-empty">{{ $t('t189') }}</span>
                  </template>
                </el-select>
                <el-select
                  v-model="sbSceneId[sb.id]"
                  :placeholder="$t('t190')"
                  clearable
                  size="small"
                  class="sb-select"
                  @change="() => onStoryboardSceneChange(sb.id)"
                >
                  <el-option
                    v-for="s in (scenes || [])"
                    :key="s.id"
                    :label="s.location"
                    :value="s.id"
                  />
                </el-select>
                <el-select
                  :model-value="getSbPropIds(sb.id)"
                  :placeholder="$t('t191')"
                  multiple
                  collapse-tags
                  collapse-tags-tooltip
                  size="small"
                  class="sb-select"
                  @update:model-value="(v) => setSbPropIds(sb.id, v)"
                >
                  <el-option
                    v-for="p in (props || [])"
                    :key="String(p.id)"
                    :label="p.name || $t('t061')"
                    :value="p.id"
                  />
                  <template v-if="!(props || []).length" #empty>
                    <span class="sb-select-empty">{{ $t('t192') }}</span>
                  </template>
                </el-select>
              </div>
              <!-- 当前选中：场景 / 角色 / 物品缩略图 -->
              <div v-if="getSbSelectedScene(sb.id) || getSbSelectedCharacters(sb.id).length || getSbSelectedProps(sb.id).length || (characters || []).length" class="sb-selected-thumbs">
                <div v-if="getSbSelectedScene(sb.id)" class="sb-thumb-row">
                  <span class="sb-thumb-label">{{ $t('t193') }}</span>
                  <div class="sb-thumb-list">
                    <div
                      v-for="s in [getSbSelectedScene(sb.id)]"
                      :key="s.id"
                      class="sb-thumb-item sb-thumb-scene"
                      :class="{ 'sb-thumb-clickable': hasAssetImage(s) }"
                      :title="s.location"
                      role="button"
                      @click="hasAssetImage(s) && openImagePreview(assetImageUrl(s))"
                    >
                      <img v-if="hasAssetImage(s)" :src="assetImageUrl(s)" alt="" />
                      <span v-else class="sb-thumb-placeholder">{{ (s.location || '')[0] }}</span>
                    </div>
                  </div>
                </div>
                <div v-if="(characters || []).length" class="sb-thumb-row">
                  <span class="sb-thumb-label">{{ $t('t194') }}</span>
                  <div class="sb-thumb-list">
                    <div
                      v-for="c in getSbSelectedCharacters(sb.id)"
                      :key="c.id"
                      class="sb-thumb-item sb-thumb-avatar"
                      :class="{ 'sb-thumb-clickable': hasAssetImage(c) }"
                      :title="c.name"
                      role="button"
                      @click="hasAssetImage(c) && openImagePreview(assetImageUrl(c))"
                    >
                      <img v-if="hasAssetImage(c)" :src="assetImageUrl(c)" alt="" />
                      <span v-else class="sb-thumb-placeholder">{{ (c.name || '')[0] }}</span>
                    </div>
                    <el-dropdown trigger="click" @command="(cmd) => onSbAddCharacterCommand(sb.id, cmd)">
                      <div
                        class="sb-thumb-item sb-thumb-avatar sb-thumb-add-char"
                        :title="$t('t093')"
                        role="button"
                        @click.stop
                      >
                        <el-icon><Plus /></el-icon>
                      </div>
                      <template #dropdown>
                        <el-dropdown-menu class="sb-char-add-dropdown">
                          <el-dropdown-item
                            v-for="c in charactersAvailableToAddToSb(sb.id)"
                            :key="c.id"
                            :command="c.id"
                          >
                            {{ c.name || $t('t061') }}
                          </el-dropdown-item>
                          <el-dropdown-item v-if="!charactersAvailableToAddToSb(sb.id).length" disabled>
                            {{ $t('t195') }}
                          </el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
                  </div>
                </div>
                <div v-if="getSbSelectedProps(sb.id).length" class="sb-thumb-row">
                  <span class="sb-thumb-label">{{ $t('t196') }}</span>
                  <div class="sb-thumb-list">
                    <div
                      v-for="p in getSbSelectedProps(sb.id)"
                      :key="p.id"
                      class="sb-thumb-item sb-thumb-prop"
                      :class="{ 'sb-thumb-clickable': hasAssetImage(p) }"
                      :title="p.name"
                      role="button"
                      @click="hasAssetImage(p) && openImagePreview(assetImageUrl(p))"
                    >
                      <img v-if="hasAssetImage(p)" :src="assetImageUrl(p)" alt="" />
                      <span v-else class="sb-thumb-placeholder">{{ (p.name || '')[0] }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <!-- 首尾帧模式下隐藏“图片提示词”入口，统一收敛到首/尾帧槽位的“查看提示词” -->
              <div v-if="!storyboardUseFirstLastFrame" class="sb-prompt-label">
                <span class="sb-dot"></span>
                <span>{{ $t('t197') }}</span>
              </div>
              <div v-if="!storyboardUseFirstLastFrame" class="sb-prompt-row">
                <span class="sb-prompt-text">{{ sb.image_prompt || $t('t198') }}</span>
                <el-button size="small" link type="primary" @click="onOpenSbPromptDialog(sb)">{{ $t('t097') }}</el-button>
              </div>
              <template v-if="storyboardIncludeNarration || (sbNarration[sb.id] || '').trim() || (sb.narration || '').trim()">
                <div class="sb-prompt-label">
                  <span class="sb-dot"></span>
                  <span>{{ $t('t199') }}</span>
                </div>
                <el-input
                  v-model="sbNarration[sb.id]"
                  type="textarea"
                  :rows="2"
                  :placeholder="$t('t200')"
                  class="sb-narration-input"
                  @blur="() => onSaveSbNarrationField(sb)"
                />
                <div v-if="(sbNarration[sb.id] || sb.narration || '').toString().trim()" class="sb-narration-actions">
                  <el-tooltip :content="$t('t201')" placement="top">
                    <el-button size="small" :loading="ttsSbNarrationIds.has(sb.id)" @click="onTtsSbNarration(sb)">
                      {{ $t('t202') }}
                    </el-button>
                  </el-tooltip>
                  <el-tooltip v-if="sbNarrationAudioRelPath(sb)" :content="$t('t203')" placement="top">
                    <el-button size="small" @click="playSbNarrationTts(sb)">
                      <el-icon><VideoPlay /></el-icon>
                    </el-button>
                  </el-tooltip>
                </div>
              </template>
            </div>
            <!-- 中：经典模式=分镜参考图；全能模式=片段描述（独立字段，与参考图并存） -->
            <div class="sb-panel sb-image" :class="{ 'sb-image--universal': isSbUniversalMode(sb.id) }">
              <template v-if="isSbUniversalMode(sb.id)">
                <div class="sb-prompt-label sb-universal-label-row">
                  <div class="sb-universal-label-left">
                    <span class="sb-dot"></span>
                    <span>{{ $t('t204') }}</span>
                    <el-tooltip placement="top" :show-after="280" :show-arrow="false" popper-class="sb-universal-tooltip-popper">
                      <template #content>
                        <div class="sb-universal-tooltip">
                          {{ $t('t205') }}<strong>{{ $t('t206') }}</strong> {{ $t('t207') }}<code>kling_omni</code> {{ $t('t208') }} <code>volcengine_omni</code> {{ $t('t209') }} <code>kling-video-o1</code>、<code>doubao-seedance-2-0-260128</code> {{ $t('t210') }}<strong>{{ $t('t211') }}</strong>{{ $t('t212') }}<strong>{{ $t('t213') }}</strong>{{ $t('t214') }} <strong>{{ $t('t215') }}</strong>、<strong>{{ $t('t216') }}</strong>…（<strong>{{ $t('t217') }}</strong>{{ $t('t218') }} <strong>{{ $t('t215') }}</strong> {{ $t('t219') }} <strong>{{ $t('t216') }}</strong> {{ $t('t220') }}<strong>{{ $t('t221') }}</strong>{{ $t('t222') }}<strong>{{ $t('t223') }}</strong>{{ $t('t224') }}<strong>{{ $t('t225') }}</strong>{{ $t('t226') }}<strong>{{ $t('t227') }}</strong>{{ $t('t228') }}
                        </div>
                      </template>
                      <el-icon class="sb-universal-hint-icon" tabindex="0" role="img" :aria-label="$t('t229')">
                        <QuestionFilled />
                      </el-icon>
                    </el-tooltip>
                  </div>
                  <el-dropdown
                    trigger="click"
                    class="sb-universal-prompt-dd"
                    @command="(cmd) => onUniversalSegmentPromptMenu(sb, cmd)"
                  >
                    <el-button
                      type="primary"
                      link
                      size="small"
                      class="sb-universal-gen-btn"
                      :loading="generatingUniversalSegmentIds.has(sb.id)"
                    >
                      {{ $t('t230') }}
                      <el-icon class="sb-universal-dd-caret"><ArrowDown /></el-icon>
                    </el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="generate">{{ $t('t231') }}</el-dropdown-item>
                        <el-dropdown-item command="generate-force">{{ $t('t232') }}</el-dropdown-item>
                        <el-dropdown-item command="polish" :disabled="!sbUniversalSegmentTrimmed(sb)">
                          {{ $t('t233') }}
                        </el-dropdown-item>
                        <el-dropdown-item command="polish-force" :disabled="!sbUniversalSegmentTrimmed(sb)">
                          {{ $t('t234') }}
                        </el-dropdown-item>
                        <el-dropdown-item
                          command="to-grok-video-tags"
                          divided
                          :disabled="!sbUniversalSegmentTrimmed(sb)"
                        >
                          {{ $t('t235') }}
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
                <UniversalSegmentOmniAtEditor
                  v-if="!generatingUniversalSegmentIds.has(sb.id)"
                  v-model="sbUniversalSegmentText[sb.id]"
                  :slots="getSbUniversalOmniRefSlots(sb)"
                  class="sb-universal-textarea"
                  @blur="() => onSaveUniversalSegmentField(sb)"
                />
                <el-input
                  v-else
                  v-model="sbUniversalSegmentText[sb.id]"
                  type="textarea"
                  :rows="10"
                  :autosize="{ minRows: 10, maxRows: 22 }"
                  :placeholder="$t('t236')"
                  class="sb-universal-textarea"
                  @blur="() => onSaveUniversalSegmentField(sb)"
                />
              </template>
              <template v-else>
              <div
                class="sb-image-area"
                :class="{
                  'sb-image-area--dragover': dragOverSbId === sb.id,
                  'sb-image-area--has-quad': !storyboardUseFirstLastFrame && getStripItems(sb.id).length > 0,
                  'sb-image-area--first-last': storyboardUseFirstLastFrame,
                }"
                @dragover="onSbImageDragOver($event, sb.id)"
                @dragleave="onSbImageDragLeave($event, sb.id)"
                @drop="onSbImageDrop($event, sb)"
              >
                <!-- 首尾帧双槽 -->
                <template v-if="storyboardUseFirstLastFrame">
                  <div class="sb-fl-dual">
                    <div class="sb-fl-slot">
                      <div class="sb-fl-slot-label">{{ $t('t237') }}</div>
                      <div class="sb-fl-slot-body">
                        <template v-if="getSbFirstImage(sb.id)">
                          <img
                            :src="assetImageUrl(getSbFirstImage(sb.id))"
                            class="sb-generated-img"
                            alt=""
                            @click="openImagePreview(assetImageUrl(getSbFirstImage(sb.id)))"
                          />
                        </template>
                        <template v-else-if="sb.image_url || sb.composed_image">
                          <img
                            :src="imageUrl(sb.composed_image || sb.image_url)"
                            class="sb-generated-img"
                            alt=""
                            @click="openImagePreview(imageUrl(sb.composed_image || sb.image_url))"
                          />
                        </template>
                        <template v-else>
                          <span class="sb-fl-empty">{{ $t('t238') }}</span>
                        </template>
                      </div>
                      <div v-if="getSbFirstImage(sb.id)?.prompt" class="sb-fl-slot-prompt" :title="getSbFirstImage(sb.id).prompt">
                        {{ getSbFirstImage(sb.id).prompt }}
                      </div>
                      <div class="sb-fl-slot-actions">
                        <el-button type="primary" size="small" :loading="generatingSbFirstImageIds.has(sb.id)" @click="onGenerateSbFrameImage(sb, 'first')">{{ $t('t239') }}</el-button>
                        <el-tooltip v-if="canUsePrevTailAsFirst(sb)" :content="$t('t240')" placement="top">
                          <el-button size="small" :loading="usingPrevTailAsFirstIds.has(sb.id)" @click="onUsePrevTailAsFirst(sb)">{{ $t('t241') }}</el-button>
                        </el-tooltip>
                        <el-button size="small" :loading="uploadingSbImageSlot(sb.id) === 'first'" @click="onUploadSbImageClick(sb, 'first')">{{ $t('t114') }}</el-button>
                        <el-button type="primary" link size="small" @click="showSbFramePromptPreview(sb, 'first')">{{ $t('t242') }}</el-button>
                      </div>
                    </div>
                    <div class="sb-fl-arrow" aria-hidden="true">→</div>
                    <div class="sb-fl-slot">
                      <div class="sb-fl-slot-label">{{ $t('t243') }}</div>
                      <div class="sb-fl-slot-body">
                        <template v-if="getSbLastImage(sb.id)">
                          <img
                            :src="assetImageUrl(getSbLastImage(sb.id))"
                            class="sb-generated-img"
                            alt=""
                            :title="getSbLastImage(sb.id).prompt || ''"
                            @click="openImagePreview(assetImageUrl(getSbLastImage(sb.id)))"
                          />
                        </template>
                        <template v-else>
                          <span class="sb-fl-empty">{{ $t('t244') }}</span>
                        </template>
                      </div>
                      <div v-if="getSbLastImage(sb.id)?.prompt" class="sb-fl-slot-prompt" :title="getSbLastImage(sb.id).prompt">
                        {{ getSbLastImage(sb.id).prompt }}
                      </div>
                      <div class="sb-fl-slot-actions">
                        <el-button type="primary" size="small" :loading="generatingSbLastImageIds.has(sb.id)" @click="onGenerateSbFrameImage(sb, 'last')">{{ $t('t239') }}</el-button>
                        <el-checkbox
                          v-model="lastFrameUseFirstLayoutLock"
                          class="sb-fl-first-lock-opt"
                          :title="$t('t245')"
                          @change="onLastFrameLayoutLockChange"
                        >
                          {{ $t('t246') }}
                        </el-checkbox>
                        <el-button size="small" :loading="uploadingSbImageSlot(sb.id) === 'last'" @click="onUploadSbImageClick(sb, 'last')">{{ $t('t114') }}</el-button>
                        <el-button type="primary" link size="small" @click="showSbFramePromptPreview(sb, 'last')">{{ $t('t242') }}</el-button>
                      </div>
                    </div>
                  </div>
                  <div v-if="getStripItems(sb.id).length" class="sb-imgs-strip">
                    <el-tooltip :content="$t('t247')" placement="top" :show-arrow="false">
                      <el-icon class="sb-strip-hint-icon"><InfoFilled /></el-icon>
                    </el-tooltip>
                    <div
                      v-for="item in getStripItems(sb.id)"
                      :key="item.key"
                      class="sb-img-thumb"
                      :title="stripItemTitle(sb.id, item)"
                      @click="onStripItemClick(sb, item)"
                    >
                      <img :src="item.src" alt="" />
                      <span v-if="item.frameBadge" class="sb-img-thumb-label">{{ item.frameBadge }}</span>
                      <span v-else-if="item.label" class="sb-img-thumb-label">{{ item.label }}</span>
                      <button class="thumb-preview-btn" :title="$t('t111')" @click.stop="openImagePreview(item.src)">
                        <el-icon :size="10"><ZoomIn /></el-icon>
                      </button>
                      <button v-if="item.img?.id" class="extra-thumb-remove" :title="$t('t248')" @click.stop="onRemoveSbHistoryImage(sb.id, item.img.id)">×</button>
                    </div>
                  </div>
                </template>
                <!-- 单主图（未勾选首尾帧） -->
                <template v-else>
                <div class="sb-main-image-wrap">
                  <template v-if="getSbImage(sb.id)">
                    <img
                      :src="assetImageUrl(getSbImage(sb.id))"
                      class="sb-generated-img"
                      alt=""
                      :title="getSbImage(sb.id).prompt || ''"
                      @click="openImagePreview(assetImageUrl(getSbImage(sb.id)))"
                    />
                    <div v-if="getSbImage(sb.id).prompt" class="sb-main-img-prompt">{{ getSbImage(sb.id).prompt }}</div>
                  </template>
                  <template v-else-if="sb.composed_image || sb.image_url">
                    <img
                      :src="imageUrl(sb.composed_image || sb.image_url)"
                      class="sb-generated-img"
                      alt=""
                      @click="openImagePreview(imageUrl(sb.composed_image || sb.image_url))"
                    />
                  </template>
                  <template v-else-if="sb.error_msg || sb.errorMsg">
                    <div class="sb-image-error" :title="sb.error_msg || sb.errorMsg">{{ sb.error_msg || sb.errorMsg }}</div>
                    <el-button type="primary" size="small" class="sb-gen-btn" :loading="generatingSbImageIds.has(sb.id)" @click="onGenerateSbImage(sb)">
                      <el-icon><Refresh /></el-icon>
                      {{ $t('t249') }}
                    </el-button>
                    <el-button size="small" :loading="uploadingSbImageId === sb.id" @click="onUploadSbImageClick(sb)">{{ $t('t114') }}</el-button>
                  </template>
                  <template v-else>
                    <el-button type="primary" size="small" class="sb-gen-btn" :loading="generatingSbImageIds.has(sb.id)" @click="onGenerateSbImage(sb)">
                      <el-icon><MagicStick /></el-icon>
                      {{ $t('t250') }}
                    </el-button>
                    <el-button size="small" :loading="uploadingSbImageId === sb.id" @click="onUploadSbImageClick(sb)">{{ $t('t114') }}</el-button>
                  </template>
                </div>
                <div v-if="getStripItems(sb.id).length" class="sb-imgs-strip">
                  <el-tooltip :content="$t('t251')" placement="top" :show-arrow="false">
                    <el-icon class="sb-strip-hint-icon"><InfoFilled /></el-icon>
                  </el-tooltip>
                  <div
                    v-for="item in getStripItems(sb.id)"
                    :key="item.key"
                    class="sb-img-thumb"
                    :title="[item.label, item.prompt].filter(Boolean).join('\n\n') || $t('t252')"
                    @click="onSelectStripItem(sb, item)"
                  >
                    <img :src="item.src" alt="" />
                    <span v-if="item.label" class="sb-img-thumb-label">{{ item.label }}</span>
                    <button class="thumb-preview-btn" :title="$t('t111')" @click.stop="openImagePreview(item.src)">
                      <el-icon :size="10"><ZoomIn /></el-icon>
                    </button>
                    <button v-if="item.img?.id" class="extra-thumb-remove" :title="$t('t248')" @click.stop="onRemoveSbHistoryImage(sb.id, item.img.id)">×</button>
                  </div>
                </div>
                </template>
                <div v-if="dragOverSbId === sb.id" class="sb-image-area-drop-hint">{{ $t('t253') }}</div>
              </div>
              <div v-if="hasSbImage(sb) || storyboardUseFirstLastFrame" class="sb-image-actions">
                <template v-if="storyboardUseFirstLastFrame">
                  <el-button size="small" :loading="generatingSbFirstImageIds.has(sb.id) || generatingSbLastImageIds.has(sb.id)" @click="onGenerateSbFramePair(sb)">{{ hasSbFirstLastPair(sb) ? $t('t254') : $t('t255') }}</el-button>
                  <el-tooltip :content="$t('t256')" placement="top">
                    <el-button size="small" :loading="upscalingSbIds.has(sb.id)" :disabled="!getSbLocalImage(sb)" @click="onUpscaleSbImage(sb)">
                      <el-icon><ZoomIn /></el-icon>{{ $t('t257') }}
                    </el-button>
                  </el-tooltip>
                </template>
                <template v-else>
                <el-button size="small" :loading="generatingSbImageIds.has(sb.id)" @click="onGenerateSbImage(sb)">{{ $t('t258') }}</el-button>
                <el-button size="small" :loading="uploadingSbImageId === sb.id" @click="onUploadSbImageClick(sb)">{{ $t('t114') }}</el-button>
                <el-tooltip :content="$t('t259')" placement="top">
                  <el-button
                    size="small"
                    :loading="upscalingSbIds.has(sb.id)"
                    :disabled="!getSbLocalImage(sb)"
                    @click="onUpscaleSbImage(sb)"
                  >
                    <el-icon><ZoomIn /></el-icon>{{ $t('t260') }}
                  </el-button>
                </el-tooltip>
                </template>
              </div>
              </template>
            </div>
            <!-- 右：分镜视频（由 /videos?storyboard_id 拉取）；有视频时仍显示提示词与生成按钮便于调整后重新生成 -->
            <div class="sb-panel sb-video">
              <div v-if="getSbVideo(sb.id)" class="sb-video-area">
                <video
                  v-if="assetVideoUrl(getSbVideo(sb.id))"
                  :key="sbMainVideoPlayerKey(sb.id)"
                  :src="assetVideoUrl(getSbVideo(sb.id))"
                  controls
                  class="sb-video-player"
                  preload="metadata"
                />
                <div
                  v-else
                  class="sb-video-error"
                  :title="getSbVideoError(sb.id) || $t('t261')"
                >
                  {{ getSbVideoError(sb.id) || $t('t262') }}
                </div>
                <span v-if="generatingSbVideoIds.has(sb.id)" class="sb-video-regenerating-overlay">
                  <el-icon class="is-loading"><Loading /></el-icon>
                  {{ $t('t263') }}
                </span>
              </div>
              <div v-else class="sb-video-area sb-video-placeholder">
                <span v-if="generatingSbVideoIds.has(sb.id)" class="sb-video-generating-text">
                  <el-icon class="is-loading"><Loading /></el-icon>
                  {{ $t('t264') }}
                </span>
                <template v-else>
                  <div v-if="getSbVideoError(sb.id)" class="sb-video-error">
                    {{ getSbVideoError(sb.id) }}
                  </div>
                  <el-button
                    type="primary"
                    size="small"
                    class="sb-generate-video-btn"
                    :loading="generatingSbVideoIds.has(sb.id)"
                    :disabled="!sbCanSubmitVideo(sb)"
                    @click="onGenerateSbVideo(sb)"
                  >
                    {{ $t('t265') }}
                  </el-button>
                </template>
              </div>
              <!-- 视频历史条：有多条历史时显示，点击可切换 -->
              <div v-if="getVideoStripItems(sb.id).length" class="sb-videos-strip">
                <el-tooltip :content="$t('t266')" placement="top" :show-arrow="false">
                  <el-icon class="sb-strip-hint-icon"><InfoFilled /></el-icon>
                </el-tooltip>
                <div
                  v-for="item in getVideoStripItems(sb.id)"
                  :key="item.key"
                  class="sb-video-thumb"
                  :title="$t('t267', { arg0: item.label })"
                  @click="onSelectSbMainVideo(sb, item.video)"
                >
                  <video :src="item.src" preload="metadata" class="sb-video-thumb-player" />
                  <span class="sb-video-thumb-label">{{ item.label }}</span>
                </div>
              </div>
              <div v-if="getSbVideo(sb.id)" class="sb-video-actions">
                <el-button size="small" :loading="generatingSbVideoIds.has(sb.id)" :disabled="!sbCanSubmitVideo(sb)" @click="onGenerateSbVideo(sb)">{{ $t('t258') }}</el-button>
                <el-tooltip v-if="getNextStoryboard(sb.id)" :content="$t('t268')" placement="top">
                  <el-button size="small" :loading="linkingTailFrameIds.has(sb.id)" @click="onLinkTailFrameToNext(sb)">{{ $t('t269') }}</el-button>
                </el-tooltip>
                <el-tooltip v-if="sb.dialogue" :content="$t('t270')" placement="top">
                  <el-button size="small" :loading="ttsSbIds.has(sb.id)" @click="onTtsSbDialogue(sb)">
                    {{ $t('t271') }}
                  </el-button>
                </el-tooltip>
                <el-tooltip v-if="sb.dialogue && sbDialogueAudioRelPath(sb)" :content="$t('t272')" placement="top">
                  <el-button size="small" @click="playSbDialogueTts(sb)">
                    <el-icon><VideoPlay /></el-icon>
                  </el-button>
                </el-tooltip>
              </div>
              <div class="sb-video-prompt-label">
                <span class="sb-dot"></span>
                <span>{{ $t('t273') }}</span>
              </div>
              <div class="sb-video-params-bar">
                <span class="sb-video-prompt-text sb-video-prompt-text--preview">{{ sb.video_prompt || $t('t274') }}</span>
                <el-button size="small" link type="primary" @click="onOpenSbPromptDialog(sb)">{{ $t('t275') }}</el-button>
              </div>
            </div>
          </div>
          </template>
        </template>
        <StoryboardBoard
          v-if="storyboards.length > 0 && storyboardViewMode === 'board'"
          :storyboards="storyboards"
          :thumbnails="{}"
          @select="(sb) => { scrollToStoryboard(sb.id) }"
          @reorder="(e) => { console.log('storyboard reorder', e) }"
          @batch-action="(action, ids) => { console.log('storyboard batch-action', action, ids) }"
        />
        <!-- 分镜生成中提示条 -->
        <div v-if="storyboardGenerating || universalOmniPolishRunning" class="sb-generating-tip">
          <span class="sb-gen-dot" /><span class="sb-gen-dot" /><span class="sb-gen-dot" />
          <span v-if="universalOmniPolishRunning" class="sb-gen-text">
            {{ $t('t276') }} {{ universalOmniPolishProgress.current }}/{{ universalOmniPolishProgress.total }}
            <template v-if="universalOmniPolishProgress.label"> · {{ universalOmniPolishProgress.label }}</template>
          </span>
          <span v-else class="sb-gen-text">{{ $t('t277') }}</span>
        </div>
        <div v-else-if="storyboards.length === 0" class="empty-tip">{{ $t('t278') }}</div>
      </section>

      <!-- 7. 视频配置 + AI 模型配置 -->
      <section class="section card">
        <h2 class="section-title">{{ $t('t279') }}</h2>
        <div class="config-grid">
          <el-form-item :label="$t('t280')">
            <el-select v-model="videoResolution" style="width: 160px">
              <el-option label="480p" value="480p" />
              <el-option label="720p" value="720p" />
              <el-option label="1080p" value="1080p" />
            </el-select>
          </el-form-item>
          <!--
          <el-form-item label="配乐">
            <el-select v-model="videoMusic" placeholder="无" clearable style="width: 160px">
              <el-option label="无" value="" />
            </el-select>
          </el-form-item>
          <el-form-item label="音效">
            <el-select v-model="videoSfx" placeholder="无" clearable style="width: 160px">
              <el-option label="无" value="" />
            </el-select>
          </el-form-item>
          <el-form-item label="画质">
            <el-select v-model="videoQuality" style="width: 120px">
              <el-option label="高" value="high" />
              <el-option label="中" value="medium" />
            </el-select>
          </el-form-item>
          -->
          <el-form-item :label="$t('t281')">
            <div class="video-option-row">
              <el-switch v-model="videoSubtitle" />
              <span v-if="videoSubtitle" class="video-option-hint">{{ $t('t282') }}</span>
            </div>
          </el-form-item>
          <el-form-item :label="$t('t283')">
            <div class="video-option-row">
              <el-switch v-model="videoBurnDialogue" />
              <span v-if="videoBurnDialogue" class="video-option-hint">{{ $t('t284') }}</span>
            </div>
          </el-form-item>
          <el-form-item :label="$t('t285')">
            <div class="video-option-row">
              <el-switch v-model="videoWatermark" />
              <el-input
                v-if="videoWatermark"
                v-model="videoWatermarkText"
                :placeholder="$t('t286')"
                maxlength="200"
                show-word-limit
                clearable
                class="video-watermark-input"
              />
            </div>
          </el-form-item>
        </div>
        <p class="config-tip">{{ $t('t287') }}<el-link type="primary" :underline="false" @click="showAiConfigDialog = true">{{ $t('t288') }}</el-link>{{ $t('t289') }}</p>
      </section>

      <!-- 8. 合成视频 -->
      <section id="anchor-video" class="section card">
        <h2 class="section-title">{{ $t('t290') }}</h2>
        <el-button
          type="primary"
          size="large"
          :loading="videoStatus === 'generating'"
          :disabled="!currentEpisodeId || storyboards.length === 0 || videoStatus === 'generating'"
          @click="onGenerateVideo"
        >
          {{ $t('t290') }}
        </el-button>
        <div v-if="videoStatus === 'generating'" class="video-progress">
          <el-progress :percentage="videoProgress" :status="videoProgress >= 100 ? 'success' : undefined" />
          <p>{{ $t('t291') }}</p>
        </div>
        <div v-if="videoStatus === 'done'" class="video-done">
          <el-alert type="success" :title="$t('t292')" show-icon />
        </div>
        <div v-else-if="videoStatus === 'error'" class="video-error">
          <el-alert type="error" :title="videoErrorMsg" show-icon />
        </div>
        <div v-if="currentEpisodeVideoUrl" class="video-preview-wrap">
          <p class="video-preview-label">{{ $t('t293') }}</p>
          <video
            :src="currentEpisodeVideoUrl"
            controls
            class="video-preview-player"
            preload="metadata"
          />
        </div>
      </section>
    </main>

    <!-- 添加道具弹窗 -->
    <el-dialog v-model="showAddProp" :title="$t('t118')" width="600px" @close="() => { addPropForm = { name: '', type: '', description: '', prompt: '' }; addPropAddRefImage = null }">
      <el-form label-width="90px">
        <el-form-item :label="$t('t294')">
          <div class="ref-image-zone">
            <div class="ref-image-box" @click="addPropAddRefFileInput?.click()" @drop.prevent="onRefImageDrop2('addProp', $event)" @dragover.prevent>
              <img v-if="addPropAddRefImage" :src="addPropAddRefImage.dataUrl" class="ref-preview-img" />
              <div v-else class="ref-upload-hint"><span class="ref-upload-icon">🖼</span><span>{{ $t('t295') }}</span></div>
            </div>
            <div v-if="addPropAddRefImage" class="ref-actions">
              <el-button type="primary" size="small" :loading="extractingPropAddDesc" @click="doExtractFromRef2('addProp')">{{ $t('t296') }}</el-button>
              <el-button size="small" @click="addPropAddRefImage = null">{{ $t('t112') }}</el-button>
            </div>
          </div>
        </el-form-item>
        <el-form-item :label="$t('t297')" required>
          <el-input v-model="addPropForm.name" :placeholder="$t('t298')" />
        </el-form-item>
        <el-form-item :label="$t('t299')">
          <el-input v-model="addPropForm.type" :placeholder="$t('t300')" />
        </el-form-item>
        <el-form-item :label="$t('t301')">
          <el-input v-model="addPropForm.description" type="textarea" :rows="3" :placeholder="$t('t301')" />
        </el-form-item>
        <el-form-item :label="$t('t302')">
          <el-input v-model="addPropForm.prompt" type="textarea" :rows="2" :placeholder="$t('t303')" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddProp = false">{{ $t('t304') }}</el-button>
        <el-button type="primary" :loading="addPropSaving" :disabled="!addPropForm.name.trim()" @click="submitAddProp">{{ $t('t305') }}</el-button>
      </template>
    </el-dialog>

    <!-- 隐藏的文件输入框（放在弹窗外层，避免 el-form-item 干扰） -->
    <input ref="addCharRefFileInput" type="file" accept="image/*" style="display:none" @change="onRefImageFileChange('character', $event)" />
    <input ref="addSceneRefFileInput" type="file" accept="image/*" style="display:none" @change="onRefImageFileChange('scene', $event)" />
    <input ref="addPropRefFileInput" type="file" accept="image/*" style="display:none" @change="onRefImageFileChange('prop', $event)" />
    <input ref="addPropAddRefFileInput" type="file" accept="image/*" style="display:none" @change="onRefImageFileChange2('addProp', $event)" />

    <!-- 添加/编辑角色弹窗 -->
    <el-dialog v-model="showEditCharacter" :title="editCharacterForm?.id ? $t('t306') : $t('t093')" width="75%" @close="onCloseCharDialog">
      <el-form v-if="editCharacterForm" label-width="90px">
        <!-- 参考图上传区（新增/编辑均显示） -->
        <el-form-item :label="$t('t294')">
          <div class="ref-image-zone">
            <div class="ref-image-box" @click="addCharRefFileInput?.click()" @drop.prevent="onRefImageDrop('character', $event)" @dragover.prevent>
              <!-- 优先：刚上传的新参考图 -->
              <img v-if="addCharRefImage" :src="addCharRefImage.dataUrl" class="ref-preview-img" />
              <!-- 次之：已保存的参考图 -->
              <img v-else-if="editCharacterForm.ref_image"
                :src="editCharacterForm.ref_image.startsWith('http') ? editCharacterForm.ref_image : '/static/' + editCharacterForm.ref_image"
                class="ref-preview-img" />
              <!-- 最后：主图（半透明，提示可上传参考图替代） -->
              <img v-else-if="editCharacterForm.id && (editCharacterForm.image_url || editCharacterForm.local_path)"
                :src="assetImageUrl(editCharacterForm)"
                class="ref-preview-img" style="opacity:0.5" />
              <div v-else class="ref-upload-hint"><span class="ref-upload-icon">🖼</span><span>{{ $t('t295') }}</span></div>
            </div>
            <div v-if="addCharRefImage" class="ref-actions">
              <el-button type="primary" size="small" :loading="extractingCharAppearance" @click="doExtractFromRef('character')">{{ $t('t296') }}</el-button>
              <el-button size="small" @click="addCharRefImage = null">{{ $t('t112') }}</el-button>
            </div>
            <div v-else-if="editCharacterForm.ref_image" class="ref-actions">
              <el-button type="primary" size="small" :loading="extractingCharAppearance" @click="doExtractCharFromImage">{{ $t('t307') }}</el-button>
              <el-button size="small" @click="clearCharRefImage">{{ $t('t308') }}</el-button>
            </div>
            <div v-else-if="editCharacterForm.id && (editCharacterForm.image_url || editCharacterForm.local_path) && !editCharacterForm.appearance" class="ref-actions">
              <el-button size="small" :loading="extractingCharAppearance" @click="doExtractCharFromImage">{{ $t('t309') }}</el-button>
            </div>
          </div>
        </el-form-item>
        <el-form-item :label="$t('t297')" required>
          <el-input v-model="editCharacterForm.name" :placeholder="$t('t310')" />
        </el-form-item>
        <el-form-item :label="$t('t311')">
          <el-select v-model="editCharacterForm.role" :placeholder="$t('t312')" style="width:200px">
            <el-option value="main" :label="$t('t313')" />
            <el-option value="supporting" :label="$t('t314')" />
            <el-option value="minor" :label="$t('t315')" />
          </el-select>
        </el-form-item>
        <el-form-item :label="$t('t316')">
          <div style="width:100%">
            <el-input v-model="editCharacterForm.appearance" type="textarea" :autosize="{ minRows: 4, maxRows: 10 }" :placeholder="$t('t317')" />
            <el-button v-if="editCharacterForm.id" size="small" type="warning" plain :loading="reextractingFromScript" @click="doReextractFromScript" style="margin-top:6px">从剧本重新提取</el-button>
          </div>
        </el-form-item>
        <el-form-item :label="$t('t318')">
          <el-input v-model="editCharacterForm.description" type="textarea" :autosize="{ minRows: 3, maxRows: 8 }" :placeholder="$t('t319')" />
        </el-form-item>
        <el-form-item v-if="editCharacterForm.id">
          <template #label>
            <span style="font-size:12px;line-height:1.4;white-space:normal;word-break:break-all;display:inline-block;width:90px">{{ $t('t302') }}</span>
          </template>
          <div style="width:100%">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <span style="font-size:12px;color:#909399">{{ $t('t320') }}</span>
              <el-button
                size="small"
                :loading="editCharacterPromptGenerating"
                @click="doGenerateCharacterPrompt"
              >{{ $t('t321') }}</el-button>
            </div>
            <el-input
              v-model="editCharacterForm.polished_prompt"
              type="textarea"
              :autosize="{ minRows: 5, maxRows: 16 }"
              :placeholder="editCharacterPromptGenerating ? $t('t322') : $t('t323')"
              :disabled="editCharacterPromptGenerating"
              style="font-size:12px"
            />
          </div>
        </el-form-item>
        <!-- P0-2: 视觉锚点（identity_anchors） -->
        <el-form-item v-if="editCharacterForm.id" :label="$t('t324')">
          <div style="width:100%">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <span style="font-size:12px;color:#909399">{{ $t('t325') }}</span>
              <el-button
                size="small"
                :loading="extractingAnchors"
                :disabled="!editCharacterForm.appearance"
                @click="extractIdentityAnchors"
              >{{ $t('t326') }}</el-button>
            </div>
            <el-input
              v-if="editCharacterForm.identity_anchors"
              :value="typeof editCharacterForm.identity_anchors === 'string'
                ? editCharacterForm.identity_anchors
                : JSON.stringify(editCharacterForm.identity_anchors, null, 2)"
              type="textarea"
              :rows="4"
              readonly
              style="font-size:11px;font-family:monospace"
              :placeholder="$t('t327')"
            />
            <div v-else style="font-size:12px;color:#c0c4cc;padding:4px 0">{{ $t('t328') }}</div>
          </div>
        </el-form-item>
        <!-- P1-3: 多阶段造型（stages） -->
        <el-form-item v-if="editCharacterForm.id" :label="$t('t329')">
          <div style="width:100%">
            <div style="font-size:12px;color:#909399;margin-bottom:6px">
              {{ $t('t330') }}
            </div>
            <el-input
              v-model="editCharacterForm.stages"
              type="textarea"
              :rows="4"
              :placeholder="$t('t331')"
              style="font-size:12px;font-family:monospace"
            />
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditCharacter = false">{{ $t('t304') }}</el-button>
        <el-button type="primary" :loading="editCharacterSaving" :disabled="!editCharacterForm?.name?.trim()" @click="submitEditCharacter">{{ editCharacterForm?.id ? $t('t332') : $t('t333') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showCharSd2Cert"
      :title="$t('t334')"
      width="min(720px, 92vw)"
      destroy-on-close
      class="sd2-cert-dialog"
    >
      <template v-if="charSd2CertPayload">
        <el-descriptions :column="1" border size="small" class="sd2-cert-desc">
          <el-descriptions-item :label="$t('t335')">
            <span class="sd2-cert-value">{{ charSd2CertPayload.hub_asset_id || '—' }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="asset_url">
            <code class="sd2-cert-value">{{ charSd2CertPayload.asset_url || '—' }}</code>
          </el-descriptions-item>
          <el-descriptions-item :label="$t('t336')">
            <span class="sd2-cert-value">{{ charSd2CertPayload.status || '—' }}</span>
          </el-descriptions-item>
          <el-descriptions-item :label="$t('t337')">
            <span class="sd2-cert-value">{{ charSd2CertPayload.source_image_url || '—' }}</span>
          </el-descriptions-item>
          <el-descriptions-item v-if="charSd2CertPayload.sd2_provider" :label="$t('t338')">
            <span class="sd2-cert-value">{{ charSd2CertPayload.sd2_provider }}</span>
          </el-descriptions-item>
        </el-descriptions>
      </template>
      <template #footer>
        <el-button @click="showCharSd2Cert = false">{{ $t('t176') }}</el-button>
      </template>
    </el-dialog>

    <!-- 编辑道具弹窗 -->
    <el-dialog v-model="showEditProp" :title="editPropForm?.id ? $t('t339') : $t('t118')" width="75%" @close="onClosePropDialog">
      <el-form v-if="editPropForm" label-width="90px">
        <!-- 参考图上传区（新增/编辑均显示） -->
        <el-form-item :label="$t('t294')">
          <div class="ref-image-zone">
            <div class="ref-image-box" @click="addPropRefFileInput?.click()" @drop.prevent="onRefImageDrop('prop', $event)" @dragover.prevent>
              <img v-if="addPropRefImage" :src="addPropRefImage.dataUrl" class="ref-preview-img" />
              <img v-else-if="editPropForm.ref_image"
                :src="editPropForm.ref_image.startsWith('http') ? editPropForm.ref_image : '/static/' + editPropForm.ref_image"
                class="ref-preview-img" />
              <img v-else-if="editPropForm.id && (editPropForm.image_url || editPropForm.local_path)"
                :src="assetImageUrl(editPropForm)" class="ref-preview-img" style="opacity:0.5" />
              <div v-else class="ref-upload-hint"><span class="ref-upload-icon">🖼</span><span>{{ $t('t295') }}</span></div>
            </div>
            <div v-if="addPropRefImage" class="ref-actions">
              <el-button type="primary" size="small" :loading="extractingPropDesc" @click="doExtractFromRef('prop')">{{ $t('t296') }}</el-button>
              <el-button size="small" @click="addPropRefImage = null">{{ $t('t112') }}</el-button>
            </div>
            <div v-else-if="editPropForm.ref_image" class="ref-actions">
              <el-button type="primary" size="small" :loading="extractingPropDesc" @click="doExtractPropFromImage">{{ $t('t307') }}</el-button>
              <el-button size="small" @click="clearPropRefImage">{{ $t('t308') }}</el-button>
            </div>
            <div v-else-if="editPropForm.id && (editPropForm.image_url || editPropForm.local_path) && !editPropForm.description" class="ref-actions">
              <el-button size="small" :loading="extractingPropDesc" @click="doExtractPropFromImage">{{ $t('t309') }}</el-button>
            </div>
          </div>
        </el-form-item>
        <el-form-item :label="$t('t297')" required>
          <el-input v-model="editPropForm.name" :placeholder="$t('t298')" />
        </el-form-item>
        <el-form-item :label="$t('t299')">
          <el-input v-model="editPropForm.type" :placeholder="$t('t300')" />
        </el-form-item>
        <el-form-item :label="$t('t301')">
          <el-input v-model="editPropForm.description" type="textarea" :autosize="{ minRows: 3, maxRows: 8 }" :placeholder="$t('t340')" />
        </el-form-item>
        <el-form-item :label="$t('t302')">
          <div style="width:100%">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <span style="font-size:12px;color:#909399">{{ $t('t341') }}</span>
              <el-button size="small" :loading="editPropPromptGenerating" @click="doGeneratePropPrompt">{{ $t('t321') }}</el-button>
            </div>
            <el-input
              v-model="editPropForm.prompt"
              type="textarea"
              :autosize="{ minRows: 5, maxRows: 16 }"
              :placeholder="editPropPromptGenerating ? $t('t322') : $t('t323')"
              :disabled="editPropPromptGenerating"
            />
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditProp = false">{{ $t('t304') }}</el-button>
        <el-button type="primary" :loading="editPropSaving" :disabled="!editPropForm?.name?.trim()" @click="submitEditProp">{{ $t('t332') }}</el-button>
      </template>
    </el-dialog>

    <!-- 添加/编辑场景弹窗 -->
    <el-dialog v-model="showEditScene" :title="editSceneForm?.id ? $t('t342') : $t('t126')" width="75%" @close="onCloseSceneDialog">
      <el-form v-if="editSceneForm" label-width="90px">
        <!-- 参考图上传区（新增/编辑均显示） -->
        <el-form-item :label="$t('t294')">
          <div class="ref-image-zone">
            <div class="ref-image-box" @click="addSceneRefFileInput?.click()" @drop.prevent="onRefImageDrop('scene', $event)" @dragover.prevent>
              <img v-if="addSceneRefImage" :src="addSceneRefImage.dataUrl" class="ref-preview-img" />
              <img v-else-if="editSceneForm.ref_image"
                :src="editSceneForm.ref_image.startsWith('http') ? editSceneForm.ref_image : '/static/' + editSceneForm.ref_image"
                class="ref-preview-img" />
              <img v-else-if="editSceneForm.id && (editSceneForm.image_url || editSceneForm.local_path)"
                :src="assetImageUrl(editSceneForm)" class="ref-preview-img" style="opacity:0.5" />
              <div v-else class="ref-upload-hint"><span class="ref-upload-icon">🖼</span><span>{{ $t('t295') }}</span></div>
            </div>
            <div v-if="addSceneRefImage" class="ref-actions">
              <el-button type="primary" size="small" :loading="extractingSceneDesc" @click="doExtractFromRef('scene')">{{ $t('t296') }}</el-button>
              <el-button size="small" @click="addSceneRefImage = null">{{ $t('t112') }}</el-button>
            </div>
            <div v-else-if="editSceneForm.ref_image" class="ref-actions">
              <el-button type="primary" size="small" :loading="extractingSceneDesc" @click="doExtractSceneFromImage">{{ $t('t307') }}</el-button>
              <el-button size="small" @click="clearSceneRefImage">{{ $t('t308') }}</el-button>
            </div>
            <div v-else-if="editSceneForm.id && (editSceneForm.image_url || editSceneForm.local_path) && !editSceneForm.prompt" class="ref-actions">
              <el-button size="small" :loading="extractingSceneDesc" @click="doExtractSceneFromImage">{{ $t('t309') }}</el-button>
            </div>
          </div>
        </el-form-item>
        <el-form-item :label="$t('t343')" required>
          <el-input v-model="editSceneForm.location" :placeholder="$t('t344')" />
        </el-form-item>
        <el-form-item :label="$t('t345')">
          <el-input v-model="editSceneForm.time" :placeholder="$t('t346')" />
        </el-form-item>
        <el-form-item :label="$t('t347')">
          <el-input v-model="editSceneForm.prompt" type="textarea" :autosize="{ minRows: 3, maxRows: 8 }" :placeholder="$t('t348')" />
        </el-form-item>
        <el-form-item v-if="editSceneForm.id">
          <template #label>
            <span style="font-size:12px;line-height:1.4;white-space:normal;word-break:break-all;display:inline-block;width:90px">{{ $t('t349') }}</span>
          </template>
          <div style="width:100%">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <span style="font-size:12px;color:#909399">{{ $t('t350') }}</span>
              <el-button size="small" :loading="editScenePromptGenerating" @click="doGenerateSceneSinglePrompt">{{ $t('t321') }}</el-button>
            </div>
            <el-input
              v-model="editSceneForm.polished_prompt_single"
              type="textarea"
              :autosize="{ minRows: 5, maxRows: 16 }"
              :placeholder="$t('t351')"
              style="font-size:12px"
            />
          </div>
        </el-form-item>
        <el-form-item v-if="editSceneForm.id">
          <template #label>
            <span style="font-size:12px;line-height:1.4;white-space:normal;word-break:break-all;display:inline-block;width:90px">{{ $t('t352') }}</span>
          </template>
          <div style="width:100%">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <span style="font-size:12px;color:#909399">{{ $t('t353') }}</span>
              <el-button size="small" :loading="editScenePromptGenerating" @click="doGenerateScenePrompt">{{ $t('t321') }}</el-button>
            </div>
            <el-input
              v-model="editSceneForm.polished_prompt"
              type="textarea"
              :autosize="{ minRows: 5, maxRows: 16 }"
              :placeholder="editScenePromptGenerating ? $t('t354') : $t('t323')"
              :disabled="editScenePromptGenerating"
              style="font-size:12px"
            />
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditScene = false">{{ $t('t304') }}</el-button>
        <el-button type="primary" :loading="editSceneSaving" :disabled="!editSceneForm?.location?.trim()" @click="submitEditScene">{{ editSceneForm?.id ? $t('t332') : $t('t333') }}</el-button>
      </template>
    </el-dialog>

    <!-- 角色资源库（本剧库 / 本剧全部角色 / 团队库） -->
    <el-dialog v-model="showCharLibrary" :title="$t('t355')" width="720px" destroy-on-close class="library-dialog" @open="onCharLibraryDialogOpen">
      <el-tabs v-model="charLibraryTab" class="char-library-tabs" @tab-change="onCharLibraryTabChange">
        <el-tab-pane :label="$t('t094')" name="library">
          <div class="library-toolbar">
            <el-input v-model="charLibraryKeyword" :placeholder="$t('t356')" clearable style="width: 200px" @input="debouncedLoadCharLibrary()" />
          </div>
          <div v-loading="charLibraryLoading" class="library-list">
            <div v-for="item in charLibraryList" :key="'lib-' + item.id" class="library-item">
              <div class="library-item-cover" @click="openImagePreview(assetImageUrl(item))">
                <img v-if="item.image_url || item.local_path" :src="assetImageUrl(item)" alt="" />
                <span v-else class="library-item-placeholder">{{ $t('t108') }}</span>
              </div>
              <div class="library-item-info">
                <div class="library-item-name">{{ item.name || $t('t061') }}</div>
                <div class="library-item-desc">{{ (item.description || '').slice(0, 60) }}{{ (item.description || '').length > 60 ? '…' : '' }}</div>
                <div class="library-item-actions">
                  <el-button size="small" type="primary" :loading="isCharAddToEpisodeLoading('library', item.id)" :disabled="!currentEpisodeId" @click="onAddCharFromLibrary(item)">{{ $t('t357') }}</el-button>
                  <el-button size="small" @click="openEditCharLibrary(item)">{{ $t('t097') }}</el-button>
                  <el-button size="small" type="danger" plain @click="onDeleteCharLibrary(item)">{{ $t('t095') }}</el-button>
                </div>
              </div>
            </div>
            <div v-if="!charLibraryLoading && charLibraryList.length === 0" class="library-empty">{{ $t('t358') }}</div>
          </div>
          <div class="library-pagination">
            <el-pagination
              v-model:current-page="charLibraryPage"
              v-model:page-size="charLibraryPageSize"
              :total="charLibraryTotal"
              :page-sizes="[10, 20, 50]"
              layout="total, sizes, prev, pager, next"
              @current-change="loadCharLibraryList"
              @size-change="loadCharLibraryList"
            />
          </div>
        </el-tab-pane>

        <el-tab-pane :label="$t('t359')" name="drama">
          <div class="library-toolbar">
            <el-input v-model="dramaAllCharKeyword" :placeholder="$t('t356')" clearable style="width: 200px" @input="debouncedLoadDramaAllCharList()" />
          </div>
          <div v-loading="dramaAllCharLoading" class="library-list">
            <div v-for="item in dramaAllCharList" :key="'drama-' + item.id" class="library-item">
              <div class="library-item-cover" @click="openImagePreview(assetImageUrl(item))">
                <img v-if="item.image_url || item.local_path" :src="assetImageUrl(item)" alt="" />
                <span v-else class="library-item-placeholder">{{ $t('t108') }}</span>
              </div>
              <div class="library-item-info">
                <div class="library-item-name">
                  {{ item.name || $t('t061') }}
                  <el-tag v-if="item.role" size="small" type="info" style="margin-left: 6px">{{ charRoleLabel(item.role) }}</el-tag>
                </div>
                <div class="library-item-desc">{{ (item.description || item.appearance || '').slice(0, 60) }}{{ (item.description || item.appearance || '').length > 60 ? '…' : '' }}</div>
                <div class="library-item-actions">
                  <el-button size="small" type="primary" :loading="isCharAddToEpisodeLoading('drama', item.id)" :disabled="!currentEpisodeId" @click="onAddDramaCharToEpisode(item)">{{ $t('t357') }}</el-button>
                </div>
              </div>
            </div>
            <div v-if="!dramaAllCharLoading && dramaAllCharList.length === 0" class="library-empty">{{ $t('t360') }}</div>
          </div>
          <div class="library-pagination">
            <el-pagination
              v-model:current-page="dramaAllCharPage"
              v-model:page-size="dramaAllCharPageSize"
              :total="dramaAllCharTotal"
              :page-sizes="[10, 20, 50]"
              layout="total, sizes, prev, pager, next"
              @current-change="loadDramaAllCharList"
              @size-change="loadDramaAllCharList"
            />
          </div>
        </el-tab-pane>

      </el-tabs>
      <template #footer>
        <el-button @click="showCharLibrary = false">{{ $t('t176') }}</el-button>
      </template>
    </el-dialog>
    <!-- 编辑公共角色 -->
    <el-dialog v-model="showEditCharLibrary" :title="$t('t361')" width="440px" @close="editCharLibraryForm = null">
      <el-form v-if="editCharLibraryForm" label-width="80px">
        <el-form-item :label="$t('t297')">
          <el-input v-model="editCharLibraryForm.name" :placeholder="$t('t310')" />
        </el-form-item>
        <el-form-item :label="$t('t362')">
          <el-input v-model="editCharLibraryForm.category" :placeholder="$t('t363')" />
        </el-form-item>
        <el-form-item :label="$t('t301')">
          <el-input v-model="editCharLibraryForm.description" type="textarea" :rows="3" :placeholder="$t('t363')" />
        </el-form-item>
        <el-form-item :label="$t('t364')">
          <el-input v-model="editCharLibraryForm.tags" :placeholder="$t('t365')" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditCharLibrary = false">{{ $t('t304') }}</el-button>
        <el-button type="primary" :loading="editCharLibrarySaving" @click="submitEditCharLibrary">{{ $t('t332') }}</el-button>
      </template>
    </el-dialog>

    <!-- 道具资源库 -->
    <el-dialog v-model="showPropLibrary" :title="$t('t366')" width="720px" destroy-on-close class="library-dialog" @open="onPropLibraryDialogOpen">
      <el-tabs v-model="propLibraryTab" class="char-library-tabs" @tab-change="onPropLibraryTabChange">
        <el-tab-pane :label="$t('t119')" name="library">
          <div class="library-toolbar">
            <el-input v-model="propLibraryKeyword" :placeholder="$t('t356')" clearable style="width: 200px" @input="debouncedLoadPropLibrary()" />
          </div>
          <div v-loading="propLibraryLoading" class="library-list">
            <div v-for="item in propLibraryList" :key="'plib-' + item.id" class="library-item">
              <div class="library-item-cover" @click="openImagePreview(assetImageUrl(item))">
                <img v-if="item.image_url || item.local_path" :src="assetImageUrl(item)" alt="" />
                <span v-else class="library-item-placeholder">{{ $t('t108') }}</span>
              </div>
              <div class="library-item-info">
                <div class="library-item-name">{{ item.name || $t('t061') }}</div>
                <div class="library-item-desc">{{ (item.description || item.prompt || '').slice(0, 60) }}{{ (item.description || item.prompt || '').length > 60 ? '…' : '' }}</div>
                <div class="library-item-actions">
                  <el-button size="small" type="primary" :loading="isPropAddToEpisodeLoading('library', item.id)" :disabled="!currentEpisodeId" @click="onAddPropFromLibrary(item)">{{ $t('t357') }}</el-button>
                  <el-button size="small" @click="openEditPropLibrary(item)">{{ $t('t097') }}</el-button>
                  <el-button size="small" type="danger" plain @click="onDeletePropLibrary(item)">{{ $t('t095') }}</el-button>
                </div>
              </div>
            </div>
            <div v-if="!propLibraryLoading && propLibraryList.length === 0" class="library-empty">{{ $t('t367') }}</div>
          </div>
          <div class="library-pagination">
            <el-pagination v-model:current-page="propLibraryPage" v-model:page-size="propLibraryPageSize" :total="propLibraryTotal" :page-sizes="[10, 20, 50]" layout="total, sizes, prev, pager, next" @current-change="loadPropLibraryList" @size-change="loadPropLibraryList" />
          </div>
        </el-tab-pane>
        <el-tab-pane :label="$t('t368')" name="drama">
          <div class="library-toolbar">
            <el-input v-model="dramaAllPropKeyword" :placeholder="$t('t356')" clearable style="width: 200px" @input="debouncedLoadDramaAllPropList()" />
          </div>
          <div v-loading="dramaAllPropLoading" class="library-list">
            <div v-for="item in dramaAllPropList" :key="'pdr-' + item.id" class="library-item">
              <div class="library-item-cover" @click="openImagePreview(assetImageUrl(item))">
                <img v-if="item.image_url || item.local_path" :src="assetImageUrl(item)" alt="" />
                <span v-else class="library-item-placeholder">{{ $t('t108') }}</span>
              </div>
              <div class="library-item-info">
                <div class="library-item-name">{{ item.name || $t('t061') }}</div>
                <div class="library-item-desc">{{ (item.description || item.prompt || '').slice(0, 60) }}{{ (item.description || item.prompt || '').length > 60 ? '…' : '' }}</div>
                <div class="library-item-actions">
                  <el-button size="small" type="primary" :loading="isPropAddToEpisodeLoading('drama', item.id)" :disabled="!currentEpisodeId" @click="onAddDramaPropToEpisode(item)">{{ $t('t357') }}</el-button>
                </div>
              </div>
            </div>
            <div v-if="!dramaAllPropLoading && dramaAllPropList.length === 0" class="library-empty">{{ $t('t369') }}</div>
          </div>
          <div class="library-pagination">
            <el-pagination v-model:current-page="dramaAllPropPage" v-model:page-size="dramaAllPropPageSize" :total="dramaAllPropTotal" :page-sizes="[10, 20, 50]" layout="total, sizes, prev, pager, next" @current-change="loadDramaAllPropList" @size-change="loadDramaAllPropList" />
          </div>
        </el-tab-pane>
      </el-tabs>
      <template #footer>
        <el-button @click="showPropLibrary = false">{{ $t('t176') }}</el-button>
      </template>
    </el-dialog>
    <!-- 编辑公共道具 -->
    <el-dialog v-model="showEditPropLibrary" :title="$t('t370')" width="440px" @close="editPropLibraryForm = null">
      <el-form v-if="editPropLibraryForm" label-width="80px">
        <el-form-item :label="$t('t297')">
          <el-input v-model="editPropLibraryForm.name" :placeholder="$t('t298')" />
        </el-form-item>
        <el-form-item :label="$t('t362')">
          <el-input v-model="editPropLibraryForm.category" :placeholder="$t('t363')" />
        </el-form-item>
        <el-form-item :label="$t('t301')">
          <el-input v-model="editPropLibraryForm.description" type="textarea" :rows="3" :placeholder="$t('t363')" />
        </el-form-item>
        <el-form-item :label="$t('t364')">
          <el-input v-model="editPropLibraryForm.tags" :placeholder="$t('t365')" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditPropLibrary = false">{{ $t('t304') }}</el-button>
        <el-button type="primary" :loading="editPropLibrarySaving" @click="submitEditPropLibrary">{{ $t('t332') }}</el-button>
      </template>
    </el-dialog>

    <!-- 场景资源库 -->
    <el-dialog v-model="showSceneLibrary" :title="$t('t371')" width="720px" destroy-on-close class="library-dialog" @open="onSceneLibraryDialogOpen">
      <el-tabs v-model="sceneLibraryTab" class="char-library-tabs" @tab-change="onSceneLibraryTabChange">
        <el-tab-pane :label="$t('t127')" name="library">
          <div class="library-toolbar">
            <el-input v-model="sceneLibraryKeyword" :placeholder="$t('t372')" clearable style="width: 200px" @input="debouncedLoadSceneLibrary()" />
          </div>
          <div v-loading="sceneLibraryLoading" class="library-list">
            <div v-for="item in sceneLibraryList" :key="'slib-' + item.id" class="library-item">
              <div class="library-item-cover" @click="openImagePreview(assetImageUrl(item))">
                <img v-if="item.image_url || item.local_path" :src="assetImageUrl(item)" alt="" />
                <span v-else class="library-item-placeholder">{{ $t('t108') }}</span>
              </div>
              <div class="library-item-info">
                <div class="library-item-name">{{ item.location || item.time || $t('t061') }}</div>
                <div class="library-item-desc">{{ (item.description || item.prompt || '').slice(0, 60) }}{{ (item.description || item.prompt || '').length > 60 ? '…' : '' }}</div>
                <div class="library-item-actions">
                  <el-button size="small" type="primary" :loading="isSceneAddToEpisodeLoading('library', item.id)" :disabled="!currentEpisodeId" @click="onAddSceneFromLibrary(item)">{{ $t('t357') }}</el-button>
                  <el-button size="small" @click="openEditSceneLibrary(item)">{{ $t('t097') }}</el-button>
                  <el-button size="small" type="danger" plain @click="onDeleteSceneLibrary(item)">{{ $t('t095') }}</el-button>
                </div>
              </div>
            </div>
            <div v-if="!sceneLibraryLoading && sceneLibraryList.length === 0" class="library-empty">{{ $t('t373') }}</div>
          </div>
          <div class="library-pagination">
            <el-pagination v-model:current-page="sceneLibraryPage" v-model:page-size="sceneLibraryPageSize" :total="sceneLibraryTotal" :page-sizes="[10, 20, 50]" layout="total, sizes, prev, pager, next" @current-change="loadSceneLibraryList" @size-change="loadSceneLibraryList" />
          </div>
        </el-tab-pane>
        <el-tab-pane :label="$t('t374')" name="drama">
          <div class="library-toolbar">
            <el-input v-model="dramaAllSceneKeyword" :placeholder="$t('t372')" clearable style="width: 200px" @input="debouncedLoadDramaAllSceneList()" />
          </div>
          <div v-loading="dramaAllSceneLoading" class="library-list">
            <div v-for="item in dramaAllSceneList" :key="'sdr-' + item.id" class="library-item">
              <div class="library-item-cover" @click="openImagePreview(assetImageUrl(item))">
                <img v-if="item.image_url || item.local_path" :src="assetImageUrl(item)" alt="" />
                <span v-else class="library-item-placeholder">{{ $t('t108') }}</span>
              </div>
              <div class="library-item-info">
                <div class="library-item-name">{{ item.location || $t('t061') }}<span v-if="item.time" class="library-item-sub"> · {{ item.time }}</span></div>
                <div class="library-item-desc">{{ (item.description || item.prompt || '').slice(0, 60) }}{{ (item.description || item.prompt || '').length > 60 ? '…' : '' }}</div>
                <div class="library-item-actions">
                  <el-button size="small" type="primary" :loading="isSceneAddToEpisodeLoading('drama', item.id)" :disabled="!currentEpisodeId" @click="onAddDramaSceneToEpisode(item)">{{ $t('t357') }}</el-button>
                </div>
              </div>
            </div>
            <div v-if="!dramaAllSceneLoading && dramaAllSceneList.length === 0" class="library-empty">{{ $t('t375') }}</div>
          </div>
          <div class="library-pagination">
            <el-pagination v-model:current-page="dramaAllScenePage" v-model:page-size="dramaAllScenePageSize" :total="dramaAllSceneTotal" :page-sizes="[10, 20, 50]" layout="total, sizes, prev, pager, next" @current-change="loadDramaAllSceneList" @size-change="loadDramaAllSceneList" />
          </div>
        </el-tab-pane>
      </el-tabs>
      <template #footer>
        <el-button @click="showSceneLibrary = false">{{ $t('t176') }}</el-button>
      </template>
    </el-dialog>
    <!-- 编辑公共场景 -->
    <el-dialog v-model="showEditSceneLibrary" :title="$t('t376')" width="440px" @close="editSceneLibraryForm = null">
      <el-form v-if="editSceneLibraryForm" label-width="80px">
        <el-form-item :label="$t('t343')">
          <el-input v-model="editSceneLibraryForm.location" :placeholder="$t('t377')" />
        </el-form-item>
        <el-form-item :label="$t('t345')">
          <el-input v-model="editSceneLibraryForm.time" :placeholder="$t('t378')" />
        </el-form-item>
        <el-form-item :label="$t('t362')">
          <el-input v-model="editSceneLibraryForm.category" :placeholder="$t('t363')" />
        </el-form-item>
        <el-form-item :label="$t('t301')">
          <el-input v-model="editSceneLibraryForm.description" type="textarea" :rows="3" :placeholder="$t('t363')" />
        </el-form-item>
        <el-form-item :label="$t('t364')">
          <el-input v-model="editSceneLibraryForm.tags" :placeholder="$t('t365')" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditSceneLibrary = false">{{ $t('t304') }}</el-button>
        <el-button type="primary" :loading="editSceneLibrarySaving" @click="submitEditSceneLibrary">{{ $t('t332') }}</el-button>
      </template>
    </el-dialog>

    <!-- 分镜提示词编辑弹窗 -->
    <el-dialog
      v-model="showSbPromptDialog"
      :title="$t('t379', { arg0: sbPromptTarget?.storyboard_number ?? '' })"
      width="700px"
      @close="sbPromptTarget = null"
    >
      <el-form v-if="sbPromptTarget" label-width="0" class="sb-prompt-dialog-form">
        <!-- 图片区 -->
        <div class="sb-prompt-section-title">{{ $t('t380') }}</div>
        <el-form-item label="">
          <div style="width:100%">
            <div style="font-size:12px; color:#6b7280; margin-bottom:4px;">{{ $t('t381') }}</div>
            <el-input
              v-model="sbPromptImageText"
              type="textarea"
              :rows="4"
              :placeholder="$t('t382')"
            />
          </div>
        </el-form-item>
        <el-form-item label="">
          <div style="width:100%">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <span style="font-size:12px; color:#6b7280;">{{ $t('t383') }}</span>
              <el-button
                size="small"
                type="warning"
                plain
                :loading="sbPromptPolishing"
                @click="onPolishSbPrompt"
              >{{ sbPromptPolishedText ? $t('t258') : $t('t384') }}</el-button>
            </div>
            <el-input
              v-model="sbPromptPolishedText"
              type="textarea"
              :rows="5"
              :placeholder="$t('t385')"
            />
          </div>
        </el-form-item>
        <!-- 视频区 -->
        <div class="sb-prompt-section-title" style="margin-top:12px;">{{ $t('t386') }}</div>
        <el-form-item label="">
          <el-input
            v-model="sbPromptVideoText"
            type="textarea"
            :rows="12"
            :placeholder="$t('t387')"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSbPromptDialog = false">{{ $t('t304') }}</el-button>
        <el-button type="primary" :loading="sbPromptSaving" @click="onSaveSbPromptDialog">{{ $t('t332') }}</el-button>
      </template>
    </el-dialog>

    <!-- 首尾帧提示词编辑器（显示最终发给AI的完整提示词，支持编辑保存） -->
    <el-dialog
      v-model="showFramePromptEditor"
      :title="$t('t388', { arg0: editingFramePromptSlot === 'last' ? $t('t243') : $t('t237') })"
      width="720px"
      destroy-on-close
    >
      <div class="frame-prompt-editor-body">
        <div class="frame-prompt-editor-hint">
          {{ $t('t389') }}
        </div>

        <!-- 空间布局锚点（生成分镜时 AI 输出的最高优先级站位合同） -->
        <div v-if="editingFramePromptSb?.layout_description" class="frame-layout-anchor">
          <div class="frame-layout-anchor-label">{{ $t('t390') }}</div>
          <div class="frame-layout-anchor-text">{{ editingFramePromptSb.layout_description }}</div>
          <div class="frame-layout-anchor-note">{{ $t('t391') }}</div>
        </div>

        <el-input
          v-model="editingFramePromptText"
          type="textarea"
          :rows="14"
          :placeholder="$t('t392')"
          class="frame-prompt-editor-textarea"
        />
      </div>
      <template #footer>
        <el-button @click="showFramePromptEditor = false">{{ $t('t176') }}</el-button>
        <el-button :loading="editingFramePromptRegenerating" @click="regenerateEditingFramePrompt">{{ $t('t258') }}</el-button>
        <el-button type="primary" :loading="editingFramePromptSaving" @click="saveEditingFramePrompt">{{ $t('t332') }}</el-button>
      </template>
    </el-dialog>

    <!-- 分镜视频参数编辑弹窗 -->
    <el-dialog
      v-model="showVideoParamsDialog"
      :title="$t('t393', { arg0: videoParamsTarget?.storyboard_number ?? '' })"
      width="860px"
      destroy-on-close
      @close="onVideoParamsDialogClosed"
    >
      <el-form v-if="videoParamsTarget" label-width="115px" size="small" class="vp-dialog-form">
        <el-form-item :label="$t('t394')">
          <el-radio-group
            :model-value="sbCreationMode[videoParamsTarget.id] === 'universal' ? 'universal' : 'classic'"
            size="small"
            @change="(v) => setSbCreationModeId(videoParamsTarget.id, v)"
          >
            <el-radio-button value="classic">{{ $t('t183') }}</el-radio-button>
            <el-radio-button value="universal">{{ $t('t184') }}</el-radio-button>
          </el-radio-group>
          <div class="vp-mode-hint">{{ $t('t395') }} <strong>{{ $t('t396') }}</strong>{{ $t('t397') }} <code>kling_omni</code> {{ $t('t398') }} <code>volcengine_omni</code>{{ $t('t399') }} <code>kling-video-o1</code>、<code>doubao-seedance-2-0-260128</code> {{ $t('t400') }}</div>
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item :label="$t('t401')">
              <el-input v-model="sbTitle[videoParamsTarget.id]" :placeholder="$t('t402')" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item :label="$t('t343')">
              <el-input v-model="sbLocation[videoParamsTarget.id]" :placeholder="$t('t377')" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item :label="$t('t345')">
              <el-input v-model="sbTime[videoParamsTarget.id]" :placeholder="$t('t403')" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="6">
            <el-form-item :label="$t('t404')">
              <el-input-number v-model="sbDuration[videoParamsTarget.id]" :min="1" :max="60" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item :label="$t('t405')">
              <el-select v-model="sbShotType[videoParamsTarget.id]" :placeholder="$t('t405')" style="width:100%">
                <el-option :label="$t('t406')" :value="$t('t406')" />
                <el-option :label="$t('t407')" :value="$t('t407')" />
                <el-option :label="$t('t408')" :value="$t('t408')" />
                <el-option :label="$t('t409')" :value="$t('t409')" />
                <el-option :label="$t('t410')" :value="$t('t410')" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item :label="$t('t411')">
              <el-select v-model="sbMovement[videoParamsTarget.id]" :placeholder="$t('t412')" style="width:100%" clearable filterable>
                <el-option-group :label="$t('t413')">
                  <el-option :label="$t('t414')" value="static" />
                  <el-option :label="$t('t415')" value="push" />
                  <el-option :label="$t('t416')" value="pull" />
                  <el-option :label="$t('t417')" value="pan" />
                  <el-option :label="$t('t418')" value="tilt" />
                  <el-option :label="$t('t419')" value="tracking" />
                  <el-option :label="$t('t420')" value="crane_up" />
                  <el-option :label="$t('t421')" value="crane_dn" />
                  <el-option :label="$t('t422')" value="orbit" />
                  <el-option :label="$t('t423')" value="handheld" />
                </el-option-group>
                <el-option-group :label="$t('t424')">
                  <el-option :label="$t('t425')" value="zoom" />
                  <el-option :label="$t('t426')" value="roll" />
                  <el-option :label="$t('t427')" value="whip_pan" />
                  <el-option :label="$t('t428')" value="spiral" />
                </el-option-group>
                <el-option-group :label="$t('t429')">
                  <el-option :label="$t('t430')" value="hitchcock_zoom" />
                  <el-option :label="$t('t431')" value="bullet_time" />
                  <el-option :label="$t('t432')" value="dutch_angle_move" />
                  <el-option :label="$t('t433')" value="dolly_track" />
                  <el-option :label="$t('t434')" value="slowmo_orbit" />
                </el-option-group>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item :label="$t('t435')">
              <el-input v-model="sbAtmosphere[videoParamsTarget.id]" :placeholder="$t('t436')" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item :label="$t('t437')">
              <div style="display:flex;gap:4px;flex-wrap:wrap">
                <el-select v-model="sbAngleS[videoParamsTarget.id]" :placeholder="$t('t405')" style="width:76px">
                  <el-option :label="$t('t410')" value="close_up" />
                  <el-option :label="$t('t408')" value="medium" />
                  <el-option :label="$t('t407')" value="wide" />
                </el-select>
                <el-select v-model="sbAngleV[videoParamsTarget.id]" :placeholder="$t('t438')" style="width:86px">
                  <el-option :label="$t('t439')" value="eye_level" />
                  <el-option :label="$t('t440')" value="low" />
                  <el-option :label="$t('t441')" value="high" />
                  <el-option :label="$t('t442')" value="worm" />
                </el-select>
                <el-select v-model="sbAngleH[videoParamsTarget.id]" :placeholder="$t('t443')" style="width:80px">
                  <el-option :label="$t('t444')" value="front" />
                  <el-option :label="$t('t445')" value="front_left" />
                  <el-option :label="$t('t446')" value="left" />
                  <el-option :label="$t('t447')" value="back_left" />
                  <el-option :label="$t('t448')" value="back" />
                  <el-option :label="$t('t449')" value="back_right" />
                  <el-option :label="$t('t450')" value="right" />
                  <el-option :label="$t('t451')" value="front_right" />
                </el-select>
                <span v-if="sbAngleS[videoParamsTarget.id] && sbAngleV[videoParamsTarget.id] && sbAngleH[videoParamsTarget.id]"
                      style="font-size:11px;color:#6b7280;background:#f3f4f6;padding:2px 6px;border-radius:4px;white-space:nowrap">
                  {{ angleToPromptFragment(sbAngleH[videoParamsTarget.id], sbAngleV[videoParamsTarget.id], sbAngleS[videoParamsTarget.id]).label }}
                </span>
              </div>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item :label="$t('t452')">
              <el-select v-model="sbLighting[videoParamsTarget.id]" :placeholder="$t('t453')" style="width:100%" clearable>
                <el-option :label="$t('t454')" value="natural" />
                <el-option :label="$t('t455')" value="front" />
                <el-option :label="$t('t456')" value="side" />
                <el-option :label="$t('t457')" value="backlit" />
                <el-option :label="$t('t458')" value="top" />
                <el-option :label="$t('t459')" value="under" />
                <el-option :label="$t('t460')" value="soft" />
                <el-option :label="$t('t461')" value="dramatic" />
                <el-option :label="$t('t462')" value="golden_hour" />
                <el-option :label="$t('t463')" value="blue_hour" />
                <el-option :label="$t('t464')" value="night" />
                <el-option :label="$t('t465')" value="neon" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item :label="$t('t466')">
              <el-select v-model="sbDof[videoParamsTarget.id]" :placeholder="$t('t466')" style="width:100%" clearable>
                <el-option :label="$t('t467')" value="extreme_shallow" />
                <el-option :label="$t('t468')" value="shallow" />
                <el-option :label="$t('t469')" value="medium" />
                <el-option :label="$t('t470')" value="deep" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 空间布局锚点：生成分镜时 AI 输出的最高优先级人物站位合同（首尾帧强制一致核心） -->
        <el-form-item :label="$t('t471')">
          <div style="display:flex; gap:8px; align-items:flex-start; width:100%">
            <el-input
              v-model="sbLayoutDescription[videoParamsTarget.id]"
              type="textarea"
              :rows="3"
              :placeholder="$t('t472')"
              style="flex:1"
            />
            <el-button
              size="small"
              :loading="regeneratingLayoutSbIds.has(videoParamsTarget.id)"
              @click="onRegenerateLayoutDescription(videoParamsTarget)"
              style="margin-top:4px; white-space:nowrap"
            >
              {{ $t('t473') }}
            </el-button>
          </div>
          <div style="font-size:11px;color:#64748b;margin-top:4px;line-height:1.35">
            {{ $t('t474') }}
          </div>
        </el-form-item>

        <el-form-item :label="$t('t475')">
          <el-input v-model="sbAction[videoParamsTarget.id]" type="textarea" :rows="2" :placeholder="$t('t476')" />
        </el-form-item>
        <el-form-item :label="$t('t477')">
          <el-input v-model="sbDialogue[videoParamsTarget.id]" type="textarea" :rows="2" :placeholder="$t('t478')" />
        </el-form-item>
        <el-form-item :label="$t('t199')">
          <el-input v-model="sbNarration[videoParamsTarget.id]" type="textarea" :rows="2" class="sb-narration-input" :placeholder="$t('t479')" />
        </el-form-item>
        <el-form-item v-if="canSplitSbByAudio(videoParamsTarget)" :label="$t('t480')">
          <div class="sb-split-audio-row">
            <p class="sb-split-audio-tip">
              {{ $t('t481') }}
            </p>
            <el-button
              type="warning"
              plain
              :loading="splitByAudioLoading"
              @click="onSplitSbByAudio(videoParamsTarget)"
            >
              {{ $t('t482') }}
            </el-button>
          </div>
        </el-form-item>
        <el-form-item :label="$t('t483')">
          <el-input v-model="sbResult[videoParamsTarget.id]" type="textarea" :rows="2" :placeholder="$t('t484')" />
        </el-form-item>
        <el-form-item :label="$t('t273')">
          <div class="vp-video-prompt-hint">{{ $t('t485') }}</div>
          <el-input
            v-if="videoParamsTarget?.video_prompt"
            :model-value="videoParamsTarget.video_prompt"
            type="textarea"
            :rows="3"
            readonly
            style="color:#6b7280;margin-top:8px"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showVideoParamsDialog = false">{{ $t('t304') }}</el-button>
        <el-button type="primary" :loading="videoParamsSaving" @click="onSaveVideoParams">{{ $t('t486') }}</el-button>
      </template>
    </el-dialog>

    <!-- P1-2: 导入小说弹窗 -->
    <el-dialog v-model="showNovelImport" :title="$t('t487')" width="600px" @close="novelImportReset">
      <div class="novel-import-dialog">
        <p style="color:#6b7280;font-size:13px;margin-bottom:12px">{{ $t('t488') }}</p>
        <el-tabs v-model="novelImportMode">
          <el-tab-pane :label="$t('t489')" name="text">
            <el-input
              v-model="novelText"
              type="textarea"
              :rows="10"
              :placeholder="$t('t490')"
            />
          </el-tab-pane>
          <el-tab-pane :label="$t('t491')" name="file">
            <el-upload
              drag
              :auto-upload="false"
              :on-change="onNovelFileChange"
              accept=".txt,.md"
              :show-file-list="false"
            >
              <el-icon class="el-icon--upload"><DocumentAdd /></el-icon>
              <div class="el-upload__text">{{ $t('t492') }}<em>{{ $t('t493') }}</em></div>
            </el-upload>
            <div v-if="novelFileName" style="margin-top:8px;font-size:13px;color:#409eff">{{ $t('t494') }}{{ novelFileName }}</div>
          </el-tab-pane>
        </el-tabs>
        <div class="novel-import-options" style="margin-top:12px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:6px;font-size:13px">
            <span>{{ $t('t495') }}</span>
            <el-input-number v-model="novelMaxChapters" :min="1" :max="20" size="small" style="width:100px" />
          </div>
          <el-checkbox v-model="novelAiSummarize" size="small">{{ $t('t496') }}</el-checkbox>
        </div>
      </div>
      <template #footer>
        <el-button @click="showNovelImport = false">{{ $t('t304') }}</el-button>
        <el-button type="primary" :loading="novelImporting" @click="onImportNovel">{{ $t('t497') }}</el-button>
      </template>
    </el-dialog>

    <!-- AI 配置弹窗（不跳转，避免本页内容丢失） -->
    <el-dialog v-model="showAiConfigDialog" :title="$t('t288')" width="90%" destroy-on-close class="ai-config-dialog">
      <AIConfigContent v-if="showAiConfigDialog" />
    </el-dialog>

    <!-- 图片放大预览：点击遮罩或图片关闭 -->
    <Teleport to="body">
      <div
        v-if="previewImageUrl"
        class="image-preview-overlay"
        @click="closeImagePreview"
      >
        <img :src="previewImageUrl" alt="" class="image-preview-img" @click.stop="closeImagePreview" />
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import StoryboardBoard from '@/components/StoryboardBoard.vue'
import { ref, computed, onMounted, onBeforeUnmount, watch, reactive, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Setting, Plus, Minus, Sunny, Moon, MagicStick, Upload, Delete, Check, Loading, WarningFilled, User, Box, Picture, Film, VideoCamera, Document, InfoFilled, Refresh, ZoomIn, QuestionFilled, DocumentAdd, Expand, Fold, VideoPlay } from '@element-plus/icons-vue'
import { useTheme } from '@/composables/useTheme'
import { useFilmStore } from '@/stores/film'
import { useGenerationTaskStore, GEN_RESOURCE } from '@/stores/generationTaskStore'
import { syncGeneratingSetsFromStore, buildEpisodeContext, buildExtractTaskMeta, isEpisodeExtractRunning } from '@/composables/useGenerationTaskSync'
import { dramaAPI } from '@/api/drama'
import { generationAPI } from '@/api/generation'
import { aiAPI } from '@/api/ai'
import { characterAPI } from '@/api/characters'
import { propAPI } from '@/api/props'
import { sceneAPI } from '@/api/scenes'
import { taskAPI } from '@/api/task'
import { imagesAPI } from '@/api/images'
import { videosAPI } from '@/api/videos'
import { storyboardsAPI } from '@/api/storyboards'
import { uploadAPI } from '@/api/upload'
import { characterLibraryAPI } from '@/api/characterLibrary'
import { sceneLibraryAPI } from '@/api/sceneLibrary'
import { propLibraryAPI } from '@/api/propLibrary'
import { generationSettingsAPI } from '@/api/prompts'
import { parseScriptIntoEpisodes, episodesListToPlainScript } from '@/utils/scriptEpisodes'
import { exportStoryboardSheet } from '@/utils/exportStoryboardSheet'
import StylePickerButton from '@/components/StylePickerButton.vue'
import AIConfigContent from '@/components/AIConfigContent.vue'
import UniversalSegmentOmniAtEditor from '@/components/UniversalSegmentOmniAtEditor.vue'
import {
  generationStyleOptions,
  getStylePromptEn,
  getStylePromptZh,
  stylePromptMetadataForSave,
  backfillDramaStylePromptMetadataIfNeeded,
} from '@/constants/styleOptions'
import { useNavigation } from '@/composables/filmCreate/useNavigation'
import { runGenerateStoryFromPremise } from '@/composables/useStoryGeneration'
import { useCharacters } from '@/composables/filmCreate/useCharacters'
import { useProps as usePropsComposable } from '@/composables/filmCreate/useProps'
import { useScenes } from '@/composables/filmCreate/useScenes'

const route = useRoute()
const router = useRouter()
const store = useFilmStore()
const genStore = useGenerationTaskStore()
const { isDark, toggle: toggleTheme } = useTheme()
const { videoResolution: storeVideoResolution } = storeToRefs(store)

// ── Composable: Navigation ─────────────────────────────
const { navCollapsed, storyboardMenuExpanded, toggleNav, scrollToTop, scrollToAnchor } = useNavigation()

function goList() {
  router.push('/')
}


const showAiConfigDialog = ref(false)
watch(showAiConfigDialog, (open) => {
  if (!open) invalidateActiveVideoAiConfigCache()
})
const storyInput = ref('')
const storyStyle = ref('')
const storyType = ref('')
const storyEpisodeCount = ref(1)
const storyGenerating = ref(false)
/** 剧本工作台：create 创作 | select 选择预览 */
const scriptWorkbenchMode = ref('create')
const showSelectScriptDialog = ref(false)
const selectScriptLoading = ref(false)
const selectScriptImporting = ref(false)
const selectScriptDramas = ref([])
/** 选择剧本弹窗列表：排除当前打开的项目，避免误点「导入」到自身 */
const selectableScriptDramas = computed(() => {
  const cur = store.dramaId
  const list = selectScriptDramas.value || []
  if (cur == null) return list
  return list.filter((d) => Number(d.id) !== Number(cur))
})
const selectPreviewEpisodeId = ref('')
// P1-2: 小说导入
const showNovelImport = ref(false)
const novelImportMode = ref('text')
const novelText = ref('')
const novelFileName = ref('')
const novelFileContent = ref('')
const novelMaxChapters = ref(10)
const novelAiSummarize = ref(false)
const novelImporting = ref(false)
const scriptTitle = ref('')
const selectedEpisodeId = ref(null)
/** 保存剧本后用于恢复选中集（后端重插后 id 会变，用 episode_number 匹配） */
const savedCurrentEpisodeNumber = ref(1)
const scriptLanguage = ref('zh')
const scriptStoryboardStyle = ref('')
const scriptGenerating = ref(false)
const generationStyle = ref('')
const projectAspectRatio = ref('16:9')
const videoClipDuration = ref(5)

/** 根据 value 查找样式选项对象 */
function _findStyleOption(val) {
  for (const group of generationStyleOptions) {
    const found = group.options.find(o => o.value === val)
    if (found) return found
  }
  return null
}
const { t } = useI18n()


/** 传给图像/视频 AI 用的英文 prompt（效果最好）；
 *  找不到 promptEn 时降级到 prompt，再降级到原始值 */
function getSelectedStylePrompt() {
  const val = (generationStyle.value || '').toString().trim()
  if (!val) return undefined
  const opt = _findStyleOption(val)
  if (opt) return opt.promptEn || opt.prompt || val
  return val
}

/** 中文风格描述（用于界面展示或中文场景提示词拼接） */
function getSelectedStylePromptZh() {
  const val = (generationStyle.value || '').toString().trim()
  if (!val) return undefined
  const opt = _findStyleOption(val)
  if (opt) return opt.prompt || opt.promptEn || val
  return val
}

function projectStylePromptMetadata() {
  return stylePromptMetadataForSave(generationStyle.value)
}

const scriptContent = computed({
  get: () => store.scriptContent,
  set: (v) => store.setScriptContent(v)
})
const videoResolution = storeVideoResolution
const videoMusic = ref('')
const videoSfx = ref('')
const videoQuality = ref('high')
const videoSubtitle = ref(false)
/** 合成整集时把各镜对白 TTS（audio_local_path）按分镜时长对齐并混入成片 */
const videoBurnDialogue = ref(false)
const videoWatermark = ref(false)
/** 水印开启时烧录到成片右下角 */
const videoWatermarkText = ref('')

const dramaId = computed(() => store.dramaId)
const characters = computed(() => store.characters)
const scenes = computed(() => store.scenes)
const props = computed(() => store.props)
const storyboards = computed(() => store.storyboards)
const storyboardViewMode = ref('list')
const currentEpisode = computed(() => store.currentEpisode)
const currentEpisodeId = computed(() => store.currentEpisode?.id ?? null)
const videoProgress = computed(() => store.videoProgress)
const videoStatus = computed(() => store.videoStatus)

function trackFilmCreateAction(_action, _payload = {}) {
  // 单机版：无埋点上报
}
/** 当前集合成视频的播放地址（用于按钮下方预览） */
const currentEpisodeVideoUrl = computed(() => {
  const url = currentEpisode.value?.video_url
  if (!url || !String(url).trim()) return ''
  const s = String(url).trim()
  if (s.startsWith('http://') || s.startsWith('https://')) return s
  return '/static/' + s.replace(/^\//, '')
})

const storyboardGenerating = computed(() =>
  isEpisodeExtractRunning(genStore, dramaId.value, currentEpisodeId.value, GEN_RESOURCE.GENERATE_STORYBOARD)
)
/** 分镜批量生成结束后，按镜序逐个润色全能片段（仅勾选全能模式且各镜为 universal 且有正文时） */
const universalOmniPolishRunning = ref(false)
const universalOmniPolishProgress = ref({ current: 0, total: 0, label: '' })
const sbTruncatedWarning = ref(false)
const sbTruncatedDismissed = ref(false)
const videoErrorMsg = ref('')
// 一键全流程流水线
const pipelineRunning = ref(false)
const pipelinePaused = ref(false)
const pipelineCancelRequested = ref(false)
const PIPELINE_CANCEL_SENTINEL = '__PIPELINE_CANCELED__'
const pipelineErrorLog = ref([])
const pipelineCurrentStep = ref('')
const pipelineStepIndex = ref(0)    // 当前步骤序号（1-based）
/** 全流程 10 步；仅文本框架为前 4 步 */
const pipelineStepTotal = ref(10)
let pipelineResolveResume = null
// 倒计时（两个生成阶段之间的确认窗口）
const pipelineCountdown = ref(0)      // 剩余秒数，0 表示不在倒计时
const pipelineCountdownMsg = ref('')  // 倒计时说明文字
const pipelineConcurrency = ref(3)
const pipelineVideoConcurrency = ref(3)
const pipelineActiveTasks = reactive(new Set())

async function loadPipelineConcurrency() {
  try {
    const res = await generationSettingsAPI.get()
    pipelineConcurrency.value = Math.max(1, Number(res?.concurrency) || 3)
    pipelineVideoConcurrency.value = Math.max(1, Number(res?.video_concurrency) || 3)
  } catch (_) {}
}

/**
 * 带并发度的批量执行器。
 * @param {Array} items - 需要处理的项目列表
 * @param {number} concurrency - 最大并发数
 * @param {Function} fn - async (item, index) => void，内部可 throw 或 return {paused}
 * @param {{ getLabel?: (item) => string }} options
 * @returns {Promise<{paused: boolean}>}
 */
async function runConcurrently(items, concurrency, fn, options = {}) {
  let index = 0
  let anyPaused = false
  const getLabel = options.getLabel || (() => null)

  async function worker() {
    while (index < items.length) {
      if (pipelineCancelRequested.value) return
      const i = index++
      const item = items[i]
      const label = getLabel(item)
      if (label) pipelineActiveTasks.add(label)
      try {
        const result = await fn(item, i)
        if (result && typeof result === 'object' && result.paused) {
          anyPaused = true
          return
        }
      } finally {
        if (label) pipelineActiveTasks.delete(label)
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  await Promise.allSettled(workers)
  return { paused: anyPaused }
}
// ── Composable: Characters ────────────────────────────
const {
  showEditCharacter, editCharacterForm, editCharacterSaving, editCharacterPromptGenerating,
  extractingCharAppearance, extractingAnchors, reextractingFromScript, addCharRefImage, addCharRefFileInput,
  charactersGenerating, generatingCharIds, sd2CertifyingId, showCharSd2Cert, charSd2CertPayload,
  sd2VoiceUploadingId,
  showCharLibrary, charLibraryList, charLibraryLoading, charLibraryPage, charLibraryPageSize,
  charLibraryTotal, charLibraryKeyword, charLibraryTab,
  dramaAllCharList, dramaAllCharLoading, dramaAllCharPage, dramaAllCharPageSize, dramaAllCharTotal, dramaAllCharKeyword,
  showEditCharLibrary, editCharLibraryForm,
  editCharLibrarySaving, addingCharToLibraryId, addingCharToMaterialId, addingCharFromLibraryId,
  charRoleLabel, onGenerateCharacters: onGenerateCharactersRaw, openAddCharacter, stopCharacterPromptPoll, editCharacter,
  saveCharRefImageIfAny, submitEditCharacter, doGenerateCharacterPrompt, doExtractCharFromImage, doReextractFromScript,
  extractIdentityAnchors, clearCharRefImage, onCloseCharDialog, onDeleteCharacter, onGenerateCharacterImage, onSd2CertifyCharacter, onSd2CertifyRefresh, sd2ActionLabel, onSd2PrimaryAction, openCharSd2CertDialog,
  onSd2VoicePrimaryAction, onSd2VoiceReplace, sd2VoiceActionLabel, playSd2Voice,
  loadCharLibraryList, debouncedLoadCharLibrary, loadDramaAllCharList, debouncedLoadDramaAllCharList,
  onCharLibraryDialogOpen, onCharLibraryTabChange, isCharAddToEpisodeLoading,
  openEditCharLibrary, submitEditCharLibrary,
  onDeleteCharLibrary, onAddCharacterToLibrary, onAddCharacterToMaterialLibrary,
  onAddCharFromLibrary, onAddDramaCharToEpisode,
} = useCharacters({ store, dramaId, currentEpisodeId, getSelectedStyle, loadDrama, pollTask, pollUntilResourceHasImage, hasAssetImage })

// ── Composable: Props ──────────────────────────────────
const {
  showAddProp, addPropSaving, addPropForm,
  showEditProp, editPropForm, editPropSaving, editPropPromptGenerating,
  extractingPropDesc, addPropRefImage, addPropRefFileInput,
  addPropAddRefImage, addPropAddRefFileInput, extractingPropAddDesc,
  propsExtracting, generatingPropIds,
  showPropLibrary, propLibraryList, propLibraryLoading, propLibraryPage, propLibraryPageSize,
  propLibraryTotal, propLibraryKeyword, propLibraryTab,
  dramaAllPropList, dramaAllPropLoading, dramaAllPropPage, dramaAllPropPageSize, dramaAllPropTotal, dramaAllPropKeyword,
  showEditPropLibrary, editPropLibraryForm,
  editPropLibrarySaving, addingPropToLibraryId, addingPropToMaterialId, addingPropFromLibraryId,
  onExtractProps: onExtractPropsRaw, stopPropPromptPoll, editProp, doGeneratePropPrompt, savePropRefImageIfAny,
  clearPropRefImage, doExtractPropFromImage, submitEditProp, submitAddProp,
  onClosePropDialog, onDeleteProp, onGeneratePropImage,
  loadPropLibraryList, debouncedLoadPropLibrary, loadDramaAllPropList, debouncedLoadDramaAllPropList,
  onPropLibraryDialogOpen, onPropLibraryTabChange, isPropAddToEpisodeLoading,
  openEditPropLibrary, submitEditPropLibrary,
  onDeletePropLibrary, onAddPropToLibrary, onAddPropToMaterialLibrary,
  onAddPropFromLibrary, onAddDramaPropToEpisode,
  doExtractFromRef2,
} = usePropsComposable({ store, dramaId, currentEpisodeId, getSelectedStyle, loadDrama, pollTask, pollUntilResourceHasImage, hasAssetImage })

// ── Composable: Scenes ─────────────────────────────────
const {
  showEditScene, editSceneForm, editSceneSaving, editScenePromptGenerating,
  extractingSceneDesc, addSceneRefImage, addSceneRefFileInput,
  scenesExtracting, generatingSceneIds,
  // 场景多视角额外 state（由 FilmCreate 管理）
  showSceneLibrary, sceneLibraryList, sceneLibraryLoading, sceneLibraryPage, sceneLibraryPageSize,
  sceneLibraryTotal, sceneLibraryKeyword, sceneLibraryTab,
  dramaAllSceneList, dramaAllSceneLoading, dramaAllScenePage, dramaAllScenePageSize, dramaAllSceneTotal, dramaAllSceneKeyword,
  showEditSceneLibrary, editSceneLibraryForm,
  editSceneLibrarySaving, addingSceneToLibraryId, addingSceneToMaterialId, addingSceneFromLibraryId,
  onExtractScenes: onExtractScenesRaw, openAddScene, stopScenePromptPoll, editScene, doGenerateScenePrompt, doGenerateSceneSinglePrompt,
  saveSceneRefImageIfAny, clearSceneRefImage, doExtractSceneFromImage, submitEditScene,
  onCloseSceneDialog, onDeleteScene, onGenerateSceneImage,
  loadSceneLibraryList, debouncedLoadSceneLibrary, loadDramaAllSceneList, debouncedLoadDramaAllSceneList,
  onSceneLibraryDialogOpen, onSceneLibraryTabChange, isSceneAddToEpisodeLoading,
  openEditSceneLibrary, submitEditSceneLibrary,
  onDeleteSceneLibrary, onAddSceneToLibrary, onAddSceneToMaterialLibrary,
  onAddSceneFromLibrary, onAddDramaSceneToEpisode,
} = useScenes({ store, dramaId, currentEpisodeId, getSelectedStyle, scriptLanguage, loadDrama, pollTask, pollUntilResourceHasImage, hasAssetImage, dramaAPI })

async function onGenerateCharacters() {
  trackFilmCreateAction('generate_characters_click')
  const beforeCount = (store.currentEpisode?.characters || []).length
  try {
    await onGenerateCharactersRaw()
    const afterCount = (store.currentEpisode?.characters || []).length
    trackFilmCreateAction('generate_characters_complete', {
      extra: { before_count: beforeCount, after_count: afterCount },
    })
  } catch (e) {
    trackFilmCreateAction('generate_characters_failed', {
      extra: { message: String(e?.message || 'failed').slice(0, 120) },
    })
    throw e
  }
}

async function onExtractProps() {
  trackFilmCreateAction('extract_props_click')
  const beforeCount = (store.props || []).length
  try {
    await onExtractPropsRaw()
    const afterCount = (store.props || []).length
    trackFilmCreateAction('extract_props_complete', {
      extra: { before_count: beforeCount, after_count: afterCount },
    })
  } catch (e) {
    trackFilmCreateAction('extract_props_failed', {
      extra: { message: String(e?.message || 'failed').slice(0, 120) },
    })
    throw e
  }
}

async function onExtractScenes() {
  trackFilmCreateAction('extract_scenes_click')
  const beforeCount = (store.currentEpisode?.scenes || []).length
  try {
    await onExtractScenesRaw()
    const afterCount = (store.currentEpisode?.scenes || []).length
    trackFilmCreateAction('extract_scenes_complete', {
      extra: { before_count: beforeCount, after_count: afterCount },
    })
  } catch (e) {
    trackFilmCreateAction('extract_scenes_failed', {
      extra: { message: String(e?.message || 'failed').slice(0, 120) },
    })
    throw e
  }
}



// 资源管理大面板及子区块折叠状态
const resourcePanelCollapsed = ref(false)
const charactersBlockCollapsed = ref(false)
const propsBlockCollapsed = ref(false)
const scenesBlockCollapsed = ref(false)
const sceneUseQuadGrid = ref(false)
const propUseQuadGrid = ref(false)  // 道具四视图（与场景四宫格同级选项）

// 分镜行内编辑状态（按 storyboard id 存储）
// navCollapsed/storyboardMenuExpanded/toggleNav → 已移至 useNavigation composable

/** 左侧导航各步骤状态 */
const navSteps = computed(() => {
  const epRunning = genStore.getRunningForEpisode(dramaId.value, currentEpisodeId.value)
  // 剧本
  const hasScript = !!(scriptContent?.value?.trim())
  const scriptStatus = (storyGenerating.value || scriptGenerating.value)
    ? 'generating'
    : hasScript ? 'done' : 'pending'

  // 角色
  const charList = characters.value || []
  const charDone = charList.length > 0 && charList.every(c => hasAssetImage(c))
  const charGen = charactersGenerating.value || generatingCharIds.size > 0
    || epRunning.some((t) => t.resourceType === GEN_RESOURCE.CHAR_IMAGE || t.resourceType === GEN_RESOURCE.EXTRACT_CHARACTERS)
  const charStatus = charGen ? 'generating' : charDone ? 'done' : charList.length > 0 ? 'partial' : 'pending'

  // 道具
  const propList = props.value || []
  const propDone = propList.length > 0 && propList.every(p => hasAssetImage(p))
  const propGen = propsExtracting.value || generatingPropIds.size > 0
    || epRunning.some((t) => t.resourceType === GEN_RESOURCE.PROP_IMAGE || t.resourceType === GEN_RESOURCE.EXTRACT_PROPS)
  const propStatus = propGen ? 'generating' : propDone ? 'done' : propList.length > 0 ? 'partial' : 'pending'

  // 场景
  const sceneList = scenes.value || []
  const sceneDone = sceneList.length > 0 && sceneList.every(s => hasAssetImage(s))
  const sceneGen = scenesExtracting.value || generatingSceneIds.size > 0
    || epRunning.some((t) => t.resourceType === GEN_RESOURCE.SCENE_IMAGE || t.resourceType === GEN_RESOURCE.EXTRACT_SCENES)
  const sceneStatus = sceneGen ? 'generating' : sceneDone ? 'done' : sceneList.length > 0 ? 'partial' : 'pending'

  // 分镜脚本
  const sbList = storyboards.value || []
  const sbScriptDone = sbList.length > 0
  const sbScriptGen = storyboardGenerating.value || universalOmniPolishRunning.value
    || epRunning.some((t) => t.resourceType === GEN_RESOURCE.GENERATE_STORYBOARD)
  const sbScriptStatus = sbScriptGen ? 'generating' : sbScriptDone ? 'done' : 'pending'

  // 分镜图
  const sbImgDone = sbList.length > 0 && sbList.every(sb => hasSbImage(sb))
  const sbImgGen = generatingSbImageIds.size > 0 || batchImageRunning.value || epRunning.some((t) =>
    t.resourceType === GEN_RESOURCE.SB_IMAGE
    || t.resourceType === GEN_RESOURCE.SB_FIRST_IMAGE
    || t.resourceType === GEN_RESOURCE.SB_LAST_IMAGE
  )
  const sbImgStatus = sbImgGen ? 'generating' : sbImgDone ? 'done' : sbList.length > 0 ? 'partial' : 'pending'

  // 视频
  const sbVideoAllDone = sbList.length > 0 && sbList.every(sb => getSbAllVideos(sb.id).length > 0)
  const sbVideoSome = sbList.some(sb => getSbAllVideos(sb.id).length > 0)
  const sbVideoGen = batchVideoRunning.value || generatingSbVideoIds.size > 0
    || epRunning.some((t) => t.resourceType === GEN_RESOURCE.SB_VIDEO)
  const videoStatus = sbVideoGen ? 'generating' : sbVideoAllDone ? 'done' : sbVideoSome ? 'partial' : 'pending'

  return [
    { key: 'script',   label: t('t499'),   anchor: 'anchor-script',     status: scriptStatus,    count: hasScript ? 1 : 0 },
    { key: 'chars',    label: t('t194'),        anchor: 'anchor-characters', status: charStatus,      count: charList.length },
    { key: 'props',    label: t('t500'),        anchor: 'anchor-props',      status: propStatus,      count: propList.length },
    { key: 'scenes',   label: t('t193'),        anchor: 'anchor-scenes',     status: sceneStatus,     count: sceneList.length },
    { key: 'sb',       label: t('t501'),   anchor: 'anchor-storyboard', status: sbScriptStatus,  count: sbList.length },
    { key: 'sbimg',    label: t('t502'),      anchor: 'anchor-storyboard', status: sbImgStatus,     count: sbList.length },
    { key: 'video',    label: t('t503'),   anchor: 'anchor-video',      status: videoStatus,     count: 0 },
  ]
})

/** 聚合所有当前正在运行的任务标签，用于悬浮任务面板（含跨剧跨集） */
const allActiveTasks = computed(() => {
  const tasks = []
  const seen = new Set()
  function addTask(label) {
    const s = (label || '').trim()
    if (!s || seen.has(s)) return
    seen.add(s)
    tasks.push(s)
  }
  for (const t of genStore.getAllRunningTasks()) {
    addTask(t.label)
  }
  // 一键全流程 pipeline
  if (pipelineRunning.value) {
    const step = pipelineCurrentStep.value
    addTask(step ? step.replace(/^\[步骤 \d+\/\d+\] /, '') : t('t504'))
  }
  // 整体操作
  if (storyGenerating.value || scriptGenerating.value) addTask(t('t505'))
  if (universalOmniPolishRunning.value) {
    const p = universalOmniPolishProgress.value
    addTask(t('t506', { arg0: p.current, arg1: p.total, arg2: p.label ? ' ' + p.label : '' }))
  }
  if (batchImageRunning.value) addTask(t('t507'))
  if (batchVideoRunning.value) addTask(t('t508'))
  return tasks
})
const sbCharacterIds = ref({})  // sbId -> number[] 多选角色
const sbPropIds = ref({})       // sbId -> number[] 多选物品
const sbSceneId = ref({})
const sbDialogue = ref({})
const sbNarration = ref({})
const sbShotType = ref({})
/** 视频提示词组成（可编辑），key 为分镜 id */
const sbTitle = ref({})
const sbLocation = ref({})
const sbTime = ref({})
const sbDuration = ref({})
const sbAction = ref({})
const sbResult = ref({})
const sbAtmosphere = ref({})
const sbAngle = ref({})
const sbAngleH = ref({})   // 结构化视角：水平方向
const sbAngleV = ref({})   // 结构化视角：俯仰角度
const sbAngleS = ref({})   // 结构化视角：景别
const sbMovement = ref({})
const sbLighting = ref({})   // 灯光风格
const sbDof = ref({})        // 景深
const sbLayoutDescription = ref({})  // 空间布局与人物站位描述（生成分镜时 AI 输出的最高优先级合同，用于首尾帧强制一致）
const regeneratingLayoutSbIds = reactive(new Set())  // 正在 AI 重新生成布局描述的分镜 id 集合
/** 分镜创作模式：classic | universal（默认 classic，存库 storyboards.creation_mode） */
const sbCreationMode = ref({})
/** 全能模式片段描述（存库 universal_segment_text，与经典参考图字段独立） */
const sbUniversalSegmentText = ref({})
// 分镜图片/视频列表（由 /images?storyboard_id=xx 和 /videos?storyboard_id=xx 拉取）
const sbImages = ref({})
const sbVideos = ref({})
const sbVideoErrors = ref({})
const generatingSbImageIds = reactive(new Set())
const generatingSbVideoIds = reactive(new Set())
const generatingUniversalSegmentIds = reactive(new Set())
// 重新生成角色/场景/道具关联分镜图的 loading set，key: 'char-{id}' | 'scene-{id}' | 'prop-{id}'
const regenSbImagesForAsset = reactive(new Set())
const regenSbImagesProgress = ref({})
// 批量生成分镜图
const batchImageRunning = ref(false)
const batchImageStopping = ref(false)
const batchImageProgress = ref({ current: 0, total: 0, failed: 0 })
const inferringParams = ref(false)
const showVideoParamsDialog = ref(false)
const videoParamsTarget = ref(null)
const videoParamsSaving = ref(false)
const splitByAudioLoading = ref(false)
const batchImageErrors = ref([])
// 批量生成分镜视频
const batchVideoRunning = ref(false)
const batchVideoStopping = ref(false)
const batchVideoProgress = ref({ current: 0, total: 0, failed: 0 })
const batchVideoErrors = ref([])
// P0-1: 连贯帧模式
const videoFrameContiguity = ref(false)
// P0-3: 分镜超分辨率 loading set
const upscalingSbIds = reactive(new Set())
// P2-4: TTS 状态
const ttsSbIds = reactive(new Set())
const ttsSbNarrationIds = reactive(new Set())
// 尾帧衔接 loading 状态
const linkingTailFrameIds = reactive(new Set())
// “上镜尾帧”（将上一分镜尾帧图片直接设为当前首帧）loading 状态
const usingPrevTailAsFirstIds = reactive(new Set())
/** 对白 TTS 路径缓存（与 storyboards.audio_local_path 一致） */
const sbDialogueAudioPaths = ref({})
/** 解说旁白 TTS 路径缓存（与 storyboards.narration_audio_local_path 一致） */
const sbNarrationAudioPaths = ref({})
/** 分镜 TTS 试听：避免多条同时播放 */
let sbTtsPreviewAudio = null
/** 正在编辑视频提示词的分镜 id；编辑中显示文本框与保存/取消 */
const editingSbVideoPromptId = ref(null)
const editingSbVideoPromptText = ref('')
/** 正在编辑图片提示词的分镜 id（行内编辑，保留供内部 onSaveSbImagePrompt 使用） */
const editingSbImagePromptId = ref(null)
const editingSbImagePromptText = ref('')
/** 分镜提示词弹窗 */
const showSbPromptDialog = ref(false)
const sbPromptTarget = ref(null)
const sbPromptImageText = ref('')       // 原始 image_prompt
const sbPromptPolishedText = ref('')    // AI 优化后 polished_prompt
const sbPromptVideoText = ref('')       // video_prompt
const sbPromptSaving = ref(false)
const sbPromptPolishing = ref(false)
/** 首尾帧提示词编辑器 */
const showFramePromptEditor = ref(false)
const editingFramePromptSb = ref(null)
const editingFramePromptSlot = ref('first') // 'first' | 'last'
const editingFramePromptText = ref('')
const editingFramePromptSaving = ref(false)
const editingFramePromptRegenerating = ref(false)
const uploadingSbImageId = ref(null)
const sbImageFileInput = ref(null)
const sbImageUploadForId = ref(null)
// 角色/道具/场景 上传图片
const resourceImageFileInput = ref(null)
const resourceUploadType = ref(null) // 'character' | 'prop' | 'scene'
const resourceUploadId = ref(null)
const uploadingResourceId = ref(null) // 'char-1' | 'prop-2' | 'scene-3'
const dragOverResourceKey = ref(null) // 'char-1' | 'prop-2' | 'scene-3'
const dragOverSbId = ref(null)
// 公共库弹窗状态已移至各 composable
const storyboardCount = ref(null) // 分镜数量
const videoDuration = ref(null) // 视频总长度
/** 分镜生成时是否要求 AI 输出 narration（解说旁白） */
const storyboardIncludeNarration = ref(false)
/** 分镜生成是否使用全能模式（universal_segment_text，对接 Seedance / 可灵 Omni） */
const storyboardUniversalOmni = ref(false)
const storyboardUseFirstLastFrame = ref(false)
const exportingStoryboardSheet = ref(false)
/** 生成尾帧时是否注入首帧作站位/构图参考（默认开启） */
const lastFrameUseFirstLayoutLock = ref(true)
const gridMode = ref('single') // 序列图模式：single / quad_grid / nine_grid

// ── 剧本长度 → 估算总时长；自动分镜数与项目「每段秒数」(videoClipDuration) 对齐 ──

/** 用于估算的每段时长（秒），与一键成片处「X秒/段」一致 */
function clipSecondsForStoryboardEstimate() {
  const c = Number(videoClipDuration.value)
  return Math.max(2, Math.min(60, Number.isFinite(c) && c > 0 ? c : 5))
}

/** 由估算总时长与每段秒数得镜数中枢与宽松参考区间（±1 镜） */
function shotCountEstimateFromDurationSec(sec) {
  const s = Math.max(10, Math.min(600, Math.round(Number(sec) || 0)))
  const clip = clipSecondsForStoryboardEstimate()
  const ideal = s / clip
  const locked = Math.max(1, Math.min(200, Math.round(ideal)))
  const minR = Math.max(1, locked - 1)
  const maxR = Math.min(200, locked + 1)
  const range = minR >= maxR ? { min: locked, max: locked } : { min: minR, max: maxR }
  return { locked, range, clip }
}

/** 由剧本字符数粗估成片总时长（短剧偏长镜）：秒数 = round(10 + (字数/600)×60)，夹在 10–600s */
function estimateVideoDurationSecFromCharLen(charLen) {
  const len = Math.max(0, Math.floor(Number(charLen) || 0))
  if (len < 1) return null
  const raw = Math.round(10 + (len / 600) * 60)
  return Math.min(600, Math.max(10, raw))
}

/** 当前剧本下的估算：总秒数、镜数中枢、镜数区间、采用的每段秒数 */
const scriptStoryboardEstimate = computed(() => {
  const script = (scriptContent.value || '').toString().trim()
  const len = script.length
  if (!len) return null
  const sec = estimateVideoDurationSecFromCharLen(len)
  if (sec == null) return null
  const { locked, range, clip } = shotCountEstimateFromDurationSec(sec)
  return { sec, locked, range, clip, len }
})

const scriptEstimateVideoDurationHint = computed(() => {
  const e = scriptStoryboardEstimate.value
  if (!e) return ''
  return t('t509', { arg0: e.sec })
})

const scriptEstimateVideoDurationTitle = computed(() => {
  const e = scriptStoryboardEstimate.value
  if (!e) return ''
  return t('t510', { arg0: e.len, arg1: e.sec })
})

const scriptEstimateStoryboardHint = computed(() => {
  const e = scriptStoryboardEstimate.value
  if (!e) return ''
  if (e.range && e.range.min !== e.range.max) {
    return t('t511', { arg0: e.locked, arg1: e.range.min, arg2: e.range.max })
  }
  return t('t512', { arg0: e.locked })
})

const scriptEstimateStoryboardTitle = computed(() => {
  const e = scriptStoryboardEstimate.value
  if (!e) return ''
  return t('t513', { arg0: e.sec, arg1: e.clip, arg2: e.locked })
})

function scriptTextTrimmedForEstimate() {
  return (scriptContent.value || '').toString().trim()
}

function userFilledStoryboardCount() {
  const v = storyboardCount.value
  return v != null && Number.isFinite(Number(v)) && Number(v) >= 1
}

function userFilledVideoDuration() {
  const v = videoDuration.value
  return v != null && Number.isFinite(Number(v)) && Number(v) >= 10
}

/** 请求后端的视频总时长：仅未手动填时传剧本估算 */
function getVideoDurationForApi() {
  if (userFilledVideoDuration()) return Math.round(Number(videoDuration.value))
  const len = scriptTextTrimmedForEstimate().length
  if (len < 1) return undefined
  return estimateVideoDurationSecFromCharLen(len) ?? undefined
}

/** 请求后端的分镜数量：仅未手动填时按「估算总时长 ÷ 每段秒数」推算，与项目 X秒/段 一致 */
function getStoryboardCountForApi() {
  if (userFilledStoryboardCount()) return Math.round(Number(storyboardCount.value))
  const sec = getVideoDurationForApi()
  if (sec == null || !Number.isFinite(sec)) return undefined
  return shotCountEstimateFromDurationSec(sec).locked
}

function getFirstImageFile(dataTransfer) {
  if (!dataTransfer?.files?.length) return null
  const file = Array.from(dataTransfer.files).find((f) => f.type.startsWith('image/'))
  return file || null
}

// ── 参考图文件读取工具 ──────────────────────────────────
function readFileAsRefImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (ev) => resolve({ dataUrl: ev.target.result, filename: file.name })
    reader.readAsDataURL(file)
  })
}

/**
 * 处理角色/道具/场景参考图文件选择（<input type="file"> change 事件）
 * type: 'character' | 'prop' | 'scene'
 */
async function onRefImageFileChange(type, event) {
  const file = event.target?.files?.[0]
  if (!file) return
  const result = await readFileAsRefImage(file)
  if (type === 'character') addCharRefImage.value = result
  else if (type === 'prop') addPropRefImage.value = result
  else if (type === 'scene') addSceneRefImage.value = result
  event.target.value = ''
}

/**
 * 处理角色/道具/场景参考图拖放（drop 事件）
 * type: 'character' | 'prop' | 'scene'
 */
async function onRefImageDrop(type, event) {
  const file = getFirstImageFile(event.dataTransfer)
  if (!file) return
  const result = await readFileAsRefImage(file)
  if (type === 'character') addCharRefImage.value = result
  else if (type === 'prop') addPropRefImage.value = result
  else if (type === 'scene') addSceneRefImage.value = result
}

/**
 * 处理"添加道具"简单弹窗的参考图文件选择
 * type: 'addProp'
 */
async function onRefImageFileChange2(type, event) {
  const file = event.target?.files?.[0]
  if (!file) return
  const result = await readFileAsRefImage(file)
  if (type === 'addProp') addPropAddRefImage.value = result
  event.target.value = ''
}

/**
 * 处理"添加道具"简单弹窗的参考图拖放
 * type: 'addProp'
 */
async function onRefImageDrop2(type, event) {
  const file = getFirstImageFile(event.dataTransfer)
  if (!file) return
  const result = await readFileAsRefImage(file)
  if (type === 'addProp') addPropAddRefImage.value = result
}

/**
 * 从本地选择（尚未保存到服务器）的参考图中提取特征描述
 * type: 'character' | 'prop' | 'scene'
 */
async function doExtractFromRef(type) {
  if (type === 'character') {
    const refImage = addCharRefImage.value
    if (!refImage) return
    extractingCharAppearance.value = true
    try {
      const name = editCharacterForm.value?.name || ''
      const res = await uploadAPI.extractDescriptionFromImage('character', refImage.dataUrl, name)
      if (res?.description && editCharacterForm.value) {
        editCharacterForm.value.appearance = res.description
        ElMessage.success(t('t514'))
      }
    } catch (e) {
      ElMessage.error(e.message || t('t515'))
    } finally {
      extractingCharAppearance.value = false
    }
  } else if (type === 'prop') {
    const refImage = addPropRefImage.value
    if (!refImage) return
    extractingPropDesc.value = true
    try {
      const name = editPropForm.value?.name || ''
      const res = await uploadAPI.extractDescriptionFromImage('prop', refImage.dataUrl, name)
      if (res?.description && editPropForm.value) {
        editPropForm.value.description = res.description
        ElMessage.success(t('t516'))
      }
    } catch (e) {
      ElMessage.error(e.message || t('t515'))
    } finally {
      extractingPropDesc.value = false
    }
  } else if (type === 'scene') {
    const refImage = addSceneRefImage.value
    if (!refImage) return
    extractingSceneDesc.value = true
    try {
      const name = editSceneForm.value?.name || ''
      const res = await uploadAPI.extractDescriptionFromImage('scene', refImage.dataUrl, name)
      if (res?.description && editSceneForm.value) {
        editSceneForm.value.description = res.description
        ElMessage.success(t('t517'))
      }
    } catch (e) {
      ElMessage.error(e.message || t('t515'))
    } finally {
      extractingSceneDesc.value = false
    }
  }
}

function onResourceDragOver(e, type, id) {
  e.preventDefault()
  e.stopPropagation()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  const key = type === 'character' ? 'char-' : type === 'prop' ? 'prop-' : 'scene-'
  dragOverResourceKey.value = key + id
}
function onResourceDragLeave(e, key) {
  e.preventDefault()
  if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return
  if (key && dragOverResourceKey.value !== key) return
  dragOverResourceKey.value = null
}
function onResourceDrop(e, type, id) {
  e.preventDefault()
  e.stopPropagation()
  dragOverResourceKey.value = null
  const file = getFirstImageFile(e.dataTransfer)
  if (file) doUploadResourceImage(type, id, file)
}
function onSbImageDragOver(e, sbId) {
  e.preventDefault()
  e.stopPropagation()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  dragOverSbId.value = sbId
}
function onSbImageDragLeave(e, sbId) {
  e.preventDefault()
  if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return
  if (sbId != null && dragOverSbId.value !== sbId) return
  dragOverSbId.value = null
}
function onSbImageDrop(e, sb) {
  e.preventDefault()
  e.stopPropagation()
  dragOverSbId.value = null
  const file = getFirstImageFile(e.dataTransfer)
  if (file && sb?.id) doUploadSbImage(sb.id, file)
}

const baseUrl = ref('')
const previewImageUrl = ref(null)
function imageUrl(url) {
  if (!url) return ''
  if (url.startsWith('http')) return url
  const base = (baseUrl.value || '').replace(/\/$/, '')
  return base ? base + '/' + url.replace(/^\//, '') : url
}
/** 优先使用本地地址，避免远程图失效。item 为 { image_url, local_path } 或字符串 url */
function assetImageUrl(item) {
  if (!item) return ''
  if (typeof item === 'string') return imageUrl(item)
  const localPath = item.local_path && String(item.local_path).trim()
  if (localPath) {
    const p = localPath.replace(/^\//, '')
    return '/static/' + p
  }
  if (item.image_url) return imageUrl(item.image_url)
  return ''
}
function hasAssetImage(item) {
  if (!item) return false
  return !!(item.image_url || item.local_path)
}
/** 就绪度：返回该分镜缺失的素材清单（[] 表示齐全），供合成前告警 */
function storyboardMissingAssets(sb) {
  const lacks = []
  if (!sb) return lacks
  const hasImg = hasAssetImage(sb) || (Array.isArray(sb.images) && sb.images.some((im) => im && hasAssetImage(im)))
  if (!hasImg) lacks.push('截图')
  const vidList = sbVideos.value?.[sb.id] || []
  const hasVid = vidList.some((v) => v.status === 'completed' && recordHasPlayableVideoUrl(v))
  if (!hasVid) lacks.push('视频')
  return lacks
}
function getSelectedStyle() {
  return getSelectedStylePrompt()
}
function openImagePreview(url) {
  previewImageUrl.value = url
}
function closeImagePreview() {
  previewImageUrl.value = null
}
/** 视频地址：优先 local_path（/static/），否则 video_url */
function assetVideoUrl(item) {
  if (!item) return ''
  const localPath = item.local_path && String(item.local_path).trim()
  if (localPath) return '/static/' + localPath.replace(/^\//, '')
  if (item.video_url) return imageUrl(item.video_url)
  return ''
}
/** 远程视频须为 http(s)，避免上游 FAILURE 时把错误文案写入 video_url */
function isHttpVideoUrl(url) {
  if (!url || typeof url !== 'string') return false
  const t = url.trim()
  return t.startsWith('http://') || t.startsWith('https://')
}
/** 列表项是否具备可播放地址（避免仅有空白 local_path 时外层有卡片、内层无 <video>） */
function recordHasPlayableVideoUrl(i) {
  if (!i) return false
  const lp = i.local_path && String(i.local_path).trim()
  if (lp) return true
  return isHttpVideoUrl(i.video_url)
}
/** 主播放器强制随记录/地址重建，避免重新生成后 <video> 仍缓存旧 src */
function sbMainVideoPlayerKey(sbId) {
  const v = getSbVideo(sbId)
  if (!v) return ''
  const src = assetVideoUrl(v)
  return `${v.id}:${v.updated_at || ''}:${src.slice(0, 160)}`
}
function onStoryboardUseFirstLastFrameChange() {
  if (storyboardUseFirstLastFrame.value && gridMode.value !== 'single') {
    gridMode.value = 'single'
    ElMessage.info(t('t518'))
  }
  saveProjectSettings(false)
}

function uploadingSbImageSlot(sbId) {
  return sbImageUploadSlotById.value[sbId] || null
}

function frameTypeForSlot(slot) {
  return slot === 'last' ? 'storyboard_last' : 'storyboard_first'
}

function resolveSbImageById(storyboardId, imageId) {
  if (imageId == null) return null
  const images = getSbAllImages(storyboardId)
  return images.find((i) => i.id === imageId) || null
}

/** 首帧图（首尾帧模式下严格优先服务器绑定的 first_frame_image_id） */
function getSbFirstImage(storyboardId) {
  const images = getSbAllImages(storyboardId)
  const sb = (store.storyboards || []).find((b) => b.id === storyboardId)

  // 最高权威：服务器已绑定的首帧
  if (sb?.first_frame_image_id != null) {
    const bound = resolveSbImageById(storyboardId, sb.first_frame_image_id)
    if (bound) return bound
  }

  const sel = sbSelectedImgId.value[storyboardId]
  if (sel != null) {
    const found = images.find((i) => i.id === sel)
    if (found) return found
  }

  const typed = images.find((i) => i.frame_type === 'storyboard_first')
  if (typed) return typed
  // 不再回退到 images[0]，避免把尾帧图片误显示为首帧
  return null
}

/** 尾帧图（首尾帧模式下严格优先服务器绑定的 last_frame_image_id） */
function getSbLastImage(storyboardId) {
  const images = getSbAllImages(storyboardId)
  const sb = (store.storyboards || []).find((b) => b.id === storyboardId)

  // 最高权威：服务器已绑定的尾帧（后端 bindStoryboardFrameImage 正确写入的 last_frame_image_id）
  if (sb?.last_frame_image_id != null) {
    const bound = resolveSbImageById(storyboardId, sb.last_frame_image_id)
    if (bound) return bound
  }

  // 仅在没有服务器绑定时才考虑手动选择（首尾帧生成后我们会主动清除手动选择）
  const sel = sbSelectedLastImgId.value[storyboardId]
  if (sel != null) {
    const found = images.find((i) => i.id === sel)
    if (found) return found
  }

  const typed = images.find((i) => i.frame_type === 'storyboard_last')
  if (typed) return typed

  if (sb?.last_frame_image_url || sb?.last_frame_local_path) {
    return {
      id: sb.last_frame_image_id,
      image_url: sb.last_frame_image_url,
      local_path: sb.last_frame_local_path,
      frame_type: 'storyboard_last',
    }
  }
  return null
}

/** 该分镜是否有图（接口拉取的或 composed_image） */
function hasSbImage(sb) {
  if (storyboardUseFirstLastFrame.value && !isSbUniversalMode(sb.id)) {
    return !!(getSbFirstImage(sb.id) || (sb && (sb.composed_image || sb.image_url)))
  }
  return !!(getSbImage(sb.id) || (sb && (sb.composed_image || sb.image_url)))
}

function hasSbFirstLastPair(sb) {
  return !!(getSbFirstImage(sb.id) && getSbLastImage(sb.id))
}
/** 取该分镜下所有已完成的非四宫格图片列表 */
function getSbAllImages(storyboardId) {
  const list = sbImages.value[storyboardId]
  if (!Array.isArray(list)) return []
  return list.filter((i) => i.status === 'completed' && i.frame_type !== 'quad_grid' && i.frame_type !== 'nine_grid' && (i.image_url || i.local_path))
}
/** 取当前主图（首尾帧模式下等同首帧） */
function getSbImage(storyboardId) {
  if (storyboardUseFirstLastFrame.value) return getSbFirstImage(storyboardId)
  const images = getSbAllImages(storyboardId)
  if (!images.length) return null
  const selectedId = sbSelectedImgId.value[storyboardId]
  if (selectedId != null) {
    const found = images.find((i) => i.id === selectedId)
    if (found) return found
  }
  return images[0]
}
/** 取该分镜下的四宫格整图记录 */
/** 取该分镜下的四宫格整图记录 */
function getQuadGridImage(storyboardId) {
  const list = sbImages.value[storyboardId]
  if (!Array.isArray(list)) return null
  return list.find((i) => i.status === 'completed' && (i.frame_type === 'quad_grid' || i.frame_type === 'nine_grid') && (i.image_url || i.local_path)) || null
}
/** 取该分镜所有已完成的视频记录 */
function getSbAllVideos(storyboardId) {
  const list = sbVideos.value[storyboardId]
  if (!Array.isArray(list)) return []
  return list.filter((i) => i.status === 'completed' && recordHasPlayableVideoUrl(i))
}
/** 取该分镜当前选中的视频（尊重 sbSelectedVideoId，否则默认第一条） */
function getSbVideo(storyboardId) {
  const all = getSbAllVideos(storyboardId)
  if (all.length === 0) return null
  const selectedId = sbSelectedVideoId.value[storyboardId]
  if (selectedId != null) {
    const found = all.find((v) => v.id === selectedId)
    if (found) return found
  }
  return all[0]
}
/** 取下一个分镜（按 storyboard_number 顺序） */
function getNextStoryboard(storyboardId) {
  const list = store.storyboards || []
  const idx = list.findIndex((s) => s.id === storyboardId)
  if (idx === -1 || idx === list.length - 1) return null
  return list[idx + 1]
}

/** 取上一个分镜（按 storyboard_number 顺序，用于“上镜尾帧”快速衔接） */
function getPrevStoryboard(storyboardId) {
  const list = store.storyboards || []
  const idx = list.findIndex((s) => s.id === storyboardId)
  if (idx === -1 || idx === 0) return null
  return list[idx - 1]
}

/** 辅助判断：当前分镜是否有“上一镜尾帧”可用于快速替换首帧 */
function canUsePrevTailAsFirst(sb) {
  const p = getPrevStoryboard(sb?.id)
  return !!(p && getSbLastImage(p.id))
}

/** 视频历史条：返回非当前选中的已完成视频列表 */
function getVideoStripItems(storyboardId) {
  const all = getSbAllVideos(storyboardId)
  const current = getSbVideo(storyboardId)
  return all
    .filter((v) => !current || v.id !== current.id)
    .map((v, idx) => ({
      key: `vid-${v.id}`,
      video: v,
      src: assetVideoUrl(v),
      label: t('t519', { arg0: idx + 2 }),
    }))
}
/** 选中某条历史视频为当前视频，并持久化到分镜记录供合成视频使用 */
function onSelectSbMainVideo(sb, video) {
  sbSelectedVideoId.value = { ...sbSelectedVideoId.value, [sb.id]: video.id }
  storyboardsAPI.update(sb.id, {
    video_url: video.video_url || null,
    local_path: video.local_path || undefined,
  }).catch(e => console.warn('[主视频] 保存后端失败', e))
}
/** 取该分镜最近一次视频生成的错误信息（从 API 返回的记录或本地即时错误） */
function getSbVideoError(storyboardId) {
  if (sbVideoErrors.value[storyboardId]) return sbVideoErrors.value[storyboardId]
  const list = sbVideos.value[storyboardId]
  if (!Array.isArray(list) || list.length === 0) return ''
  const hasCompleted = list.some((i) => i.status === 'completed' && recordHasPlayableVideoUrl(i))
  if (hasCompleted) return ''
  const bogusCompleted = list.find(
    (i) => i.status === 'completed' && i.video_url && !recordHasPlayableVideoUrl(i)
  )
  if (bogusCompleted) {
    const u = String(bogusCompleted.video_url || '').trim()
    if (u) return u
    if (bogusCompleted.error_msg) return bogusCompleted.error_msg
  }
  const failed = list.filter((i) => i.status === 'failed' && i.error_msg)
  if (failed.length === 0) return ''
  return failed[0].error_msg
}

async function loadStoryboardMedia() {
  const boards = store.storyboards || []
  if (boards.length === 0) {
    sbImages.value = {}
    sbVideos.value = {}
    return
  }
  const nextImages = { ...sbImages.value }
  const nextVideos = { ...sbVideos.value }
  await Promise.all(
    boards.map(async (sb) => {
      try {
        const [imgRes, vidRes] = await Promise.all([
          imagesAPI.list({ storyboard_id: sb.id, page: 1, page_size: 100 }),
          videosAPI.list({ storyboard_id: sb.id, page: 1, page_size: 50 })
        ])
        nextImages[sb.id] = (imgRes && imgRes.items) ? imgRes.items : []
        nextVideos[sb.id] = (vidRes && vidRes.items) ? vidRes.items : []
      } catch (_) {
        nextImages[sb.id] = []
        nextVideos[sb.id] = []
      }
    })
  )
  sbImages.value = nextImages
  sbVideos.value = nextVideos
  // 从后端恢复主图选择
  restoreSelectionsFromBackend()
}

function getGeneratingSetsBag() {
  return {
    generatingCharIds,
    generatingPropIds,
    generatingSceneIds,
    generatingSbImageIds,
    generatingSbFirstImageIds,
    generatingSbLastImageIds,
    generatingSbVideoIds,
  }
}

function buildSbGenMeta(sb, resourceType, labelPrefix) {
  const num = sb?.storyboard_number ?? sb?.id
  const epNum = store.currentEpisode?.episode_number
  const dramaTitle = store.drama?.title || ''
  const epLabel = dramaTitle ? t('t520', { arg0: dramaTitle, arg1: epNum ?? '' }) : t('t521', { arg0: epNum ?? '' })
  return {
    dramaId: dramaId.value,
    episodeId: currentEpisodeId.value,
    dramaTitle,
    episodeNumber: epNum,
    resourceType,
    resourceId: sb.id,
    label: `${epLabel} ${labelPrefix} #${num}`,
  }
}

async function recoverAndSyncEpisodeTasks(epId) {
  const did = dramaId.value
  const eid = epId ?? currentEpisodeId.value
  if (!did || !eid) return
  const ctx = buildEpisodeContext(store, did, eid)
  await genStore.recoverPendingForEpisode({
    ...ctx,
    ElMessage,
    callbacks: {
      onStoryboardMedia: (sbId) => loadSingleStoryboardMedia(sbId),
      onDramaRefresh: () => loadDrama(),
      onEpisodeMergeComplete: () => {
        store.setVideoStatus('done', did, eid)
        store.setVideoProgress(100, did, eid)
      },
      onEpisodeMergeFailed: (err) => {
        store.setVideoStatus('error', did, eid)
        videoErrorMsg.value = err || t('t522')
      },
    },
  })
  syncGeneratingSetsFromStore(genStore, did, eid, getGeneratingSetsBag())
  const mergeRunning = genStore.getRunningForEpisode(did, eid).some(
    (t) => t.resourceType === GEN_RESOURCE.EPISODE_MERGE
  )
  if (mergeRunning) {
    store.setVideoStatus('generating', did, eid)
  }
}

/** 只刷新单条分镜的图片/视频，避免每次单图操作都全量请求所有分镜 */
async function loadSingleStoryboardMedia(sbId) {
  if (!sbId) return
  try {
    const [imgRes, vidRes] = await Promise.all([
      imagesAPI.list({ storyboard_id: sbId, page: 1, page_size: 100 }),
      videosAPI.list({ storyboard_id: sbId, page: 1, page_size: 50 })
    ])
    sbImages.value = {
      ...sbImages.value,
      [sbId]: (imgRes && imgRes.items) ? imgRes.items : []
    }
    sbVideos.value = {
      ...sbVideos.value,
      [sbId]: (vidRes && vidRes.items) ? vidRes.items : []
    }
    restoreSelectionsFromBackend()
  } catch (_) {
    // 静默忽略，不影响其他分镜的显示
  }
}

// ── 主图选择 ─────────────────────────────────────────────────────────

const sbSelectedImgId = ref({})   // sbId → 选中的首帧/主图 image_generation.id
const sbSelectedLastImgId = ref({}) // sbId → 选中的尾帧 image_generation.id
const sbSelectedVideoId = ref({}) // sbId → 选中的 video_generation.id
const generatingSbFirstImageIds = reactive(new Set())
const generatingSbLastImageIds = reactive(new Set())
/** sbId → 'first' | 'last'，上传目标槽位 */
const sbImageUploadSlotById = ref({})

/**
 * 从后端 storyboard.image_url / local_path 恢复主图选择状态。
 * 与 image_generation 记录比对，找到匹配的记录并恢复 sbSelectedImgId。
 */
function restoreSelectionsFromBackend() {
  const boards = store.storyboards || []
  for (const sb of boards) {
    const images = getSbAllImages(sb.id)
    if (sbSelectedImgId.value[sb.id] == null) {
      if (sb.first_frame_image_id != null) {
        sbSelectedImgId.value = { ...sbSelectedImgId.value, [sb.id]: sb.first_frame_image_id }
      } else {
        const sbPath = (sb.local_path || '').trim()
        const sbUrl = (sb.image_url || '').trim()
        if (sbPath || sbUrl) {
          const matched = images.find(
            (img) =>
              (sbPath && img.local_path && img.local_path === sbPath) ||
              (sbUrl && img.image_url && img.image_url === sbUrl)
          )
          if (matched) {
            sbSelectedImgId.value = { ...sbSelectedImgId.value, [sb.id]: matched.id }
          }
        }
      }
    }
    if (sbSelectedLastImgId.value[sb.id] == null && sb.last_frame_image_id != null) {
      sbSelectedLastImgId.value = { ...sbSelectedLastImgId.value, [sb.id]: sb.last_frame_image_id }
    }
  }
}

/** 获取缩略图条数据：已绑定首尾帧以外的历史图 */
function getStripItems(storyboardId) {
  const allImgs = getSbAllImages(storyboardId)
  const firstImg = storyboardUseFirstLastFrame.value ? getSbFirstImage(storyboardId) : getSbImage(storyboardId)
  const lastImg = storyboardUseFirstLastFrame.value ? getSbLastImage(storyboardId) : null
  const boundIds = new Set([firstImg?.id, lastImg?.id].filter((x) => x != null))
  return allImgs
    .filter((img) => !boundIds.has(img.id))
    .map((img) => ({
      key: `img-${img.id}`,
      src: assetImageUrl(img),
      type: 'img',
      img,
      label: quadPanelLabel(img.frame_type),
      frameBadge: img.frame_type === 'storyboard_first' ? t('t523') : img.frame_type === 'storyboard_last' ? t('t524') : null,
      prompt: img.prompt || '',
    }))
}

function stripItemTitle(sbId, item) {
  const lines = [item.label, item.prompt].filter(Boolean)
  if (storyboardUseFirstLastFrame.value) {
    lines.unshift(t('t525'))
  } else {
    lines.unshift(t('t252'))
  }
  return lines.join('\n\n')
}

async function onStripItemClick(sb, item) {
  if (!storyboardUseFirstLastFrame.value) {
    onSelectStripItem(sb, item)
    return
  }
  try {
    await ElMessageBox.confirm(t('t526'), t('t527'), {
      confirmButtonText: t('t528'),
      cancelButtonText: t('t529'),
      distinguishCancelAndClose: true,
      type: 'info',
    })
    onSelectSbFrameImage(sb, item.img, 'first')
    ElMessage.success(t('t530'))
  } catch (action) {
    if (action === 'cancel') {
      onSelectSbFrameImage(sb, item.img, 'last')
      ElMessage.success(t('t531'))
    }
  }
}

/** 宫格子图位置标签 */
function quadPanelLabel(frameType) {
  const map = {
    quad_panel_0: t('t532'), quad_panel_1: t('t533'), quad_panel_2: t('t534'), quad_panel_3: t('t535'),
    nine_panel_0: t('t532'), nine_panel_1: t('t536'), nine_panel_2: t('t533'),
    nine_panel_3: t('t537'), nine_panel_4: t('t538'), nine_panel_5: t('t539'),
    nine_panel_6: t('t534'), nine_panel_7: t('t540'), nine_panel_8: t('t535'),
  }
  return map[frameType] || null
}

/** 点击缩略图条中的图片切换为主图 */
function onSelectStripItem(sb, item) {
  onSelectSbMainImage(sb, item.img)
}

/** 选定首帧或尾帧参考图（持久化到后端） */
function onSelectSbFrameImage(sb, img, slot) {
  if (!sb?.id || !img) return
  const isLast = slot === 'last'

  // 本地选中状态（用于部分回退逻辑）
  if (isLast) {
    sbSelectedLastImgId.value = { ...sbSelectedLastImgId.value, [sb.id]: img.id }
  } else {
    sbSelectedImgId.value = { ...sbSelectedImgId.value, [sb.id]: img.id }
  }

  // 关键：乐观更新 store 里分镜的权威绑定字段（storyboards 数组是 getSbFirst/LastImage 的主要数据源）
  // 这样点击后立即生效，无需刷新页面；getStripItems 也会立即把这张图从历史条里过滤掉
  const list = store.currentEpisode?.storyboards
  if (Array.isArray(list)) {
    const row = list.find((x) => Number(x.id) === Number(sb.id))
    if (row) {
      const now = new Date().toISOString()
      if (isLast) {
        row.last_frame_image_id = img.id
        row.last_frame_image_url = img.image_url || null
        row.last_frame_local_path = img.local_path || null
      } else {
        row.first_frame_image_id = img.id
        row.image_url = img.image_url || null
        row.local_path = img.local_path || null
      }
      row.updated_at = now
    }
  }

  // 发送到后端持久化（静默，调用方按需提示）
  const patch = { updated_at: new Date().toISOString() }
  if (isLast) {
    patch.last_frame_image_id = img.id
    patch.last_frame_image_url = img.image_url || null
    patch.last_frame_local_path = img.local_path || undefined
  } else {
    patch.image_url = img.image_url || null
    patch.local_path = img.local_path || undefined
    patch.first_frame_image_id = img.id
  }

  storyboardsAPI.update(sb.id, patch).catch((e) => console.warn('[参考帧] 保存失败', e))
}

/** 选定某张 API 图为主图（持久化到后端） */
function onSelectSbMainImage(sb, img) {
  onSelectSbFrameImage(sb, img, 'first')
}

/** 删除分镜历史参考图（strip 中的未绑定历史图，类似资源 extra 图的移除） */
async function onRemoveSbHistoryImage(storyboardId, imageGenId) {
  if (!storyboardId || !imageGenId) return
  try {
    await ElMessageBox.confirm(t('t541'), t('t248'), {
      confirmButtonText: t('t095'),
      cancelButtonText: t('t304'),
      type: 'warning',
      distinguishCancelAndClose: true,
    })
    await imagesAPI.delete(imageGenId)
    await loadSingleStoryboardMedia(storyboardId)
    ElMessage.success(t('t542'))
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') {
      ElMessage.error(err?.message || t('t543'))
    }
  }
}

/** 首帧图生提示词（与 onGenerateSbFrameImage 首帧分支一致） */
function buildFirstFrameImagePrompt(sbId) {
  const sbRow = (store.storyboards || []).find((b) => b.id === sbId)
  return (sbRow?.polished_prompt || sbRow?.image_prompt || sbRow?.description || '').toString().trim()
}

function buildLastFrameImagePrompt(sbId) {
  const parts = []
  const loc = (sbLocation.value[sbId] || '').toString().trim()
  const time = (sbTime.value[sbId] || '').toString().trim()
  if (loc) parts.push(time ? loc + '，' + time : loc)
  const shotType = (sbShotType.value[sbId] || '').toString().trim()
  if (shotType) parts.push(shotType)
  const angleH = sbAngleH.value[sbId] || ''
  const angleV = sbAngleV.value[sbId] || ''
  const angleS = sbAngleS.value[sbId] || ''
  if (angleH && angleV && angleS) {
    const { label } = angleToPromptFragment(angleH, angleV, angleS)
    parts.push(label)
  }
  const result = (sbResult.value[sbId] || '').toString().trim()
  const action = (sbAction.value[sbId] || '').toString().trim()
  if (result) parts.push(result)
  else if (action) parts.push(action)
  const atmosphere = (sbAtmosphere.value[sbId] || '').toString().trim()
  if (atmosphere) parts.push(atmosphere)
  const style = getSelectedStylePromptZh() || getSelectedStylePrompt() || ''
  if (style) parts.push(style)
  parts.push(t('t544'))
  return parts.join('，')
}

/** 从 frame_prompts 表读取已生成的专业帧提示词 */
async function getCachedFramePromptFromDb(sbId, slot) {
  const frameType = slot === 'last' ? 'last' : 'first'
  try {
    const res = await storyboardsAPI.getFramePrompts(sbId)
    const row = (res?.frame_prompts || []).find((r) => r.frame_type === frameType)
    return row?.prompt?.trim() || ''
  } catch (_) {
    return ''
  }
}

/**
 * 首尾帧模式：优先走 framePromptService（专用系统提示词 + 文本 AI），失败则回退字段拼接。
 */
async function ensureProfessionalFramePrompt(sb, slot, { forceRegenerate = false } = {}) {
  const frameType = slot === 'last' ? 'last' : 'first'
  if (!forceRegenerate) {
    const cached = await getCachedFramePromptFromDb(sb.id, slot)
    if (cached) return cached
  }
  try {
    const genRes = await storyboardsAPI.generateFramePrompt(sb.id, { frame_type: frameType })
    if (!genRes?.task_id) throw new Error(t('t545'))
    const pollRes = await pollTask(genRes.task_id)
    if (pollRes?.status !== 'completed') {
      throw new Error(pollRes?.error || t('t546'))
    }
    const fromTask = pollRes.result?.response?.single_frame?.prompt
    if (fromTask && String(fromTask).trim()) return String(fromTask).trim()
    const cached2 = await getCachedFramePromptFromDb(sb.id, slot)
    if (cached2) return cached2
  } catch (e) {
    console.warn('[首尾帧] 专业帧提示词生成失败，使用拼接回退', e?.message)
  }
  return slot === 'last' ? buildLastFrameImagePrompt(sb.id) : buildFirstFrameImagePrompt(sb.id)
}

/** 打开首尾帧提示词编辑器（显示最终发给AI生图的完整提示词，支持编辑保存） */
async function openFramePromptEditor(sb, slot) {
  if (!sb?.id) return
  editingFramePromptSb.value = sb
  editingFramePromptSlot.value = slot
  editingFramePromptText.value = ''
  showFramePromptEditor.value = true
  // 异步加载最终发给AI的真实提示词
  try {
    const pro = await ensureProfessionalFramePrompt(sb, slot)
    editingFramePromptText.value = pro || ''
  } catch (e) {
    editingFramePromptText.value = slot === 'last' ? buildLastFrameImagePrompt(sb.id) : buildFirstFrameImagePrompt(sb.id)
  }
}

/** 保存编辑后的帧提示词到 frame_prompts 表 */
async function saveEditingFramePrompt() {
  const sb = editingFramePromptSb.value
  const slot = editingFramePromptSlot.value
  if (!sb?.id || !slot) return
  const text = (editingFramePromptText.value || '').trim()
  if (!text) {
    ElMessage.warning(t('t547'))
    return
  }
  editingFramePromptSaving.value = true
  try {
    const frameType = slot === 'last' ? 'last' : 'first'
    await storyboardsAPI.saveFramePrompt(sb.id, frameType, { prompt: text })
    ElMessage.success(t('t548'))
    showFramePromptEditor.value = false
  } catch (e) {
    ElMessage.error(e.message || t('t549'))
  } finally {
    editingFramePromptSaving.value = false
  }
}

/** 重新生成专业帧提示词 */
async function regenerateEditingFramePrompt() {
  const sb = editingFramePromptSb.value
  const slot = editingFramePromptSlot.value
  if (!sb?.id || !slot) return
  editingFramePromptRegenerating.value = true
  try {
    ElMessage.info(t('t550'))
    const fresh = await ensureProfessionalFramePrompt(sb, slot, { forceRegenerate: true })
    editingFramePromptText.value = fresh || ''
    ElMessage.success(t('t551'))
  } catch (e) {
    ElMessage.error(e.message || t('t552'))
  } finally {
    editingFramePromptRegenerating.value = false
  }
}

// 兼容旧调用
const showSbFramePromptPreview = openFramePromptEditor

async function onGenerateSbFrameImage(sb, slot) {
  if (!dramaId.value || !sb?.id) return
  const isLast = slot === 'last'
  const loadingSet = isLast ? generatingSbLastImageIds : generatingSbFirstImageIds
  const meta = buildSbGenMeta(
    sb,
    isLast ? GEN_RESOURCE.SB_LAST_IMAGE : GEN_RESOURCE.SB_FIRST_IMAGE,
    isLast ? t('t243') : t('t237')
  )
  sb.errorMsg = ''
  sb.error_msg = ''
  loadingSet.add(sb.id)
  genStore.markRunning(meta)
  try {
    let idsToSave = sbCharacterIds.value[sb.id]
    if (idsToSave === undefined) {
      const sbRowForChars = (store.storyboards || []).find((b) => b.id === sb.id)
      const charList = Array.isArray(sbRowForChars?.characters) ? sbRowForChars.characters : []
      idsToSave = charList
        .map((c) => Number(typeof c === 'object' && c != null ? c.id : c))
        .filter((n) => Number.isFinite(n))
    }
    const sbRow = (store.storyboards || []).find((b) => b.id === sb.id)
    let prompt = ''
    if (storyboardUseFirstLastFrame.value) {
      // 须在 update(character_ids) 之前读取缓存：后端在角色未变时保留 frame_prompts，但先读可避免旧版误删
      prompt = await ensureProfessionalFramePrompt(sb, isLast ? 'last' : 'first')
    } else if (isLast) {
      prompt = buildLastFrameImagePrompt(sb.id) || sbRow?.image_prompt || sbRow?.description || ''
    } else {
      prompt = sbRow?.polished_prompt || sbRow?.image_prompt || sbRow?.description || ''
    }
    try {
      await storyboardsAPI.update(sb.id, { character_ids: Array.isArray(idsToSave) ? idsToSave : [] })
    } catch (e) {
      ElMessage.warning(t('t553'))
      return
    }
    // 尾帧可选附带首帧作构图/站位参考（「首帧站位」勾选时；后端亦会按 use_first_frame_layout_lock 兜底）
    let refImagesForCreate = undefined
    const useFirstLayoutLock = isLast && lastFrameUseFirstLayoutLock.value
    if (useFirstLayoutLock) {
      const firstImg = getSbFirstImage(sb.id)
      if (firstImg) {
        const firstUrl = assetImageUrl(firstImg) || firstImg.image_url || firstImg.local_path
        if (firstUrl) {
          refImagesForCreate = [firstUrl]
        }
      }
    }
    const res = await imagesAPI.create({
      storyboard_id: sb.id,
      drama_id: dramaId.value,
      prompt,
      model: undefined,
      style: getSelectedStyle(),
      frame_type: frameTypeForSlot(slot),
      aspect_ratio: projectAspectRatio.value || '16:9',
      reference_images: refImagesForCreate,
      use_first_frame_layout_lock: isLast ? !!lastFrameUseFirstLayoutLock.value : undefined,
    })
    ElMessage.success(isLast ? t('t554') : t('t555'))
    if (res?.task_id) {
      const pollRes = await pollTask(res.task_id, () => loadSingleStoryboardMedia(sb.id), meta)
      if (pollRes?.status === 'failed') {
        sb.errorMsg = pollRes.error || t('t552')
      } else {
        await loadDrama()
        restoreSelectionsFromBackend()

        // 关键修复：专用首/尾帧生成成功后，立即清除手动选择残留
        // 让 getSbLastImage / getSbFirstImage 严格走服务器已更新的 sb.last_frame_image_id（避免新图跑到历史列表）
        if (storyboardUseFirstLastFrame.value) {
          if (isLast) {
            delete sbSelectedLastImgId.value[sb.id]
          } else {
            delete sbSelectedImgId.value[sb.id]
          }
        }
      }
    } else {
      await loadSingleStoryboardMedia(sb.id)
      restoreSelectionsFromBackend()

      if (storyboardUseFirstLastFrame.value) {
        if (isLast) {
          delete sbSelectedLastImgId.value[sb.id]
        } else {
          delete sbSelectedImgId.value[sb.id]
        }
      }
    }
  } catch (e) {
    sb.errorMsg = e.message || t('t552')
    ElMessage.error(e.message || t('t552'))
  } finally {
    loadingSet.delete(sb.id)
    genStore.markDone(meta)
  }
}

async function onGenerateSbFramePair(sb) {
  const hasFirst = !!(getSbFirstImage(sb.id) || (sb.image_url || sb.composed_image))
  if (!hasFirst) {
    await onGenerateSbFrameImage(sb, 'first')
    if (!getSbFirstImage(sb.id) && !(sb.image_url || sb.composed_image)) return
  }
  await onGenerateSbFrameImage(sb, 'last')
}

// ──────────────────────────────────────────────────────────────────────

async function onGenerateSbImage(sb) {
  if (!dramaId.value || !sb?.id) return
  sb.errorMsg = ''
  sb.error_msg = ''
  const meta = buildSbGenMeta(sb, GEN_RESOURCE.SB_IMAGE, t('t502'))
  generatingSbImageIds.add(sb.id)
  genStore.markRunning(meta)
  try {
    let idsToSave = sbCharacterIds.value[sb.id]
    if (idsToSave === undefined) {
      const charList = Array.isArray(sb.characters) ? sb.characters : []
      idsToSave = charList
        .map((c) => Number(typeof c === 'object' && c != null ? c.id : c))
        .filter((n) => Number.isFinite(n))
    }
    try {
      await storyboardsAPI.update(sb.id, { character_ids: Array.isArray(idsToSave) ? idsToSave : [] })
    } catch (e) {
      console.warn('[分镜图] 保存角色勾选失败', e)
      ElMessage.warning(t('t556'))
      return
    }
    const res = await imagesAPI.create({
      storyboard_id: sb.id,
      drama_id: dramaId.value,
      prompt: sb.polished_prompt || sb.image_prompt || sb.description || '',
      model: undefined,
      style: getSelectedStyle(),
      frame_type: gridMode.value !== 'single' ? gridMode.value : undefined,
      aspect_ratio: projectAspectRatio.value || '16:9',
    })
    ElMessage.success(t('t557'))
    if (res?.task_id) {
      const pollRes = await pollTask(res.task_id, () => loadSingleStoryboardMedia(sb.id), meta)
      if (pollRes?.status === 'failed') {
        sb.errorMsg = pollRes.error || t('t552')
      } else {
        ElMessage.success(t('t558'))
      }
    } else {
      await loadSingleStoryboardMedia(sb.id)
    }
  } catch (e) {
    console.error(e)
    sb.errorMsg = e.message || t('t552')
    ElMessage.error(e.message || t('t552'))
  } finally {
    generatingSbImageIds.delete(sb.id)
    genStore.markDone(meta)
  }
}

function onUploadSbImageClick(sb, slot = 'first') {
  if (!sb?.id) return
  sbImageUploadForId.value = sb.id
  sbImageUploadSlotById.value = { ...sbImageUploadSlotById.value, [sb.id]: slot }
  if (!storyboardUseFirstLastFrame.value) {
    uploadingSbImageId.value = sb.id
  }
  if (sbImageFileInput.value) {
    sbImageFileInput.value.value = ''
    sbImageFileInput.value.click()
  }
}

async function doUploadSbImage(sbId, file, slot = 'first') {
  if (!file || !sbId || !dramaId.value) return
  const useSlot = storyboardUseFirstLastFrame.value ? slot : 'first'
  if (storyboardUseFirstLastFrame.value) {
    sbImageUploadSlotById.value = { ...sbImageUploadSlotById.value, [sbId]: useSlot }
  } else {
    uploadingSbImageId.value = sbId
  }
  try {
    const res = await uploadAPI.uploadImage(file, { dramaId: dramaId.value })
    const url = res?.url || res?.path
    const localPath = res?.local_path
    if (!url && !localPath) {
      ElMessage.error(t('t559'))
      return
    }
    const uploaded = await imagesAPI.upload({
      storyboard_id: sbId,
      drama_id: dramaId.value,
      image_url: url || '',
      local_path: localPath || undefined,
      frame_type: storyboardUseFirstLastFrame.value ? frameTypeForSlot(useSlot) : undefined,
    })
    ElMessage.success(useSlot === 'last' ? t('t560') : t('t561'))
    if (uploaded?.id) {
      const sb = (store.storyboards || []).find((b) => b.id === sbId)
      if (sb) onSelectSbFrameImage(sb, uploaded, useSlot)
    } else if (!storyboardUseFirstLastFrame.value) {
      const { [sbId]: _r, ...rest } = sbSelectedImgId.value
      sbSelectedImgId.value = rest
    }
    await loadSingleStoryboardMedia(sbId)
    restoreSelectionsFromBackend()
  } catch (e) {
    ElMessage.error(e.message || t('t562'))
  } finally {
    uploadingSbImageId.value = null
    const next = { ...sbImageUploadSlotById.value }
    delete next[sbId]
    sbImageUploadSlotById.value = next
  }
}

function onSbImageFileChange(ev) {
  const file = ev.target?.files?.[0]
  const sid = sbImageUploadForId.value
  if (!file || !sid) {
    ev.target.value = ''
    return
  }
  const slot = sbImageUploadSlotById.value[sid] || 'first'
  doUploadSbImage(sid, file, slot).finally(() => {
    sbImageUploadForId.value = null
    ev.target.value = ''
  })
}

function syncStoryboardStateFromEpisode(ep) {
  const boards = ep?.storyboards || []
  const nextCharIds = {}
  const nextPropIds = {}
  const nextScene = {}
  const nextDialogue = {}
  const nextNarration = {}
  const nextShot = {}
  const nextTitle = {}
  const nextLocation = {}
  const nextTime = {}
  const nextDuration = {}
  const nextAction = {}
  const nextResult = {}
  const nextAtmosphere = {}
  const nextAngle = {}
  const nextAngleH = {}
  const nextAngleV = {}
  const nextAngleS = {}
  const nextMovement = {}
  const nextLighting = {}
  const nextDof = {}
  const nextLayoutDescription = {}
  const nextCreationMode = {}
  const nextUniversalSegment = {}
  for (const sb of boards) {
    nextScene[sb.id] = sb.scene_id ?? null
    nextDialogue[sb.id] = sb.dialogue ?? ''
    nextNarration[sb.id] = sb.narration ?? ''
    nextShot[sb.id] = (sb.shot_type ?? '').toString() || ''
    nextTitle[sb.id] = (sb.title ?? '').toString()
    nextLocation[sb.id] = (sb.location ?? '').toString()
    nextTime[sb.id] = (sb.time ?? '').toString()
    nextDuration[sb.id] = sb.duration != null ? Number(sb.duration) : 5
    nextAction[sb.id] = (sb.action ?? '').toString()
    nextResult[sb.id] = (sb.result ?? '').toString()
    nextAtmosphere[sb.id] = (sb.atmosphere ?? '').toString()
    nextAngle[sb.id] = (sb.angle ?? '').toString()
    nextAngleH[sb.id] = sb.angle_h || ''
    nextAngleV[sb.id] = sb.angle_v || ''
    nextAngleS[sb.id] = sb.angle_s || ''
    nextMovement[sb.id] = (sb.movement ?? '').toString()
    nextLighting[sb.id] = sb.lighting_style || ''
    nextDof[sb.id] = sb.depth_of_field || ''
    nextLayoutDescription[sb.id] = (sb.layout_description ?? '').toString()
    const charList = Array.isArray(sb.characters) ? sb.characters : (sb.characters != null ? [sb.characters] : [])
    nextCharIds[sb.id] = charList.map((c) => (typeof c === 'object' && c != null ? Number(c.id) : Number(c))).filter((n) => Number.isFinite(n))
    nextPropIds[sb.id] = Array.isArray(sb.prop_ids) ? sb.prop_ids : []
    nextCreationMode[sb.id] = sb.creation_mode === 'universal' ? 'universal' : 'classic'
    nextUniversalSegment[sb.id] = (sb.universal_segment_text ?? '').toString()
  }
  sbCharacterIds.value = nextCharIds
  sbPropIds.value = nextPropIds
  sbSceneId.value = nextScene
  sbDialogue.value = nextDialogue
  sbNarration.value = nextNarration
  sbShotType.value = nextShot
  sbTitle.value = nextTitle
  sbLocation.value = nextLocation
  sbTime.value = nextTime
  sbDuration.value = nextDuration
  sbAction.value = nextAction
  sbResult.value = nextResult
  sbAtmosphere.value = nextAtmosphere
  sbAngle.value = nextAngle
  sbAngleH.value = nextAngleH
  sbAngleV.value = nextAngleV
  sbAngleS.value = nextAngleS
  sbMovement.value = nextMovement
  sbLighting.value = nextLighting
  sbDof.value = nextDof
  sbLayoutDescription.value = nextLayoutDescription
  sbCreationMode.value = nextCreationMode
  sbUniversalSegmentText.value = nextUniversalSegment
}

function onEpisodeSelect(epId) {
  if (epId == null) {
    store.setCurrentEpisode(null)
    store.setScriptContent('')
    scriptTitle.value = ''
    syncStoryboardStateFromEpisode(null)
    return
  }
  const list = store.drama?.episodes || []
  const ep = list.find((e) => Number(e.id) === Number(epId))
  if (!ep) return
  store.setCurrentEpisode(ep)
  store.setScriptContent(ep.script_content || '')
  scriptTitle.value = ep.title || t('t005') + (ep.episode_number || 0) + t('t006')
  syncStoryboardStateFromEpisode(ep)
  loadStoryboardMedia()
  recoverAndSyncEpisodeTasks(epId)
}

async function loadDrama() {
  if (!store.dramaId) return
  try {
    let d = await dramaAPI.get(store.dramaId)
    d = await backfillDramaStylePromptMetadataIfNeeded(dramaAPI, store.dramaId, d)
    store.setDrama(d)
    // 恢复「故事生成」框的梗概（项目 description 存的是故事梗概）
    storyInput.value = (d.description || '').toString().trim()
    storyStyle.value = (d.metadata && d.metadata.story_style) ? d.metadata.story_style : ''
    storyType.value = d.genre || ''
    generationStyle.value = d.style || ''
    projectAspectRatio.value = (d.metadata && d.metadata.aspect_ratio) ? d.metadata.aspect_ratio : '16:9'
    videoClipDuration.value = (d.metadata && d.metadata.video_clip_duration) ? Number(d.metadata.video_clip_duration) : 5
    storyboardIncludeNarration.value = !!(d.metadata && d.metadata.storyboard_include_narration)
    storyboardUniversalOmni.value = !!(d.metadata && d.metadata.storyboard_universal_omni)
    storyboardUseFirstLastFrame.value = !!(d.metadata && d.metadata.storyboard_use_first_last_frame)
    lastFrameUseFirstLayoutLock.value = d.metadata?.last_frame_use_first_layout_lock !== false
    if (storyboardUseFirstLastFrame.value && gridMode.value !== 'single') {
      gridMode.value = 'single'
    }
    const list = d.episodes || []
    // 优先保持当前选中的集（按 id 在最新列表中查找），避免 AI 生成角色等操作后误切到其他集
    const currentId = selectedEpisodeId.value
    let ep = currentId != null ? list.find((e) => Number(e.id) === Number(currentId)) : null
    if (!ep) {
      const wantNum = savedCurrentEpisodeNumber.value
      ep = list.find((e) => Number(e.episode_number) === Number(wantNum)) || list[0] || null
    }
    store.setCurrentEpisode(ep)
    if (ep) {
      store.setScriptContent(ep.script_content || '')
      scriptTitle.value = ep.title || t('t005') + (ep.episode_number || 0) + t('t006')
      selectedEpisodeId.value = ep.id
    } else {
      store.setScriptContent('')
      scriptTitle.value = ''
      selectedEpisodeId.value = null
    }
    syncStoryboardStateFromEpisode(ep)
    await loadStoryboardMedia()
    await recoverAndSyncEpisodeTasks(ep?.id)
  } catch (e) {
    ElMessage.error(e.message || t('t563'))
  }
}

const EMPTY_ARR = []
/** 当前分镜已选角色 id 列表（供 el-select 绑定） */
function getSbCharacterIds(sbId) {
  const arr = sbCharacterIds.value[sbId]
  return Array.isArray(arr) && arr.length > 0 ? arr : EMPTY_ARR
}

/** 运镜值的简短中文标签（用于分镜控制栏显示） */
function getMovementLabel(m) {
  if (!m) return ''
  const map = {
    static: t('t564'),
    push: t('t415'),
    pull: t('t416'),
    pan: t('t565'),
    tilt: t('t566'),
    tracking: t('t567'),
    crane_up: t('t568'),
    crane_dn: t('t569'),
    orbit: t('t570'),
    handheld: t('t571'),
    zoom: t('t572'),
    roll: t('t573'),
    whip_pan: t('t574'),
    spiral: t('t575'),
    hitchcock_zoom: t('t576'),
    bullet_time: t('t577'),
    dutch_angle_move: t('t578'),
    dolly_track: t('t579'),
    slowmo_orbit: t('t580')
  }
  return map[m] || m
}

function setSbCharacterIds(sbId, v) {
  const next = Array.isArray(v) ? v : []
  sbCharacterIds.value = { ...sbCharacterIds.value, [sbId]: next }
  onStoryboardCharacterChange(sbId)
}

/** 当前分镜尚未勾选的角色（供缩略图旁「+」下拉添加） */
function charactersAvailableToAddToSb(sbId) {
  const all = characters.value ?? []
  const cur = new Set((getSbCharacterIds(sbId) || []).map((x) => Number(x)))
  return all.filter((c) => c && !cur.has(Number(c.id)))
}

function onSbAddCharacterCommand(sbId, charId) {
  const id = Number(charId)
  if (!Number.isFinite(id)) return
  const cur = [...(getSbCharacterIds(sbId) || [])]
  if (cur.some((x) => Number(x) === id)) return
  cur.push(id)
  setSbCharacterIds(sbId, cur)
}

/** 当前分镜已选物品 id 列表 */
function getSbPropIds(sbId) {
  const arr = sbPropIds.value[sbId]
  return Array.isArray(arr) && arr.length > 0 ? arr : EMPTY_ARR
}

function setSbPropIds(sbId, v) {
  sbPropIds.value = { ...sbPropIds.value, [sbId]: Array.isArray(v) ? v : [] }
  onStoryboardPropChange(sbId)
}

function onStoryboardPropChange(sbId) {
  const ids = sbPropIds.value[sbId] || []
  storyboardsAPI.update(sbId, { prop_ids: ids }).catch(() => {})
}

/** 当前分镜选中的场景对象（用于下方缩略图） */
function getSbSelectedScene(sbId) {
  const sceneId = sbSceneId.value[sbId]
  if (sceneId == null) return null
  const list = scenes.value ?? []
  return list.find((s) => Number(s.id) === Number(sceneId)) || null
}

/** 当前分镜选中的角色对象列表（用于下方缩略图） */
function getSbSelectedCharacters(sbId) {
  const ids = getSbCharacterIds(sbId)
  if (!ids.length) return []
  const list = characters.value ?? []
  return ids.map((id) => list.find((c) => Number(c.id) === Number(id))).filter(Boolean)
}

/** 当前分镜选中的物品对象列表（用于下方缩略图） */
function getSbSelectedProps(sbId) {
  const ids = getSbPropIds(sbId)
  if (!ids.length) return []
  const list = props.value ?? []
  return ids.map((id) => list.find((p) => Number(p.id) === Number(id))).filter(Boolean)
}

async function onStoryboardCharacterChange(sbId) {
  const ids = sbCharacterIds.value[sbId] || []
  try {
    await storyboardsAPI.update(sbId, { character_ids: ids })
    // 首/尾帧提示词保留（含用户手动保存版）；图生时后端会按当前勾选做 sanitize
  } catch (e) {
    console.warn('[分镜] 保存角色失败', e)
  }
}

function onLastFrameLayoutLockChange() {
  saveProjectSettings()
}

function onStoryboardSceneChange(sbId) {
  const sceneId = sbSceneId.value[sbId] ?? null
  storyboardsAPI.update(sbId, { scene_id: sceneId }).catch(() => {})
}

/** 同镜号多行时只保留 id 最大的一条（与后端 dedupe 一致，避免「影响的分镜」重复 #N） */
function dedupeStoryboardsForAssetLink(list) {
  const byNum = new Map()
  const extras = []
  for (const sb of list || []) {
    const n = Number(sb?.storyboard_number)
    if (Number.isFinite(n) && n > 0) {
      const prev = byNum.get(n)
      if (!prev || Number(sb.id) > Number(prev.id)) byNum.set(n, sb)
    } else {
      extras.push(sb)
    }
  }
  return [...byNum.values(), ...extras].sort(
    (a, b) => (Number(a.storyboard_number) || 0) - (Number(b.storyboard_number) || 0)
  )
}

/** 返回包含指定角色的所有分镜（已排序） */
function getCharAffectedStoryboards(charId) {
  const matched = (storyboards.value || []).filter((sb) => {
    if (!sb.characters) return false
    const chars = Array.isArray(sb.characters) ? sb.characters : []
    return chars.some((c) => Number(typeof c === 'object' && c != null ? c.id : c) === Number(charId))
  })
  return dedupeStoryboardsForAssetLink(matched)
}

/** 返回指定场景关联的所有分镜 */
function getSceneAffectedStoryboards(sceneId) {
  const matched = (storyboards.value || []).filter(
    (sb) => sb.scene_id != null && Number(sb.scene_id) === Number(sceneId)
  )
  return dedupeStoryboardsForAssetLink(matched)
}

/** 返回包含指定道具的所有分镜（已排序） */
function getPropAffectedStoryboards(propId) {
  const matched = (storyboards.value || []).filter((sb) => {
    if (!sb.prop_ids) return false
    const pids = Array.isArray(sb.prop_ids) ? sb.prop_ids : []
    return pids.some((pid) => Number(pid) === Number(propId))
  })
  return dedupeStoryboardsForAssetLink(matched)
}

/** 点击分镜 chip → 滚动到对应分镜行 */
function scrollToStoryboard(sbId) {
  const el = document.getElementById('sb-' + sbId)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

/** 对关联分镜批量重新生成图片 */
async function onRegenAffectedSbImages(assetKey, affectedBoards) {
  if (!affectedBoards.length || regenSbImagesForAsset.has(assetKey)) return
  try {
    await ElMessageBox.confirm(
      t('t581', { arg0: affectedBoards.length, arg1: affectedBoards.map((s) => s.storyboard_number).join('、#') }),
      t('t582'),
      { confirmButtonText: t('t583'), cancelButtonText: t('t304'), type: 'warning' }
    )
  } catch {
    return
  }
  regenSbImagesForAsset.add(assetKey)
  // 用 Map 存进度以便响应式更新
  if (!regenSbImagesProgress.value) regenSbImagesProgress.value = {}
  regenSbImagesProgress.value[assetKey] = { current: 0, total: affectedBoards.length }
  let failed = 0
  try {
    for (let i = 0; i < affectedBoards.length; i++) {
      regenSbImagesProgress.value[assetKey] = { current: i + 1, total: affectedBoards.length }
      const sb = affectedBoards[i]
      try {
        const useFirstLast = storyboardUseFirstLastFrame.value && !isSbUniversalMode(sb.id)
        let prompt = sb.polished_prompt || sb.image_prompt || sb.description || ''
        let frameTypeForCreate = undefined
        if (useFirstLast) {
          // 首尾帧模式下，关联资源触发的批量重新生成也必须走专业首帧提示词
          prompt = await ensureProfessionalFramePrompt(sb, 'first')
          frameTypeForCreate = 'storyboard_first'
        }
        const res = await imagesAPI.create({
          storyboard_id: sb.id,
          drama_id: dramaId.value,
          prompt,
          style: getSelectedStyle(),
          frame_type: frameTypeForCreate,
          aspect_ratio: projectAspectRatio.value || '16:9',
        })
        if (res?.task_id) {
          const pollRes = await new Promise((resolve) => {
            const maxAttempts = 180
            let attempts = 0
            const tick = async () => {
              attempts++
              try {
                const t = await taskAPI.get(res.task_id)
                if (t.status === 'completed') { await loadSingleStoryboardMedia(sb.id); return resolve({ status: 'completed' }) }
                if (t.status === 'failed') return resolve({ status: 'failed', error: t.error || t('t584') })
              } catch (_) {}
              if (attempts < maxAttempts) setTimeout(tick, 2000)
              else resolve({ status: 'timeout' })
            }
            setTimeout(tick, 2000)
          })
          if (pollRes?.status !== 'completed') failed++
        } else {
          await loadSingleStoryboardMedia(sb.id)
        }
        if (useFirstLast) {
          delete sbSelectedImgId.value[sb.id]
        }
      } catch (_) {
        failed++
      }
      if (i < affectedBoards.length - 1) await new Promise((r) => setTimeout(r, 500))
    }
    if (failed === 0) ElMessage.success(t('t585', { arg0: affectedBoards.length }))
    else ElMessage.warning(t('t586', { arg0: failed, arg1: affectedBoards.length }))
  } finally {
    regenSbImagesForAsset.delete(assetKey)
    if (regenSbImagesProgress.value) delete regenSbImagesProgress.value[assetKey]
  }
}

function updateStoryboardDialogue(sbId) {
  // 可在此防抖后调用后端更新 dialogue
}

/** 将当前剧本内容保存到后端（创建/更新项目与集数），供「保存剧本」与「AI 生成」后自动保存共用 */
async function saveScriptToBackend(content) {
  const trimmed = (content ?? '').toString().trim()
  if (!trimmed) return
  const parsed = parseScriptIntoEpisodes(trimmed)
  const multiFromMarkers = parsed.split && parsed.episodes.length >= 2
  const toPayload = (list) =>
    list.map((e, i) => ({
      episode_number: i + 1,
      title: (e.title && String(e.title).trim()) || t('t005') + (i + 1) + t('t006'),
      script_content: e.script_content ?? '',
      description: null,
      duration: 0,
    }))

  let dramaId = store.dramaId
  const curEp = store.currentEpisode
  if (!dramaId) {
    const drama = await dramaAPI.create({
      title: scriptTitle.value || t('t587'),
      description: storyInput.value?.trim() || trimmed.slice(0, 200),
      genre: storyType.value || undefined,
      style: generationStyle.value || undefined,
      metadata: {
        ...projectStylePromptMetadata(),
        story_style: storyStyle.value || undefined,
        aspect_ratio: projectAspectRatio.value || '16:9',
      },
    })
    store.setDrama(drama)
    dramaId = drama.id
    savedCurrentEpisodeNumber.value = 1
    const first = parsed.episodes[0] || { title: '', script_content: trimmed }
    const episodes = multiFromMarkers
      ? toPayload(parsed.episodes)
      : [
          {
            episode_number: 1,
            title: scriptTitle.value || first.title || t('t588'),
            script_content: first.script_content || trimmed,
          },
        ]
    await dramaAPI.saveEpisodes(dramaId, episodes)
    await loadDrama()
    if (route.params.id === 'new') {
      router.replace('/film/' + dramaId)
    }
    if (multiFromMarkers) {
      ElMessage.success(t('t589', { arg0: episodes.length }))
    }
    return { created: true }
  }
  if (multiFromMarkers) {
    savedCurrentEpisodeNumber.value = 1
    const payload = toPayload(parsed.episodes)
    await dramaAPI.saveEpisodes(dramaId, payload)
    if (storyInput.value?.trim()) {
      await dramaAPI.saveOutline(dramaId, {
        summary: storyInput.value.trim(),
        genre: storyType.value || undefined,
        style: generationStyle.value || undefined,
        metadata: {
          ...projectStylePromptMetadata(),
          story_style: storyStyle.value || undefined,
          aspect_ratio: projectAspectRatio.value || '16:9',
        },
      }).catch(() => {})
    }
    await loadDrama()
    ElMessage.success(t('t589', { arg0: payload.length }))
    return { created: false, splitEpisodes: true }
  }
  const episodes = store.drama?.episodes || []
  savedCurrentEpisodeNumber.value = curEp?.episode_number ?? 1
  const updated = episodes.map((ep, i) => {
    const num = ep.episode_number ?? i + 1
    const isCurrent = curEp && Number(ep.id) === Number(curEp.id)
    const first = parsed.episodes[0]
    const singleBody = first?.script_content ?? trimmed
    const singleTitle = first?.title && String(first.title).trim()
    return {
      episode_number: num,
      title: isCurrent
        ? scriptTitle.value || singleTitle || t('t005') + num + t('t006')
        : ep.title || '',
      script_content: isCurrent ? (parsed.episodes.length === 1 && singleTitle ? singleBody : trimmed) : (ep.script_content || ''),
      description: ep.description,
      duration: ep.duration,
    }
  })
  if (updated.length === 0) {
    updated.push({ episode_number: 1, title: scriptTitle.value || t('t588'), script_content: trimmed })
  }
  await dramaAPI.saveEpisodes(dramaId, updated)
  if (storyInput.value?.trim()) {
    await dramaAPI.saveOutline(dramaId, {
      summary: storyInput.value.trim(),
      genre: storyType.value || undefined,
      style: generationStyle.value || undefined,
      metadata: {
        ...projectStylePromptMetadata(),
        story_style: storyStyle.value || undefined,
        aspect_ratio: projectAspectRatio.value || '16:9',
      },
    }).catch(() => {})
  }
  await loadDrama()
  return { created: false }
}

/**
 * @param {boolean} includeGenerationStyle - 仅在选择「画面风格」为 true：写入 dramas.style 与 style_prompt_*。
 * 其它项目设置改为 false，避免界面未刷新时仍用旧的 generationStyle 覆盖外部已更新的画风（如直接调 API PUT outline）。
 */
async function saveProjectSettings(includeGenerationStyle = false) {
  if (!store.dramaId) return
  const metadata = {
    story_style: storyStyle.value || undefined,
    aspect_ratio: projectAspectRatio.value || '16:9',
    video_clip_duration: videoClipDuration.value || 5,
    storyboard_include_narration: !!storyboardIncludeNarration.value,
    storyboard_universal_omni: !!storyboardUniversalOmni.value,
    storyboard_use_first_last_frame: !!storyboardUseFirstLastFrame.value,
    last_frame_use_first_layout_lock: !!lastFrameUseFirstLayoutLock.value,
  }
  if (includeGenerationStyle) {
    Object.assign(metadata, projectStylePromptMetadata())
  }
  const payload = {
    genre: storyType.value || undefined,
    metadata,
  }
  if (includeGenerationStyle) {
    payload.style = generationStyle.value || undefined
  }
  dramaAPI.saveOutline(store.dramaId, payload).catch(e => console.error('Settings auto-save failed', e))
}

async function onGenerateStory() {
  trackFilmCreateAction('generate_script_click')
  await runGenerateStoryFromPremise({
    premise: storyInput.value,
    storyStyle: storyStyle.value,
    storyType: storyType.value,
    storyEpisodeCount: storyEpisodeCount.value,
    scriptTitle: scriptTitle.value,
    generationStyle: generationStyle.value,
    projectAspectRatio: projectAspectRatio.value,
    store,
    router,
    route,
    loadDrama,
    savedCurrentEpisodeNumber,
    selectedEpisodeId,
    onEpisodeSelect,
    storyGenerating,
    scriptGenerating,
    replaceRouteWhenNew: true,
    skipPostLoad: false,
    onComplete: ({ episodeCount }) => {
      trackFilmCreateAction('generate_script_complete', {
        extra: { episode_count: episodeCount },
      })
    },
  })
}

function openSelectScriptDialog() {
  showSelectScriptDialog.value = true
}

async function loadSelectScriptList() {
  selectScriptLoading.value = true
  try {
    const res = await dramaAPI.list({ page: 1, page_size: 100 })
    const items = res?.items ?? []
    selectScriptDramas.value = items.filter((d) => d?.metadata?.script_template === true)
  } catch {
    selectScriptDramas.value = []
  } finally {
    selectScriptLoading.value = false
  }
}

/**
 * 将源剧本的梗概 + 各集剧本写入当前工程（不跳转、不导入角色/分镜/视频）。
 * 在「新建故事」且尚未落库时，会创建新项目并跳转。
 */
async function onPickScriptFromDialog(sourceId) {
  if (!sourceId || selectScriptImporting.value) return
  const srcNum = Number(sourceId)
  const routeId = route.params.id
  const targetFromRoute = routeId && routeId !== 'new' ? Number(routeId) : null
  const targetId = store.dramaId ?? targetFromRoute ?? null

  if (targetId != null && Number(targetId) === srcNum) {
    ElMessage.info(t('t590'))
    return
  }

  if (targetId != null) {
    try {
      await ElMessageBox.confirm(
        t('t591'),
        t('t592'),
        { type: 'warning', confirmButtonText: t('t593'), cancelButtonText: t('t304') }
      )
    } catch {
      return
    }
  }

  selectScriptImporting.value = true
  try {
    const src = await dramaAPI.get(srcNum)
    const rawEps = [...(src.episodes || [])].sort(
      (a, b) => (Number(a.episode_number) || 0) - (Number(b.episode_number) || 0)
    )
    const summary = (src.description || '').toString().trim()
    const episodesPayload = rawEps.map((ep, i) => ({
      episode_number: ep.episode_number != null ? Number(ep.episode_number) : i + 1,
      title: (ep.title || '').toString(),
      script_content: ep.script_content ?? '',
      description: ep.description ?? null,
      duration: ep.duration ?? 0,
    }))

    if (!targetId) {
      if (episodesPayload.length === 0 && !summary) {
        ElMessage.warning(t('t594'))
        return
      }
      const title = (src.title || t('t587')).toString().trim() || t('t587')
      const created = await dramaAPI.create({
        title,
        description: summary || undefined,
        metadata: {},
      })
      const workId = created.id
      store.setDrama({ id: workId })
      if (episodesPayload.length > 0) {
        await dramaAPI.saveEpisodes(workId, episodesPayload)
      }
      if (summary) {
        await dramaAPI.saveOutline(workId, { summary }).catch(() => {})
      }
      showSelectScriptDialog.value = false
      router.replace('/film/' + workId)
      ElMessage.success(t('t595'))
      scriptWorkbenchMode.value = 'select'
      return
    }

    if (summary) {
      await dramaAPI.saveOutline(targetId, { summary }).catch(() => {})
    }
    if (episodesPayload.length > 0) {
      await dramaAPI.saveEpisodes(targetId, episodesPayload)
    } else if (!summary) {
      ElMessage.warning(t('t594'))
      return
    }

    showSelectScriptDialog.value = false
    await loadDrama()
    ElMessage.success(t('t596'))
    scriptWorkbenchMode.value = 'select'
  } catch (e) {
    ElMessage.error(e.message || t('t597'))
  } finally {
    selectScriptImporting.value = false
  }
}

watch(
  () => [store.drama?.episodes, selectedEpisodeId.value],
  () => {
    const eps = store.drama?.episodes || []
    if (eps.length > 1) {
      const cur = selectedEpisodeId.value
      const hit = cur != null && eps.some((e) => Number(e.id) === Number(cur))
      selectPreviewEpisodeId.value = hit ? String(cur) : String(eps[0].id)
    } else {
      selectPreviewEpisodeId.value = ''
    }
  },
  { deep: true, immediate: true }
)

function novelImportReset() {
  novelText.value = ''
  novelFileName.value = ''
  novelFileContent.value = ''
}

function onNovelFileChange(file) {
  novelFileName.value = file.name
  const reader = new FileReader()
  reader.onload = (ev) => { novelFileContent.value = ev.target.result }
  reader.readAsText(file.raw || file, 'utf-8')
}

async function onImportNovel() {
  const text = novelImportMode.value === 'file' ? novelFileContent.value : novelText.value
  if (!text?.trim()) {
    ElMessage.warning(t('t598'))
    return
  }
  novelImporting.value = true
  try {
    const formData = new FormData()
    if (novelImportMode.value === 'file' && novelFileContent.value) {
      const blob = new Blob([novelFileContent.value], { type: 'text/plain' })
      formData.append('file', blob, novelFileName.value || 'novel.txt')
    } else {
      formData.append('text', text)
    }
    formData.append('title', scriptTitle.value || t('t046'))
    formData.append('max_chapters', String(novelMaxChapters.value))
    formData.append('ai_summarize', String(novelAiSummarize.value))
    const { default: axios } = await import('axios')
    const baseURL = (await import('@/utils/request')).default.defaults.baseURL || '/api/v1'
    const res = await axios.post(`${baseURL}/dramas/import-novel`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    let chapters = res.data?.data?.chapters || res.data?.chapters || []
    if (!chapters.length) {
      ElMessage.warning(t('t599'))
      return
    }
    // 若后端只识别出 1 章，但正文里有多处「第N集」行首标题，用前端规则再拆（与保存剧本一致）
    const clientParsed = parseScriptIntoEpisodes(text)
    if (clientParsed.split && clientParsed.episodes.length > chapters.length) {
      chapters = clientParsed.episodes.map((e, i) => ({
        index: i + 1,
        title: e.title,
        content: e.script_content,
        script: e.script_content,
      }))
    }
    const toEpisodeRow = (ch, i) => ({
      episode_number: i + 1,
      title: (ch.title && String(ch.title).trim()) || t('t005') + (i + 1) + t('t006'),
      script_content: String(ch.script ?? ch.content ?? '').trimEnd(),
      description: null,
      duration: 0,
    })
    const rows = chapters.map(toEpisodeRow)
    const plainScript = episodesListToPlainScript(
      rows.map((r) => ({ title: r.title, script_content: r.script_content }))
    )
    if (store.dramaId && rows.length >= 2) {
      await dramaAPI.saveEpisodes(store.dramaId, rows)
      await loadDrama()
      ElMessage.success(t('t600', { arg0: rows.length }))
    } else {
      store.setScriptContent(plainScript || rows[0]?.script_content || '')
      ElMessage.success(
        rows.length >= 2
          ? t('t601', { arg0: rows.length })
          : t('t602', { arg0: rows.length })
      )
    }
    showNovelImport.value = false
    novelImportReset()
  } catch (e) {
    ElMessage.error(e.message || t('t597'))
  } finally {
    novelImporting.value = false
  }
}

async function onGenerateScript() {
  trackFilmCreateAction('save_script_click')
  const content = (scriptContent.value ?? store.scriptContent ?? '').toString().trim()
  if (!content) {
    ElMessage.warning(t('t603'))
    return
  }
  scriptGenerating.value = true
  try {
    const result = await saveScriptToBackend(content)
    if (result?.created) {
      ElMessage.success(t('t604'))
    } else {
      ElMessage.success(t('t605'))
    }
    trackFilmCreateAction('save_script_complete', {
      extra: { created_project: !!result?.created },
    })
  } catch (e) {
    ElMessage.error(e.message || t('t549'))
  } finally {
    scriptGenerating.value = false
  }
}

async function onAddEpisode() {
  if (!store.dramaId) return
  const list = store.drama?.episodes || []
  const nextNum = list.length > 0
    ? Math.max(...list.map((e) => Number(e.episode_number) || 0), 0) + 1
    : 1
  const updated = list.map((ep, i) => ({
    episode_number: ep.episode_number ?? i + 1,
    title: ep.title || t('t005') + (ep.episode_number ?? i + 1) + t('t006'),
    script_content: ep.script_content || '',
    description: ep.description,
    duration: ep.duration
  }))
  updated.push({
    episode_number: nextNum,
    title: t('t005') + nextNum + t('t006'),
    script_content: '',
    description: null,
    duration: 0
  })
  try {
    await dramaAPI.saveEpisodes(store.dramaId, updated)
    savedCurrentEpisodeNumber.value = nextNum
    await loadDrama()
    ElMessage.success(t('t606') + nextNum + t('t006'))
  } catch (e) {
    ElMessage.error(e.message || t('t607'))
  }
}

function onUploadResourceClick(type, id) {
  resourceUploadType.value = type
  resourceUploadId.value = id
  resourceImageFileInput.value?.click()
}

// 解析 extra_images JSON，返回 local_path 数组
function parseExtraImages(item) {
  if (!item?.extra_images) return []
  try {
    const arr = typeof item.extra_images === 'string' ? JSON.parse(item.extra_images) : item.extra_images
    return Array.isArray(arr) ? arr.filter(Boolean) : []
  } catch { return [] }
}

// 将 local_path 转成可访问的 URL
function localPathToUrl(p) {
  if (!p) return ''
  if (p.startsWith('http')) return p
  return '/static/' + p.replace(/^\//, '')
}

// 查找角色/道具/场景在 store 中的当前对象
function findResource(type, id) {
  const list = type === 'character' ? (store.characters ?? [])
    : type === 'prop' ? (store.props ?? [])
    : (store.scenes ?? [])
  return list.find((x) => Number(x.id) === Number(id)) || null
}

async function doUploadResourceImage(type, id, file) {
  if (!file || !type || id == null) return
  const key = type === 'character' ? 'char-' : type === 'prop' ? 'prop-' : 'scene-'
  uploadingResourceId.value = key + id
  try {
    const res = await uploadAPI.uploadImage(file, { dramaId: dramaId.value })
    const data = res?.data ?? res
    const uploadedLocalPath = data?.local_path || data?.path || null
    const url = data?.url || uploadedLocalPath
    if (!url) { ElMessage.error(t('t559')); return }

    const current = findResource(type, id)
    const hasPrimary = !!(current?.local_path || current?.image_url)

    if (hasPrimary) {
      // 已有主图 → 追加到 extra_images
      const extras = parseExtraImages(current)
      const newPath = uploadedLocalPath || url
      if (!extras.includes(newPath)) extras.push(newPath)
      const extraJson = JSON.stringify(extras)
      if (type === 'character') {
        await characterAPI.putImage(id, { extra_images: extraJson })
      } else if (type === 'prop') {
        await propAPI.update(id, { extra_images: extraJson })
      } else if (type === 'scene') {
        await sceneAPI.update(id, { extra_images: extraJson })
      }
    } else {
      // 无主图 → 设为主图
      if (type === 'character') {
        await characterAPI.putImage(id, { image_url: url, local_path: uploadedLocalPath ?? null })
      } else if (type === 'prop') {
        await propAPI.update(id, { image_url: url, local_path: uploadedLocalPath ?? null })
      } else if (type === 'scene') {
        await sceneAPI.update(id, { image_url: url, local_path: uploadedLocalPath ?? null })
      }
    }
    await loadDrama()
    ElMessage.success(t('t608'))
  } catch (e) {
    ElMessage.error(e.message || t('t562'))
  } finally {
    uploadingResourceId.value = null
  }
}

// 将某张额外图片设为主图（主图降级到 extra_images 第一位）
async function onSetPrimaryImage(type, item, extraPath) {
  const extras = parseExtraImages(item)
  const oldPrimary = item.local_path || ''
  const newExtras = extras.filter((p) => p !== extraPath)
  if (oldPrimary) newExtras.unshift(oldPrimary)
  const extraJson = JSON.stringify(newExtras)
  try {
    if (type === 'character') {
      await characterAPI.putImage(item.id, { local_path: extraPath, image_url: '', extra_images: extraJson })
    } else if (type === 'prop') {
      await propAPI.update(item.id, { local_path: extraPath, image_url: '', extra_images: extraJson })
    } else if (type === 'scene') {
      await sceneAPI.update(item.id, { local_path: extraPath, image_url: '', extra_images: extraJson })
    }
    await loadDrama()
  } catch (e) {
    ElMessage.error(e.message || t('t609'))
  }
}

// 删除某张额外图片
async function onRemoveExtraImage(type, item, extraPath) {
  const extras = parseExtraImages(item).filter((p) => p !== extraPath)
  const extraJson = extras.length ? JSON.stringify(extras) : null
  try {
    if (type === 'character') {
      await characterAPI.putImage(item.id, { extra_images: extraJson })
    } else if (type === 'prop') {
      await propAPI.update(item.id, { extra_images: extraJson })
    } else if (type === 'scene') {
      await sceneAPI.update(item.id, { extra_images: extraJson })
    }
    await loadDrama()
  } catch (e) {
    ElMessage.error(e.message || t('t543'))
  }
}

function onResourceImageFileChange(ev) {
  const file = ev.target?.files?.[0]
  const type = resourceUploadType.value
  const id = resourceUploadId.value
  if (!file || !type || id == null) {
    ev.target.value = ''
    return
  }
  doUploadResourceImage(type, id, file).finally(() => {
    resourceUploadType.value = null
    resourceUploadId.value = null
    ev.target.value = ''
  })
}


function getSbFirstFrameUrl(sb) {
  const img = storyboardUseFirstLastFrame.value ? getSbFirstImage(sb.id) : getSbImage(sb.id)
  if (img && (img.image_url || img.local_path)) return assetImageUrl(img)
  if (sb.composed_image || sb.image_url) return imageUrl(sb.composed_image || sb.image_url)
  return ''
}

function getSbLastFrameUrl(sb) {
  const img = getSbLastImage(sb.id)
  if (img && (img.image_url || img.local_path)) return assetImageUrl(img)
  if (sb.last_frame_image_url || sb.last_frame_local_path) {
    return assetImageUrl({ image_url: sb.last_frame_image_url, local_path: sb.last_frame_local_path })
  }
  return ''
}

/** 经典模式视频：首帧 URL（连贯帧可覆盖首帧）+ 可选尾帧 */
function sbVideoFirstLastUrls(sb, universal, contiguityFirstFrameUrl) {
  let first =
    contiguityFirstFrameUrl ||
    (universal ? '' : toAbsoluteImageUrl(getSbFirstFrameUrl(sb) || ''))
  if (!first && !universal) {
    first = toAbsoluteImageUrl(getSbFirstFrameUrl(sb) || '')
  }
  let last = undefined
  if (storyboardUseFirstLastFrame.value && !universal) {
    const lu = getSbLastFrameUrl(sb)
    if (lu) last = toAbsoluteImageUrl(lu)
  }
  return { first: first || undefined, last }
}

/** 获取分镜主图的本地路径（用于超分辨率判断） */
function getSbLocalImage(sb) {
  const img = getSbImage(sb.id)
  return img?.local_path || sb.local_path || null
}

/**
 * P0-1: 从视频 URL 捕获末帧（浏览器 canvas 方案）
 * 返回 Blob（JPEG），失败返回 null
 */
async function captureVideoLastFrame(videoUrl) {
  return new Promise((resolve) => {
    if (!videoUrl) return resolve(null)
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.preload = 'metadata'
    let captured = false
    const timeout = setTimeout(() => { if (!captured) resolve(null) }, 12000)
    video.addEventListener('error', () => { clearTimeout(timeout); if (!captured) resolve(null) })
    video.addEventListener('loadedmetadata', () => {
      video.currentTime = Math.max(0, video.duration - 0.5)
    })
    video.addEventListener('seeked', () => {
      if (captured) return
      captured = true
      clearTimeout(timeout)
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth || 512
        canvas.height = video.videoHeight || 288
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0)
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85)
      } catch (_) {
        resolve(null)
      }
    })
    video.src = videoUrl
  })
}

/** P0-3: 对分镜图执行超分辨率（2x） */
async function onUpscaleSbImage(sb) {
  if (!sb?.id || upscalingSbIds.has(sb.id)) return
  upscalingSbIds.add(sb.id)
  try {
    await storyboardsAPI.upscale(sb.id)
    ElMessage.success(t('t610'))
    await loadSingleStoryboardMedia(sb.id)
  } catch (e) {
    ElMessage.error(e.message || t('t611'))
  } finally {
    upscalingSbIds.delete(sb.id)
  }
}

function normalizeAudioRelPath(raw) {
  const s = String(raw != null ? raw : '').trim().replace(/^\//, '')
  return s
}

/** 对白 TTS 相对路径 */
function sbDialogueAudioRelPath(sb) {
  if (!sb?.id) return ''
  const fromCache = sbDialogueAudioPaths.value[sb.id]
  const fromRow = sb.audio_local_path
  const raw = (fromCache != null && String(fromCache).trim() !== '') ? fromCache : (fromRow != null ? fromRow : '')
  return normalizeAudioRelPath(raw)
}

/** 解说旁白 TTS 相对路径 */
function sbNarrationAudioRelPath(sb) {
  if (!sb?.id) return ''
  const fromCache = sbNarrationAudioPaths.value[sb.id]
  const fromRow = sb.narration_audio_local_path
  const raw = (fromCache != null && String(fromCache).trim() !== '') ? fromCache : (fromRow != null ? fromRow : '')
  return normalizeAudioRelPath(raw)
}

function playSbTtsFromRel(rel) {
  if (!rel) return
  const url = `/static/${rel}`
  try {
    if (sbTtsPreviewAudio) {
      sbTtsPreviewAudio.pause()
      sbTtsPreviewAudio = null
    }
    const a = new Audio(url)
    sbTtsPreviewAudio = a
    a.addEventListener('ended', () => {
      if (sbTtsPreviewAudio === a) sbTtsPreviewAudio = null
    })
    a.play().catch(() => {
      ElMessage.warning(t('t612'))
      if (sbTtsPreviewAudio === a) sbTtsPreviewAudio = null
    })
  } catch (_) {
    ElMessage.warning(t('t613'))
  }
}

function playSbDialogueTts(sb) {
  playSbTtsFromRel(sbDialogueAudioRelPath(sb))
}

function playSbNarrationTts(sb) {
  playSbTtsFromRel(sbNarrationAudioRelPath(sb))
}

/** P2-4: 为分镜对白生成 TTS 配音 */
async function onTtsSbDialogue(sb) {
  if (!sb?.id || ttsSbIds.has(sb.id)) return
  if (!sb.dialogue?.trim()) {
    ElMessage.warning(t('t614'))
    return
  }
  ttsSbIds.add(sb.id)
  try {
    const res = await fetch('/api/v1/audio/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyboard_id: sb.id, text: sb.dialogue, tts_kind: 'dialogue' }),
    })
    const data = await res.json()
    const businessOk = data.success === true || Number(data.code) === 200
    if (!res.ok || !businessOk) {
      throw new Error(data.error?.message || data.message || t('t615'))
    }
    if (data.data?.local_path) {
      sbDialogueAudioPaths.value = { ...sbDialogueAudioPaths.value, [sb.id]: data.data.local_path }
      sb.audio_local_path = data.data.local_path
      ElMessage.success(t('t616'))
    }
  } catch (e) {
    ElMessage.error(e.message || t('t617'))
  } finally {
    ttsSbIds.delete(sb.id)
  }
}

/** 为分镜解说旁白生成 TTS（与对白共用接口，文本不同） */
async function onTtsSbNarration(sb) {
  if (!sb?.id || ttsSbNarrationIds.has(sb.id)) return
  const text = ((sbNarration.value[sb.id] ?? sb.narration) || '').toString().trim()
  if (!text) {
    ElMessage.warning(t('t618'))
    return
  }
  ttsSbNarrationIds.add(sb.id)
  try {
    const res = await fetch('/api/v1/audio/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyboard_id: sb.id, text, tts_kind: 'narration' }),
    })
    const data = await res.json()
    const businessOk = data.success === true || Number(data.code) === 200
    if (!res.ok || !businessOk) {
      throw new Error(data.error?.message || data.message || t('t619'))
    }
    if (data.data?.local_path) {
      sbNarrationAudioPaths.value = { ...sbNarrationAudioPaths.value, [sb.id]: data.data.local_path }
      sb.narration_audio_local_path = data.data.local_path
      ElMessage.success(t('t620'))
    }
  } catch (e) {
    ElMessage.error(e.message || t('t621'))
  } finally {
    ttsSbNarrationIds.delete(sb.id)
  }
}

function formatSrtTimestamp(ms) {
  if (!Number.isFinite(ms) || ms < 0) ms = 0
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const z = Math.floor(ms % 1000)
  const p2 = (n) => String(n).padStart(2, '0')
  return `${p2(h)}:${p2(m)}:${p2(s)},${String(z).padStart(3, '0')}`
}

/** 导出当前集分镜表（每镜一行；首尾帧模式含首/尾帧专用提示词） */
async function onExportStoryboardSheet() {
  const boards = storyboards.value || []
  if (!boards.length) {
    ElMessage.warning(t('t622'))
    return
  }
  const epNum = store.currentEpisode?.episode_number
  const dramaTitle = (store.drama?.title || 'project').replace(/[\\/:*?"<>|]/g, '_')
  const epLabel = epNum != null ? t('t521', { arg0: epNum }) : `ep${currentEpisodeId.value || '1'}`
  const filenameBase = t('t623', { arg0: dramaTitle, arg1: epLabel })
  const useFirstLast = !!storyboardUseFirstLastFrame.value

  exportingStoryboardSheet.value = true
  const framePromptBySbId = {}
  try {
    await Promise.all(
      boards.map(async (sb) => {
        try {
          const res = await storyboardsAPI.getFramePrompts(sb.id)
          const fps = res?.frame_prompts || []
          framePromptBySbId[sb.id] = {
            first: fps.find((r) => r.frame_type === 'first')?.prompt?.trim() || '',
            last: fps.find((r) => r.frame_type === 'last')?.prompt?.trim() || '',
          }
        } catch (_) {
          framePromptBySbId[sb.id] = { first: '', last: '' }
        }
      })
    )
  } finally {
    exportingStoryboardSheet.value = false
  }

  function resolveFirstFramePrompt(sbId) {
    const cached = framePromptBySbId[sbId]?.first
    if (cached) return cached
    const imgPrompt = getSbFirstImage(sbId)?.prompt?.trim()
    if (imgPrompt) return imgPrompt
    if (useFirstLast) return buildFirstFrameImagePrompt(sbId)
    return ''
  }

  function resolveLastFramePrompt(sbId) {
    const cached = framePromptBySbId[sbId]?.last
    if (cached) return cached
    const imgPrompt = getSbLastImage(sbId)?.prompt?.trim()
    if (imgPrompt) return imgPrompt
    if (useFirstLast) return buildLastFrameImagePrompt(sbId)
    return ''
  }

  const result = exportStoryboardSheet(
    {
      storyboards: boards,
      getScene: (sbId) => getSbSelectedScene(sbId),
      getCharacters: (sbId) => getSbSelectedCharacters(sbId),
      getProps: (sbId) => getSbSelectedProps(sbId),
      getMovementLabel,
      getFirstFramePrompt: resolveFirstFramePrompt,
      getLastFramePrompt: resolveLastFramePrompt,
      getField(sb, key) {
        const id = sb.id
        const map = {
          title: sbTitle.value[id],
          location: sbLocation.value[id],
          time: sbTime.value[id],
          duration: sbDuration.value[id] ?? sb.duration,
          dialogue: sbDialogue.value[id],
          narration: sbNarration.value[id],
          action: sbAction.value[id],
          result: sbResult.value[id],
          atmosphere: sbAtmosphere.value[id],
          shot_type: sbShotType.value[id],
          movement: sbMovement.value[id],
          layout_description: sbLayoutDescription.value[id],
          universal_segment_text: sbUniversalSegmentText.value[id],
        }
        if (Object.prototype.hasOwnProperty.call(map, key)) {
          const v = map[key]
          return v != null && v !== '' ? v : sb[key]
        }
        return sb[key]
      },
    },
    filenameBase
  )

  if (!result.ok) {
    ElMessage.warning(t('t624'))
    return
  }
  ElMessage.success(t('t625', { arg0: result.count }))
}

function onExportNarrationSrt() {
  const boards = storyboards.value || []
  if (!boards.length) {
    ElMessage.warning(t('t622'))
    return
  }
  let tMs = 0
  const lines = []
  let idx = 1
  for (const sb of boards) {
    const durSec = Number(sbDuration.value[sb.id] ?? sb.duration)
    const sec = Number.isFinite(durSec) && durSec > 0 ? durSec : 5
    const durMs = Math.round(sec * 1000)
    const text = ((sbNarration.value[sb.id] ?? sb.narration) || '').toString().trim()
    if (text) {
      const start = formatSrtTimestamp(tMs)
      const end = formatSrtTimestamp(tMs + durMs)
      lines.push(String(idx++), `${start} --> ${end}`, text, '')
    }
    tMs += durMs
  }
  if (!lines.length) {
    ElMessage.warning(t('t626'))
    return
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `narration-${currentEpisodeId.value || 'episode'}.srt`
  a.click()
  URL.revokeObjectURL(a.href)
  ElMessage.success(t('t627'))
}

async function onSaveSbNarrationField(sb) {
  if (!sb?.id) return
  const next = (sbNarration.value[sb.id] || '').toString().trim()
  const prev = (sb.narration || '').toString().trim()
  if (next === prev) return
  try {
    await storyboardsAPI.update(sb.id, { narration: next || null })
    const list = store.currentEpisode?.storyboards
    if (Array.isArray(list)) {
      const row = list.find((x) => Number(x.id) === Number(sb.id))
      if (row) row.narration = next || null
    }
  } catch (_) { /* 静默失败，避免打断输入 */ }
}

function isSbUniversalMode(sbId) {
  return sbCreationMode.value[sbId] === 'universal'
}

function setSbCreationModeId(sbId, mode) {
  if (sbId == null) return
  const m = mode === 'universal' ? 'universal' : 'classic'
  sbCreationMode.value = { ...sbCreationMode.value, [sbId]: m }
}

async function onToggleSbUniversalMode(sb) {
  if (!sb?.id) return
  const cur = isSbUniversalMode(sb.id) ? 'universal' : 'classic'
  const next = cur === 'universal' ? 'classic' : 'universal'
  sbCreationMode.value = { ...sbCreationMode.value, [sb.id]: next }
  try {
    await storyboardsAPI.update(sb.id, { creation_mode: next })
    const list = store.currentEpisode?.storyboards
    if (Array.isArray(list)) {
      const row = list.find((x) => Number(x.id) === Number(sb.id))
      if (row) row.creation_mode = next
    }
  } catch (e) {
    sbCreationMode.value = { ...sbCreationMode.value, [sb.id]: cur }
    ElMessage.error(e.message || t('t549'))
  }
}

async function onSaveUniversalSegmentField(sb) {
  if (!sb?.id) return
  const next = (sbUniversalSegmentText.value[sb.id] || '').toString()
  const prev = (sb.universal_segment_text || '').toString()
  if (next === prev) return
  try {
    await storyboardsAPI.update(sb.id, { universal_segment_text: next.trim() || null })
    const list = store.currentEpisode?.storyboards
    if (Array.isArray(list)) {
      const row = list.find((x) => Number(x.id) === Number(sb.id))
      if (row) row.universal_segment_text = next.trim() || null
    }
  } catch (_) { /* 静默失败，避免打断输入 */ }
}

function universalSegmentDurationSecForSb(sb) {
  const dUi = Number(sbDuration.value[sb?.id])
  const dRow = Number(sb?.duration)
  const dProj = Number(videoClipDuration.value)
  return Number.isFinite(dUi) && dUi > 0
    ? dUi
    : Number.isFinite(dRow) && dRow > 0
      ? dRow
      : Number.isFinite(dProj) && dProj > 0
        ? dProj
        : 5
}

/** 提交视频 API 时使用的时长：优先本分镜配置，其次项目「每段秒数」 */
function getSbVideoDurationForApi(sb) {
  const perSb = Number(sbDuration.value[sb?.id] ?? sb?.duration)
  if (Number.isFinite(perSb) && perSb > 0) return perSb
  const clip = Number(videoClipDuration.value)
  if (Number.isFinite(clip) && clip > 0) return clip
  return undefined
}

/** 全能提示词生成/润色：提交当前编辑区中的分镜字段（避免未点保存时仍用库内旧对白） */
function buildUniversalSegmentFieldOverrides(sb) {
  if (!sb?.id) return {}
  const id = sb.id
  const trimOrNull = (v) => {
    const s = (v ?? '').toString().trim()
    return s || null
  }
  return {
    title: trimOrNull(sbTitle.value[id] ?? sb.title),
    description: trimOrNull(sb.description),
    location: trimOrNull(sbLocation.value[id] ?? sb.location),
    time: trimOrNull(sbTime.value[id] ?? sb.time),
    action: trimOrNull(sbAction.value[id] ?? sb.action),
    dialogue: trimOrNull(sbDialogue.value[id] ?? sb.dialogue),
    narration: trimOrNull(sbNarration.value[id] ?? sb.narration),
    result: trimOrNull(sbResult.value[id] ?? sb.result),
    atmosphere: trimOrNull(sbAtmosphere.value[id] ?? sb.atmosphere),
    shot_type: trimOrNull(sbShotType.value[id] ?? sb.shot_type),
    movement: trimOrNull(sbMovement.value[id] ?? sb.movement),
    layout_description: trimOrNull(sbLayoutDescription.value[id] ?? sb.layout_description),
  }
}

/** 全能片段：@图片N 转 Grok 占位符 <IMAGE_N> */
function universalSegmentAtImageToGrokTags(text) {
  return (text || '').replace(/@图片(\d+)/g, '<IMAGE_$1>')
}

function onUniversalSegmentToGrokVideoTags(sb) {
  if (!sb?.id) return
  const raw = (sbUniversalSegmentText.value[sb.id] ?? '').toString()
  if (!raw.trim()) {
    ElMessage.warning(t('t628'))
    return
  }
  const next = universalSegmentAtImageToGrokTags(raw)
  if (next === raw) {
    ElMessage.info(t('t629'))
    return
  }
  sbUniversalSegmentText.value = { ...sbUniversalSegmentText.value, [sb.id]: next }
  void onSaveUniversalSegmentField(sb)
  ElMessage.success(t('t630'))
}

function onUniversalSegmentPromptMenu(sb, cmd) {
  if (cmd === 'generate') onGenerateUniversalSegmentPrompt(sb, {})
  else if (cmd === 'generate-force') onGenerateUniversalSegmentPrompt(sb, { forceWithoutReferenceImages: true })
  else if (cmd === 'polish') onPolishUniversalSegmentPromptStream(sb, {})
  else if (cmd === 'polish-force') onPolishUniversalSegmentPromptStream(sb, { forceWithoutReferenceImages: true })
  else if (cmd === 'to-grok-video-tags') onUniversalSegmentToGrokVideoTags(sb)
}

/** 全能模式：根据当前分镜结构化字段流式生成片段描述（NDJSON） */
async function onGenerateUniversalSegmentPrompt(sb, opts = {}) {
  if (!sb?.id || generatingUniversalSegmentIds.has(sb.id)) return
  const force = !!opts.forceWithoutReferenceImages
  generatingUniversalSegmentIds.add(sb.id)
  let live = ''
  try {
    const durationSec = universalSegmentDurationSecForSb(sb)
    const data = await storyboardsAPI.generateUniversalSegmentPromptStream(
      sb.id,
      {
        duration: durationSec,
        field_overrides: buildUniversalSegmentFieldOverrides(sb),
        ...(force ? { force_without_reference_images: true } : {}),
      },
      (delta) => {
        live += delta
        sbUniversalSegmentText.value = { ...sbUniversalSegmentText.value, [sb.id]: live }
      }
    )
    const text = (data?.universal_segment_text ?? '').toString().trim()
    if (!text) {
      ElMessage.warning(t('t631'))
      return
    }
    sbUniversalSegmentText.value = { ...sbUniversalSegmentText.value, [sb.id]: text }
    const list = store.currentEpisode?.storyboards
    if (Array.isArray(list)) {
      const row = list.find((x) => Number(x.id) === Number(sb.id))
      if (row) row.universal_segment_text = text
    }
    ElMessage.success(force ? t('t632') : t('t633'))
  } catch (e) {
    ElMessage.error(e.message || t('t634'))
  } finally {
    generatingUniversalSegmentIds.delete(sb.id)
  }
}

/** 全能模式：结合剧本与邻镜流式润色片段描述（服务端 NDJSON） */
async function onPolishUniversalSegmentPromptStream(sb, opts = {}) {
  if (!sb?.id || generatingUniversalSegmentIds.has(sb.id)) return
  const force = !!opts.forceWithoutReferenceImages
  const draft = sbUniversalSegmentTrimmed(sb)
  if (!draft) {
    ElMessage.warning(t('t635'))
    return
  }
  generatingUniversalSegmentIds.add(sb.id)
  let live = ''
  try {
    const durationSec = universalSegmentDurationSecForSb(sb)
    const data = await storyboardsAPI.polishUniversalSegmentPromptStream(
      sb.id,
      {
        duration: durationSec,
        draft_universal_segment_text: draft,
        field_overrides: buildUniversalSegmentFieldOverrides(sb),
        ...(force ? { force_without_reference_images: true } : {}),
      },
      (delta) => {
        live += delta
        sbUniversalSegmentText.value = { ...sbUniversalSegmentText.value, [sb.id]: live }
      }
    )
    const text = (data?.universal_segment_text ?? '').toString().trim()
    if (!text) {
      ElMessage.warning(t('t636'))
      return
    }
    sbUniversalSegmentText.value = { ...sbUniversalSegmentText.value, [sb.id]: text }
    const list = store.currentEpisode?.storyboards
    if (Array.isArray(list)) {
      const row = list.find((x) => Number(x.id) === Number(sb.id))
      if (row) row.universal_segment_text = text
    }
    ElMessage.success(force ? t('t637') : t('t638'))
  } catch (e) {
    ElMessage.error(e.message || t('t639'))
  } finally {
    generatingUniversalSegmentIds.delete(sb.id)
  }
}

/**
 * 分镜脚本生成完成后：按镜序逐个流式润色全能片段（服务端已落库）。
 * @param {{ checkPause?: () => Promise<void>, onShotProgress?: (cur:number,total:number,sb:object)=>void, onShotError?: (sb:object,msg:string)=>void }} opts
 */
async function polishUniversalSegmentsAfterGeneration(opts = {}) {
  const checkPause = typeof opts.checkPause === 'function' ? opts.checkPause : async () => {}
  const onShotProgress = typeof opts.onShotProgress === 'function' ? opts.onShotProgress : null
  const onShotError = typeof opts.onShotError === 'function' ? opts.onShotError : null

  if (!storyboardUniversalOmni.value) return { polished: 0, skipped: true }

  const rawList = store.currentEpisode?.storyboards || []
  const list = rawList.slice().sort((a, b) => (Number(a.storyboard_number) || 0) - (Number(b.storyboard_number) || 0))
  const targets = list.filter((sb) => sb?.id && isSbUniversalMode(sb.id) && sbUniversalSegmentTrimmed(sb))

  if (!targets.length) return { polished: 0, skipped: true }

  universalOmniPolishRunning.value = true
  universalOmniPolishProgress.value = { current: 0, total: targets.length, label: '' }
  let polished = 0
  try {
    for (let i = 0; i < targets.length; i++) {
      await checkPause()
      const sb = targets[i]
      const cur = i + 1
      const label = '#' + (sb.storyboard_number ?? cur) + (sb.title ? ' ' + String(sb.title).slice(0, 20) : '')
      universalOmniPolishProgress.value = { current: cur, total: targets.length, label }
      if (onShotProgress) onShotProgress(cur, targets.length, sb)

      const draft = sbUniversalSegmentTrimmed(sb)
      if (!draft) continue

      generatingUniversalSegmentIds.add(sb.id)
      let live = ''
      try {
        const durationSec = universalSegmentDurationSecForSb(sb)
        const data = await storyboardsAPI.polishUniversalSegmentPromptStream(
          sb.id,
          {
            duration: durationSec,
            draft_universal_segment_text: draft,
            field_overrides: buildUniversalSegmentFieldOverrides(sb),
            force_without_reference_images: true,
          },
          (delta) => {
            live += delta
            sbUniversalSegmentText.value = { ...sbUniversalSegmentText.value, [sb.id]: live }
          }
        )
        const text = (data?.universal_segment_text ?? '').toString().trim()
        if (text) {
          polished += 1
          sbUniversalSegmentText.value = { ...sbUniversalSegmentText.value, [sb.id]: text }
          const storyList = store.currentEpisode?.storyboards
          if (Array.isArray(storyList)) {
            const row = storyList.find((x) => Number(x.id) === Number(sb.id))
            if (row) row.universal_segment_text = text
          }
        }
      } catch (e) {
        const msg = e?.message || String(e)
        if (onShotError) onShotError(sb, msg)
        else ElMessage.warning(t('t640', { arg0: sb.storyboard_number ?? sb.id, arg1: msg }))
      } finally {
        generatingUniversalSegmentIds.delete(sb.id)
      }
      await pipelineRest()
    }
  } finally {
    universalOmniPolishRunning.value = false
    universalOmniPolishProgress.value = { current: 0, total: 0, label: '' }
  }
  return { polished, skipped: false }
}

/** 为视频生成获取参考图的真实 URL */
async function getMainImageUrlForVideo(sb) {
  return getSbFirstFrameUrl(sb)
}

/** 转为视频接口可请求的绝对 URL（后端/第三方需能访问） */
function toAbsoluteImageUrl(url) {
  if (!url || !String(url).trim()) return ''
  const s = String(url).trim()
  if (s.startsWith('http://') || s.startsWith('https://')) return s
  const base = (baseUrl.value || '').replace(/\/$/, '') || (typeof window !== 'undefined' ? window.location.origin : '')
  return base ? base + (s.startsWith('/') ? s : '/' + s) : s
}

function sbUniversalSegmentTrimmed(sb) {
  if (!sb?.id) return ''
  return (sbUniversalSegmentText.value[sb.id] ?? sb.universal_segment_text ?? '').toString().trim()
}

function sbCanSubmitVideo(sb) {
  if (!sb) return false
  const vp = (sb.video_prompt || '').toString().trim()
  if (vp) return true
  if (isSbUniversalMode(sb.id)) return !!sbUniversalSegmentTrimmed(sb)
  return false
}

/** 提交给视频 API 的文案：全能模式有片段描述时仅提交该段（不拼接 video_prompt，避免动作/旁白盖过 @图片 等编排） */
function buildSbVideoPromptForApi(sb, { preferClassicPrompt = false } = {}) {
  const vp = (sb.video_prompt || '').toString().trim()
  const seg = sbUniversalSegmentTrimmed(sb)
  if (preferClassicPrompt) return vp || seg
  if (isSbUniversalMode(sb.id)) {
    if (seg) return seg
    return vp
  }
  return vp
}

/** 全能模式：与 collectSbOmniReferenceAbsoluteUrls 同序的参考槽位（用于 @ 选择器缩略图） */
function getSbUniversalOmniRefSlots(sb) {
  if (!sb?.id) return []
  const out = []
  let idx = 1
  const scene = getSbSelectedScene(sb.id)
  if (scene && hasAssetImage(scene)) {
    out.push({
      index: idx++,
      kind: 'scene',
      name: (scene.name || t('t193')).toString(),
      thumbUrl: assetImageUrl(scene),
    })
  }
  for (const c of getSbSelectedCharacters(sb.id)) {
    if (hasAssetImage(c)) {
      out.push({
        index: idx++,
        kind: 'character',
        name: (c.name || t('t194')).toString(),
        thumbUrl: assetImageUrl(c),
      })
    }
  }
  for (const p of getSbSelectedProps(sb.id)) {
    if (hasAssetImage(p)) {
      out.push({
        index: idx++,
        kind: 'prop',
        name: (p.name || t('t196')).toString(),
        thumbUrl: assetImageUrl(p),
      })
    }
  }
  return out
}

/** 全能模式：场景/角色/物品 → 绝对 URL 列表（不含经典分镜中间主图；供可灵 Omni / 火山多图参考，最多 10，方舟侧最多取 9 张） */
function collectSbOmniReferenceAbsoluteUrls(sb) {
  if (!sb?.id) return []
  const urls = []
  const seen = new Set()
  function pushAbs(u) {
    const abs = toAbsoluteImageUrl(u)
    if (!abs || seen.has(abs)) return
    seen.add(abs)
    urls.push(abs)
  }
  const scene = getSbSelectedScene(sb.id)
  if (scene && hasAssetImage(scene)) pushAbs(assetImageUrl(scene))
  for (const c of getSbSelectedCharacters(sb.id)) {
    if (hasAssetImage(c)) pushAbs(assetImageUrl(c))
  }
  for (const p of getSbSelectedProps(sb.id)) {
    if (hasAssetImage(p)) pushAbs(assetImageUrl(p))
  }
  return urls.slice(0, 10)
}

/** 非 Seedance2 全能降级：仅场景参考图（若有） */
function collectSbSceneOnlyReferenceAbsoluteUrls(sb) {
  if (!sb?.id) return []
  const scene = getSbSelectedScene(sb.id)
  if (scene && hasAssetImage(scene)) {
    const abs = toAbsoluteImageUrl(assetImageUrl(scene))
    return abs ? [abs] : []
  }
  return []
}

let activeVideoAiConfigCache = null
let activeVideoAiConfigCacheAt = 0
const ACTIVE_VIDEO_AI_CONFIG_TTL_MS = 15000

function invalidateActiveVideoAiConfigCache() {
  activeVideoAiConfigCache = null
  activeVideoAiConfigCacheAt = 0
}

async function getActiveVideoAiConfig() {
  const now = Date.now()
  if (activeVideoAiConfigCache && now - activeVideoAiConfigCacheAt < ACTIVE_VIDEO_AI_CONFIG_TTL_MS) {
    return activeVideoAiConfigCache
  }
  try {
    const rows = await aiAPI.list('video')
    const list = Array.isArray(rows) ? rows : []
    const active = list.filter((c) => c.is_active !== false)
    activeVideoAiConfigCache = active.find((c) => c.is_default) || active[0] || null
  } catch {
    activeVideoAiConfigCache = null
  }
  activeVideoAiConfigCacheAt = now
  return activeVideoAiConfigCache
}

function videoModelNameFromAiConfig(cfg) {
  if (!cfg) return ''
  const dm = (cfg.default_model || '').toString().trim()
  if (dm) return dm
  const m = cfg.model
  if (Array.isArray(m) && m.length) return String(m[0]).trim()
  return String(m || '').trim()
}

/** 模型名含 seedance 且含 2-0（与后端 videoClient 判定 Seedance 2.x 对齐） */
function isSeedance2VideoModel(modelName) {
  const m = String(modelName || '').toLowerCase()
  if (!m.includes('seedance')) return false
  return /2[-_]0/.test(m) || /seedance[-_]?2|seedance2/.test(m)
}

/** 全能分镜 + 当前视频配置是否可走多图 Omni（火山 volcengine_omni 且 Seedance 2.0，或可灵 kling_omni） */
function canUseUniversalOmniVideoApi(cfg) {
  if (!cfg) return false
  const proto = String(cfg.api_protocol || '').toLowerCase()
  if (proto === 'kling_omni') return true
  if (proto === 'volcengine_omni') {
    return isSeedance2VideoModel(videoModelNameFromAiConfig(cfg))
  }
  return false
}

async function confirmUniversalNonSeedance2Video() {
  await ElMessageBox.confirm(
    t('t641'),
    t('t642'),
    { confirmButtonText: t('t643'), cancelButtonText: t('t304'), type: 'warning' }
  )
}

function onEditSbImagePrompt(sb) {
  if (!sb?.id) return
  editingSbImagePromptId.value = sb.id
  editingSbImagePromptText.value = (sb.image_prompt || '').toString()
}

async function onOpenSbPromptDialog(sb) {
  if (!sb?.id) return
  sbPromptTarget.value = sb
  sbPromptImageText.value = (sb.image_prompt || '').toString()
  sbPromptPolishedText.value = (sb.polished_prompt || '').toString()
  const rawVideo = (sb.video_prompt || '').toString()
  sbPromptVideoText.value = formatVideoPromptForEdit(rawVideo)
  showSbPromptDialog.value = true
  try {
    const fresh = await storyboardsAPI.get(sb.id)
    if (fresh?.id) {
      sbPromptTarget.value = fresh
      sbPromptImageText.value = (fresh.image_prompt || '').toString()
      sbPromptPolishedText.value = (fresh.polished_prompt || '').toString()
      sbPromptVideoText.value = formatVideoPromptForEdit((fresh.video_prompt || '').toString())
    }
  } catch (_) {}
}

function formatVideoPromptForEdit(text) {
  if (!text) return ''
  // 按「主体：」「运动：」等分段做换行，方便阅读
  return text
    .replace(/([。；])\s*(主体|运动|环境|运镜|美学|声音|时长)：/g, '$1\n$2：')
    .replace(/^\s+|\s+$/g, '')
}

async function onPolishSbPrompt() {
  const sb = sbPromptTarget.value
  if (!sb?.id) return
  sbPromptPolishing.value = true
  try {
    const res = await storyboardsAPI.polishPrompt(sb.id)
    if (res?.polished_prompt) {
      sbPromptPolishedText.value = res.polished_prompt
      ElMessage.success(t('t644'))
    }
  } catch (e) {
    ElMessage.error(e.message || t('t634'))
  } finally {
    sbPromptPolishing.value = false
  }
}

async function onSaveSbPromptDialog() {
  const sb = sbPromptTarget.value
  if (!sb?.id) return
  sbPromptSaving.value = true
  try {
    const normalizedVideo = (sbPromptVideoText.value || '').replace(/\s+/g, ' ').trim()
    await storyboardsAPI.update(sb.id, {
      image_prompt: sbPromptImageText.value.trim() || null,
      polished_prompt: sbPromptPolishedText.value.trim() || null,
      video_prompt: normalizedVideo || null,
    })
    await loadDrama()
    showSbPromptDialog.value = false
    ElMessage.success(t('t645'))
  } catch (e) {
    ElMessage.error(e.message || t('t549'))
  } finally {
    sbPromptSaving.value = false
  }
}

async function onSaveSbImagePrompt(sb) {
  if (!sb?.id) return
  try {
    await storyboardsAPI.update(sb.id, { image_prompt: (editingSbImagePromptText.value || '').toString().trim() || null })
    await loadDrama()
    editingSbImagePromptId.value = null
    ElMessage.success(t('t646'))
  } catch (e) {
    ElMessage.error(e.message || t('t549'))
  }
}

function onEditSbVideoPrompt(sb) {
  if (!sb?.id) return
  editingSbVideoPromptId.value = sb.id
  editingSbVideoPromptText.value = (sb.video_prompt || '').toString()
}

/** 将结构化视角三元组转为英文描述片段 + 中文标签（与 angleService.js 保持一致） */
function angleToPromptFragment(h, v, s) {
  const hDesc = { front:'shooting from the front', front_left:'shooting from front-left at 45-degree angle', left:'shooting from the left side, profile view', back_left:'shooting from back-left at 135-degree angle', back:"shooting from behind, character's back to camera", back_right:'shooting from back-right at 135-degree angle', right:'shooting from the right side, profile view', front_right:'shooting from front-right at 45-degree angle' }
  const vDesc = { worm:"extreme low-angle worm's eye view, camera near ground pointing sharply upward, strong upward perspective distortion, background shows sky/ceiling", low:'low-angle upward shot, camera below eye-line, slight upward tilt, empowering perspective', eye_level:'eye-level shot, neutral perspective, natural horizontal framing', high:"high-angle bird's eye view, camera above looking down, background shows floor/ground with downward perspective distortion" }
  const sDesc = { close_up:'close-up shot (face/bust framing), subject fills most of frame, shallow depth of field, background softly blurred', medium:'medium shot (waist-up to full body), character and immediate surroundings visible, moderate depth of field', wide:'wide shot (full body with environment), subject small relative to scene, deep depth of field, environment context prominent' }
  const hLabel = { front:t('t444'), front_left:t('t647'), left:t('t446'), back_left:t('t648'), back:t('t448'), back_right:t('t649'), right:t('t450'), front_right:t('t650') }
  const vLabel = { worm:t('t651'), low:t('t652'), eye_level:t('t439'), high:t('t653') }
  const sLabel = { close_up:t('t410'), medium:t('t408'), wide:t('t407') }
  const fragment = [sDesc[s] || sDesc.medium, vDesc[v] || vDesc.eye_level, hDesc[h] || hDesc.front].join(', ')
  const label = t('t654', { arg0: sLabel[s] || t('t408'), arg1: vLabel[v] || t('t439'), arg2: hLabel[h] || t('t444') })
  return { fragment, label }
}

async function onSaveSbVideoFields(sb) {
  if (!sb?.id) return
  try {
    await storyboardsAPI.update(sb.id, {
      title: (sbTitle.value[sb.id] || '').toString().trim() || null,
      location: (sbLocation.value[sb.id] || '').toString().trim() || null,
      time: (sbTime.value[sb.id] || '').toString().trim() || null,
      duration: Number(sbDuration.value[sb.id]) || 5,
      action: (sbAction.value[sb.id] || '').toString().trim() || null,
      dialogue: (sbDialogue.value[sb.id] || '').toString().trim() || null,
      narration: (sbNarration.value[sb.id] || '').toString().trim() || null,
      atmosphere: (sbAtmosphere.value[sb.id] || '').toString().trim() || null,
      result: (sbResult.value[sb.id] || '').toString().trim() || null,
      angle: (sbAngle.value[sb.id] || '').toString().trim() || null,
      angle_h: sbAngleH.value[sb.id] || null,
      angle_v: sbAngleV.value[sb.id] || null,
      angle_s: sbAngleS.value[sb.id] || null,
      movement: (sbMovement.value[sb.id] || '').toString().trim() || null,
      lighting_style: sbLighting.value[sb.id] || null,
      depth_of_field: sbDof.value[sb.id] || null,
      shot_type: (sbShotType.value[sb.id] || '').toString().trim() || null,
      layout_description: (sbLayoutDescription.value[sb.id] || '').toString().trim() || null,
      creation_mode: sbCreationMode.value[sb.id] === 'universal' ? 'universal' : 'classic',
      universal_segment_text: (sbUniversalSegmentText.value[sb.id] || '').toString().trim() || null,
    })
    const rebuilt = await storyboardsAPI.rebuildVideoPrompt(sb.id)
    const newVp = (rebuilt?.video_prompt && String(rebuilt.video_prompt).trim()) || ''
    if (newVp) {
      videoParamsTarget.value = { ...sb, video_prompt: newVp }
    }
    await loadDrama()
    ElMessage.success(t('t655'))
  } catch (e) {
    ElMessage.error(e.message || t('t549'))
  }
}

async function onSaveSbVideoPrompt(sb) {
  if (!sb?.id) return
  try {
    await storyboardsAPI.update(sb.id, { video_prompt: (editingSbVideoPromptText.value || '').toString().trim() || null })
    await loadDrama()
    editingSbVideoPromptId.value = null
    ElMessage.success(t('t656'))
  } catch (e) {
    ElMessage.error(e.message || t('t549'))
  }
}

function onOpenVideoParamsDialog(sb) {
  videoParamsTarget.value = sb
  showVideoParamsDialog.value = true
}

/** 取消关闭弹窗时，将创作模式与片段描述与服务器状态对齐（避免仅改单选未保存导致本地漂移） */
function onVideoParamsDialogClosed() {
  const sb = videoParamsTarget.value
  if (!sb?.id) return
  const row = (storyboards.value || []).find((x) => Number(x.id) === Number(sb.id))
  if (!row) return
  sbCreationMode.value = { ...sbCreationMode.value, [sb.id]: row.creation_mode === 'universal' ? 'universal' : 'classic' }
  sbUniversalSegmentText.value = { ...sbUniversalSegmentText.value, [sb.id]: (row.universal_segment_text ?? '').toString() }
}

function countDialogueLinesInSb(sb) {
  const raw = ((sbDialogue.value[sb.id] ?? sb.dialogue) || '').toString().trim()
  if (!raw) return 0
  const matches = raw.match(/[\u4e00-\u9fa5A-Za-z0-9·]{1,16}[：:]/g)
  return matches?.length || (raw ? 1 : 0)
}

function canSplitSbByAudio(sb) {
  if (!sb?.id) return false
  const dialogueCount = countDialogueLinesInSb(sb)
  const hasNarration = !!((sbNarration.value[sb.id] ?? sb.narration) || '').toString().trim()
  return dialogueCount + (hasNarration ? 1 : 0) >= 2
}

async function onSplitSbByAudio(sb) {
  if (!sb?.id) return
  try {
    await ElMessageBox.confirm(
      t('t657'),
      t('t482'),
      { type: 'warning', confirmButtonText: t('t658'), cancelButtonText: t('t304') }
    )
  } catch {
    return
  }
  splitByAudioLoading.value = true
  try {
    if (showVideoParamsDialog.value && videoParamsTarget.value?.id === sb.id) {
      await onSaveSbVideoFields(sb)
    }
    const res = await storyboardsAPI.splitByAudio(sb.id)
    const n = res?.storyboard_ids?.length ?? 0
    const summary = res?.plans_summary || ''
    showVideoParamsDialog.value = false
    await loadDrama()
    ElMessage.success(summary ? t('t659', { arg0: n, arg1: summary }) : t('t660', { arg0: n }))
  } catch (e) {
    ElMessage.error(e.message || t('t661'))
  } finally {
    splitByAudioLoading.value = false
  }
}

async function onSaveVideoParams() {
  const sb = videoParamsTarget.value
  if (!sb?.id) return
  videoParamsSaving.value = true
  try {
    await onSaveSbVideoFields(sb)
    showVideoParamsDialog.value = false
  } catch (e) {
    ElMessage.error(e.message || t('t549'))
  } finally {
    videoParamsSaving.value = false
  }
}

async function onBatchInferParams() {
  if (!currentEpisodeId.value) return
  inferringParams.value = true
  try {
    const res = await storyboardsAPI.batchInferParams(currentEpisodeId.value, false)
    await loadDrama()
    ElMessage.success(t('t662', { arg0: res?.updated ?? 0 }))
  } catch (e) {
    ElMessage.error(e.message || t('t663'))
  } finally {
    inferringParams.value = false
  }
}

/** 一键用 AI 重新生成/优化本分镜的布局描述（自动参考上下分镜保证前后连贯） */
async function onRegenerateLayoutDescription(sb) {
  if (sb && typeof sb === 'object' && sb.__v_isRef) sb = sb.value
  if (!sb?.id) return
  regeneratingLayoutSbIds.add(sb.id)
  try {
    const res = await storyboardsAPI.regenerateLayoutDescription(sb.id)
    const newText = res?.layout_description || res?.data?.layout_description
    if (newText) {
      // 直接用本次 AI 返回的结果更新本地编辑状态（响应里已包含新文本）
      sbLayoutDescription.value = { ...sbLayoutDescription.value, [sb.id]: newText }

      // 轻量刷新分镜列表（只更新 store 里的原始 storyboards，不触发 syncStoryboardStateFromEpisode，
      // 避免覆盖我们刚刚写入的 sbLayoutDescription 等本地字段）
      try { await refreshStoryboardsOnly() } catch (_) {}

      ElMessage.success(t('t664'))
      // 注意：不再调用 loadDrama()，因为它会全量重建所有 sbXxx 映射，可能用服务端旧数据覆盖本次结果。
      // 等后端 rowToStoryboard 补全 layout_description 字段后，关闭再打开对话框即可看到持久化值。
    } else {
      ElMessage.warning(t('t665'))
    }
  } catch (e) {
    ElMessage.error(e.message || t('t666'))
  } finally {
    regeneratingLayoutSbIds.delete(sb.id)
  }
}

async function onGenerateSbVideo(sb) {
  if (!dramaId.value || !sb?.id || !sbCanSubmitVideo(sb)) return
  const universal = isSbUniversalMode(sb.id)
  let universalOmniApi = universal
  if (universal) {
    const videoCfg = await getActiveVideoAiConfig()
    if (!canUseUniversalOmniVideoApi(videoCfg)) {
      try {
        await confirmUniversalNonSeedance2Video()
      } catch {
        return
      }
      universalOmniApi = false
    }
  }
  const omniRefs = universalOmniApi ? collectSbOmniReferenceAbsoluteUrls(sb) : []
  const sceneOnlyRefs = universal && !universalOmniApi ? collectSbSceneOnlyReferenceAbsoluteUrls(sb) : []
  const hasClassicFrame = !!getSbFirstFrameUrl(sb)
  let hasAnyImage = false
  if (universalOmniApi) {
    hasAnyImage = omniRefs.length > 0
  } else if (universal) {
    hasAnyImage = hasClassicFrame || sceneOnlyRefs.length > 0
  } else {
    hasAnyImage = hasClassicFrame
  }
  if (!hasAnyImage) {
    if (!universal) {
      await ElMessageBox.alert(
        t('t667'),
        t('t668'),
        { confirmButtonText: t('t669'), type: 'warning' }
      )
      return
    }
    try {
      await ElMessageBox.confirm(
        universalOmniApi
          ? t('t670')
          : t('t671'),
        universalOmniApi ? t('t672') : t('t673'),
        { confirmButtonText: t('t674'), cancelButtonText: t('t304'), type: 'warning' }
      )
    } catch {
      return
    }
  }
  generatingSbVideoIds.add(sb.id)
  const meta = buildSbGenMeta(sb, GEN_RESOURCE.SB_VIDEO, t('t503'))
  genStore.markRunning(meta)
  sbVideoErrors.value[sb.id] = ''
  // 清除前端选中状态 + 清除后端手动指定的 video_url，让合成时自动取最新生成的视频
  if (sbSelectedVideoId.value[sb.id] != null) {
    const next = { ...sbSelectedVideoId.value }
    delete next[sb.id]
    sbSelectedVideoId.value = next
  }
  storyboardsAPI.update(sb.id, { video_url: null }).catch(() => {})
  try {
    let absoluteUrl = ''
    let referenceUrls = undefined
    if (universalOmniApi) {
      referenceUrls = omniRefs.length ? omniRefs : undefined
      absoluteUrl = omniRefs[0] || ''
    } else if (universal) {
      const firstFrameUrl = await getMainImageUrlForVideo(sb)
      absoluteUrl = toAbsoluteImageUrl(firstFrameUrl)
      if (absoluteUrl) {
        referenceUrls = sceneOnlyRefs.length ? sceneOnlyRefs : [absoluteUrl]
      } else {
        referenceUrls = sceneOnlyRefs.length ? sceneOnlyRefs : undefined
        absoluteUrl = sceneOnlyRefs[0] || ''
      }
    } else {
      const firstFrameUrl = await getMainImageUrlForVideo(sb)
      absoluteUrl = toAbsoluteImageUrl(firstFrameUrl)
      referenceUrls = absoluteUrl ? [absoluteUrl] : undefined
    }
    const { first: vFirst, last: vLast } = sbVideoFirstLastUrls(sb, universalOmniApi, null)
    if (!universalOmniApi && vLast && referenceUrls && !referenceUrls.includes(vLast)) {
      referenceUrls = [...referenceUrls, vLast]
    }
    const preferClassicPrompt = universal && !universalOmniApi
    const res = await videosAPI.create({
      drama_id: dramaId.value,
      storyboard_id: sb.id,
      prompt: buildSbVideoPromptForApi(sb, { preferClassicPrompt }),
      image_url: (vFirst || absoluteUrl) || undefined,
      first_frame_url: vFirst || absoluteUrl || undefined,
      last_frame_url: vLast,
      reference_image_urls: referenceUrls,
      style: getSelectedStyle(),
      aspect_ratio: projectAspectRatio.value || '16:9',
      resolution: videoResolution.value || undefined,
      duration: getSbVideoDurationForApi(sb),
    })
    if (res?.task_id) {
      const pollRes = await pollTask(res.task_id, () => loadSingleStoryboardMedia(sb.id), meta)
      if (pollRes?.status === 'failed') {
        sbVideoErrors.value[sb.id] = pollRes.error || t('t522')
      } else if (pollRes?.status === 'completed') {
        sbVideoErrors.value[sb.id] = ''
        ElMessage.success(t('t292'))
      }
    } else {
      await loadSingleStoryboardMedia(sb.id)
      ElMessage.success(t('t675'))
    }
  } catch (e) {
    sbVideoErrors.value[sb.id] = e.message || t('t676')
    ElMessage.error(e.message || t('t676'))
  } finally {
    generatingSbVideoIds.delete(sb.id)
    genStore.markDone(meta)
    await loadSingleStoryboardMedia(sb.id)
  }
}

/** 尾帧衔接：提取当前视频最后一帧，设为下一个分镜的首帧 */
async function onLinkTailFrameToNext(sb) {
  if (!dramaId.value || !sb?.id) return
  const nextSb = getNextStoryboard(sb.id)
  if (!nextSb) {
    ElMessage.warning(t('t677'))
    return
  }
  const video = getSbVideo(sb.id)
  if (!video) {
    ElMessage.warning(t('t678'))
    return
  }
  try {
    await ElMessageBox.confirm(
      t('t679', { arg0: sb.storyboard_number ?? sb.id, arg1: nextSb.storyboard_number ?? nextSb.id }),
      t('t269'),
      { confirmButtonText: t('t680'), cancelButtonText: t('t304'), type: 'warning' }
    )
  } catch {
    return
  }
  linkingTailFrameIds.add(sb.id)
  try {
    const data = await storyboardsAPI.linkTailFrame(sb.id, { drama_id: dramaId.value })
    if (data?.error) {
      throw new Error(data.error)
    }
    ElMessage.success(t('t681', { arg0: nextSb.storyboard_number ?? nextSb.id }))
    // 刷新两个分镜的媒体
    await Promise.all([
      loadSingleStoryboardMedia(sb.id),
      loadSingleStoryboardMedia(nextSb.id)
    ])
  } catch (e) {
    ElMessage.error(e.message || t('t682'))
  } finally {
    linkingTailFrameIds.delete(sb.id)
  }
}

/** 上镜尾帧：直接把上一分镜的尾帧图片（高清原图）设为当前分镜的首帧，无需 ffmpeg 提取视频帧，画面更清晰 */
async function onUsePrevTailAsFirst(sb) {
  if (!dramaId.value || !sb?.id) return
  const prevSb = getPrevStoryboard(sb.id)
  if (!prevSb) {
    ElMessage.warning(t('t683'))
    return
  }
  const prevLastImg = getSbLastImage(prevSb.id)
  if (!prevLastImg) {
    ElMessage.warning(t('t684', { arg0: prevSb.storyboard_number ?? prevSb.id }))
    return
  }

  // 直接执行，不再弹确认框（用户已通过按钮 + tooltip 明确意图）
  usingPrevTailAsFirstIds.add(sb.id)
  try {
    // 通过 upload 接口在“当前分镜”下创建一个 image 记录（复用上一镜尾帧的物理文件路径/URL），frame_type 触发后端自动 bind
    const uploaded = await imagesAPI.upload({
      storyboard_id: sb.id,
      drama_id: dramaId.value,
      image_url: prevLastImg.image_url || '',
      local_path: prevLastImg.local_path || undefined,
      prompt: t('t685', { arg0: prevSb.storyboard_number ?? prevSb.id }),
      frame_type: 'storyboard_first'
    })
    if (uploaded?.id) {
      // 手动设置本地选中，确保显示立即切换；同时调用 onSelect 做一次 server patch（与 upload 里的 bind 互补）
      onSelectSbFrameImage(sb, uploaded, 'first')
    }
    ElMessage.success(t('t686', { arg0: prevSb.storyboard_number ?? prevSb.id }))

    // 刷新分镜元数据（拿回服务器最新的 first_frame_image_id）+ 媒体列表
    await Promise.all([
      refreshStoryboardsOnly(),
      loadSingleStoryboardMedia(sb.id)
    ])
    // 清除可能残留的手动选中（让服务器权威绑定 id 生效）
    delete sbSelectedImgId.value[sb.id]
  } catch (e) {
    ElMessage.error(e.message || t('t687'))
  } finally {
    usingPrevTailAsFirstIds.delete(sb.id)
  }
}

/** 生成期间轻量刷新分镜列表（只更新指定集 storyboards，不重载整个 drama） */
async function refreshStoryboardsForEpisode(episodeId) {
  if (!episodeId) return
  try {
    const res = await dramaAPI.getStoryboards(episodeId)
    const list = Array.isArray(res) ? res : (res?.storyboards ?? null)
    if (!Array.isArray(list)) return
    if (Number(store.currentEpisode?.id) === Number(episodeId)) {
      store.currentEpisode.storyboards = list
    }
    const epInDrama = store.drama?.episodes?.find((e) => Number(e.id) === Number(episodeId))
    if (epInDrama) {
      epInDrama.storyboards = list
    }
  } catch (_) { /* 静默忽略，不影响主流程 */ }
}

/** @deprecated 使用 refreshStoryboardsForEpisode */
async function refreshStoryboardsOnly() {
  return refreshStoryboardsForEpisode(currentEpisodeId.value)
}

async function onGenerateStoryboard() {
  trackFilmCreateAction('generate_storyboard_click')
  const epId = currentEpisodeId.value
  if (!epId) return
  const meta = buildExtractTaskMeta(store, dramaId.value, epId, GEN_RESOURCE.GENERATE_STORYBOARD, t('t688'))
  genStore.markRunning(meta)
  // 生成期间每 2 秒刷新该集分镜列表，让已解析的分镜逐步出现（切集后仍更新原集缓存）
  const refreshTimer = setInterval(() => refreshStoryboardsForEpisode(epId), 2000)
  try {
    const res = await dramaAPI.generateStoryboard(epId, {
      model: undefined,
      style: getSelectedStyle(),
      storyboard_count: getStoryboardCountForApi(),
      video_duration: getVideoDurationForApi(),
      aspect_ratio: projectAspectRatio.value || '16:9',
      include_narration: !!storyboardIncludeNarration.value,
      universal_omni_storyboard: !!storyboardUniversalOmni.value,
    })
    const taskId = res?.task_id ?? (typeof res === 'string' ? res : null)
    if (taskId) {
      const pollRes = await pollTask(taskId, () => loadDrama(), meta)
      // failed / timeout：pollTask 内已展示对应提示，直接返回，不显示「完成」
      if (pollRes?.status !== 'completed') return
      if (pollRes?.result?.truncated) {
        sbTruncatedWarning.value = true
        sbTruncatedDismissed.value = false
      }
    }
    await loadDrama()
    // 生成完成后静默补全空缺的摄影参数（只填未填字段，不覆盖 AI 已填的）
    storyboardsAPI.batchInferParams(epId, false).catch(() => {})
    const polishRes = await polishUniversalSegmentsAfterGeneration({})
    const polishedN = polishRes?.polished ?? 0
    ElMessage.success(
      storyboardUniversalOmni.value
        ? polishedN > 0
          ? t('t689', { arg0: polishedN })
          : t('t690')
        : t('t691')
    )
    trackFilmCreateAction('generate_storyboard_complete', {
      extra: { storyboard_count: (store.storyboards || []).length },
    })
  } catch (e) {
    // HTTP 错误由 request 拦截器统一展示，此处仅处理拦截器未覆盖的异常
    if (!e.response) ElMessage.error(e.message || t('t552'))
  } finally {
    clearInterval(refreshTimer)
    genStore.markDone(meta)
  }
}

async function onAddSingleStoryboard(){
  if (!currentEpisodeId.value) {
    ElMessage.warning(t('t692'))
    return
  }
  try {
    // 获取当前最大序号（仅计算当前集的分镜）
    const maxNum = (store.storyboards || [])
      .filter(sb => sb.episode_id === currentEpisodeId.value)
      .reduce((max, sb) => Math.max(max, sb.storyboard_number || 0), 0)
    await storyboardsAPI.create({
      episode_id: currentEpisodeId.value,
      storyboard_number: maxNum + 1,
      title: t('t693', { arg0: maxNum + 1 }),
      description: '',
    })
    ElMessage.success(t('t694'))
    await loadDrama() // 刷新列表
  } catch (e) {
    ElMessage.error(e.message || t('t607'))
  }
}

async function onDeleteSingleStoryboard(id){
  try {
    await ElMessageBox.confirm(t('t695'), t('t696'), {
      confirmButtonText: t('t095'),
      cancelButtonText: t('t304'),
      type: 'warning'
    })
    await storyboardsAPI.delete(id)
    ElMessage.success(t('t697'))
    await loadDrama() // 刷新列表
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error(e.message || t('t543'))
    }
  }
}

async function onInsertStoryboardBefore(sb) {
  try {
    await storyboardsAPI.insertBefore(sb.id)
    ElMessage.success(t('t698'))
    await loadDrama()
  } catch (e) {
    ElMessage.error(e.message || t('t699'))
  }
}

async function startBatchImageGeneration() {
  if (!currentEpisodeId.value || batchImageRunning.value || pipelineRunning.value) return
  batchImageErrors.value = []
  batchImageStopping.value = false
  batchImageRunning.value = true
  try {
    // 仅当媒体数据尚未加载时才全量拉取，避免点击时触发大量冗余请求
    if (Object.keys(sbImages.value).length === 0) {
      await loadStoryboardMedia()
    }
    const boards = store.storyboards || []
    const todo = boards.filter((sb) => !hasSbImage(sb))
    if (todo.length === 0) {
      ElMessage.info(t('t700'))
      return
    }
    batchImageProgress.value = { current: 0, total: todo.length, failed: 0 }
    const concurrency = pipelineConcurrency.value || 3
    let doneCount = 0

    // 并发执行，使用与 pipeline 相同的并发模型
    let queueIdx = 0
    const worker = async () => {
      while (queueIdx < todo.length) {
        if (batchImageStopping.value) break
        const sb = todo[queueIdx++]
        const useFirstLast = storyboardUseFirstLastFrame.value && !isSbUniversalMode(sb.id)
        try {
          let prompt = sb.polished_prompt || sb.image_prompt || sb.description || ''
          let frameTypeForCreate = gridMode.value !== 'single' ? gridMode.value : undefined
          if (useFirstLast) {
            // 首尾帧模式下，批量生成分镜图也必须走专业首帧提示词（含 layout_description 空间合同、专用 system prompt 等）
            prompt = await ensureProfessionalFramePrompt(sb, 'first')
            frameTypeForCreate = 'storyboard_first'
          }
          const res = await imagesAPI.create({
            storyboard_id: sb.id,
            drama_id: dramaId.value,
            prompt,
            style: getSelectedStyle(),
            frame_type: frameTypeForCreate,
            aspect_ratio: projectAspectRatio.value || '16:9',
          })
          if (res?.task_id) {
            const pollRes = await pollTask(res.task_id, () => loadSingleStoryboardMedia(sb.id))
            if (pollRes?.status === 'failed') {
              batchImageErrors.value.push(t('t701', { arg0: sb.storyboard_number ?? sb.id, arg1: pollRes.error || t('t552') }))
              batchImageProgress.value = { ...batchImageProgress.value, failed: batchImageProgress.value.failed + 1 }
            }
          } else {
            await loadSingleStoryboardMedia(sb.id)
          }
          // 成功后清理手动选中，让服务器 first_frame_image_id 成为权威（与单条生成首帧的清理逻辑一致）
          if (useFirstLast) {
            delete sbSelectedImgId.value[sb.id]
          }
        } catch (e) {
          batchImageErrors.value.push(t('t701', { arg0: sb.storyboard_number ?? sb.id, arg1: e.message || t('t676') }))
          batchImageProgress.value = { ...batchImageProgress.value, failed: batchImageProgress.value.failed + 1 }
        }
        doneCount++
        batchImageProgress.value = { ...batchImageProgress.value, current: doneCount }
      }
    }
    await Promise.allSettled(Array.from({ length: Math.min(concurrency, todo.length) }, () => worker()))
    if (!batchImageStopping.value) {
      // 最终统一恢复选中状态，确保所有首帧生成后服务器绑定立即生效（与单条生成路径一致）
      restoreSelectionsFromBackend()
      if (batchImageProgress.value.failed === 0) ElMessage.success(t('t702', { arg0: todo.length }))
      else ElMessage.warning(t('t703', { arg0: batchImageProgress.value.failed, arg1: todo.length }))
    } else {
      ElMessage.info(t('t704'))
    }
  } finally {
    batchImageRunning.value = false
  }
}

async function startBatchVideoGeneration() {
  if (!currentEpisodeId.value || batchVideoRunning.value || pipelineRunning.value) return
  batchVideoErrors.value = []
  batchVideoStopping.value = false
  batchVideoRunning.value = true
  try {
    // 仅当媒体数据尚未加载时才全量拉取，避免点击时触发大量冗余请求
    if (Object.keys(sbVideos.value).length === 0) {
      await loadStoryboardMedia()
    }
    const boards = store.storyboards || []
    // 只处理：有参考图（经典=分镜主图；全能=场景/角色/道具，不含经典主图）且 还没有已完成视频 的分镜
    const todo = boards.filter((sb) => {
      const vidList = sbVideos.value[sb.id] || []
      if (vidList.some((v) => v.status === 'completed' && recordHasPlayableVideoUrl(v))) return false
      if (isSbUniversalMode(sb.id)) {
        if (!sbCanSubmitVideo(sb)) return false
        return collectSbOmniReferenceAbsoluteUrls(sb).length > 0
      }
      return !!getSbFirstFrameUrl(sb)
    })
    if (todo.length === 0) {
      ElMessage.info(t('t705'))
      return
    }
    batchVideoProgress.value = { current: 0, total: todo.length, failed: 0 }
    const contiguity = videoFrameContiguity.value
    // 连贯帧模式强制顺序（concurrency=1），普通模式并发
    const videoConcurrency = contiguity ? 1 : (pipelineVideoConcurrency.value || 2)
    let videoDoneCount = 0
    let prevVideoItem = null  // 连贯帧：保存上一条已完成的视频记录

    let videoQueueIdx = 0
    const videoWorker = async () => {
      while (videoQueueIdx < todo.length) {
        if (batchVideoStopping.value) break
        const sb = todo[videoQueueIdx++]
        const universal = isSbUniversalMode(sb.id)
        const omniRefs = universal ? collectSbOmniReferenceAbsoluteUrls(sb) : []
        if (!universal && !getSbFirstFrameUrl(sb)) {
          videoDoneCount++
          batchVideoProgress.value = { ...batchVideoProgress.value, current: videoDoneCount }
          continue
        }
        if (universal && !omniRefs.length) {
          videoDoneCount++
          batchVideoProgress.value = { ...batchVideoProgress.value, current: videoDoneCount }
          continue
        }
        try {
          // 批量生成时清除手动指定的视频，确保合成时使用最新生成记录
          storyboardsAPI.update(sb.id, { video_url: null }).catch(() => {})
          if (sbSelectedVideoId.value[sb.id] != null) {
            const next = { ...sbSelectedVideoId.value }
            delete next[sb.id]
            sbSelectedVideoId.value = next
          }
          const firstFrameUrl = await getMainImageUrlForVideo(sb)
          const absoluteUrl = universal ? (omniRefs[0] || '') : toAbsoluteImageUrl(firstFrameUrl)
          // 连贯帧：提取上一条视频末帧作为参考（全能模式不走连贯帧替换）
          let contiguityFirstFrameUrl = absoluteUrl
          if (contiguity && prevVideoItem && !universal) {
            const prevVideoUrl = prevVideoItem.local_path
              ? toAbsoluteImageUrl('/static/' + prevVideoItem.local_path.replace(/^\//, ''))
              : prevVideoItem.video_url
            if (prevVideoUrl) {
              try {
                const lastFrameBlob = await captureVideoLastFrame(prevVideoUrl)
                if (lastFrameBlob) {
                  const file = new File([lastFrameBlob], 'continuity_frame.jpg', { type: 'image/jpeg' })
                  const uploadRes = await uploadAPI.uploadImage(file, { dramaId: dramaId.value })
                  if (uploadRes?.local_path) {
                    contiguityFirstFrameUrl = toAbsoluteImageUrl('/static/' + uploadRes.local_path.replace(/^\//, ''))
                  }
                }
              } catch (_) {}
            }
          }
          const { first: vFirst, last: vLast } = sbVideoFirstLastUrls(sb, universal, contiguityFirstFrameUrl || undefined)
          let refUrls = universal
            ? (omniRefs.length ? omniRefs : undefined)
            : (absoluteUrl ? [absoluteUrl] : undefined)
          if (!universal && vLast && refUrls && !refUrls.includes(vLast)) {
            refUrls = [...refUrls, vLast]
          }
          const res = await videosAPI.create({
            drama_id: dramaId.value,
            storyboard_id: sb.id,
            prompt: buildSbVideoPromptForApi(sb),
            image_url: vFirst || undefined,
            first_frame_url: vFirst,
            last_frame_url: vLast,
            reference_image_urls: refUrls,
            style: getSelectedStyle(),
            aspect_ratio: projectAspectRatio.value || '16:9',
            resolution: videoResolution.value || undefined,
            duration: getSbVideoDurationForApi(sb),
          })
          if (res?.task_id) {
            const pollRes = await pollTask(res.task_id, () => loadSingleStoryboardMedia(sb.id))
            if (pollRes?.status === 'failed') {
              batchVideoErrors.value.push(t('t701', { arg0: sb.storyboard_number ?? sb.id, arg1: pollRes.error || t('t552') }))
              batchVideoProgress.value = { ...batchVideoProgress.value, failed: batchVideoProgress.value.failed + 1 }
              prevVideoItem = null
            } else if (contiguity && pollRes?.status === 'completed') {
              // 连贯帧：保存本条视频用于下一条
              const vList = sbVideos.value[sb.id] || []
              prevVideoItem = vList.find((v) => v.status === 'completed') || null
            }
          } else {
            await loadSingleStoryboardMedia(sb.id)
            if (contiguity) {
              const vList = sbVideos.value[sb.id] || []
              prevVideoItem = vList.find((v) => v.status === 'completed') || null
            }
          }
        } catch (e) {
          batchVideoErrors.value.push(t('t701', { arg0: sb.storyboard_number ?? sb.id, arg1: e.message || t('t676') }))
          batchVideoProgress.value = { ...batchVideoProgress.value, failed: batchVideoProgress.value.failed + 1 }
          if (contiguity) prevVideoItem = null
        }
        videoDoneCount++
        batchVideoProgress.value = { ...batchVideoProgress.value, current: videoDoneCount }
      }
    }
    await Promise.allSettled(Array.from({ length: Math.min(videoConcurrency, todo.length) }, () => videoWorker()))
    if (!batchVideoStopping.value) {
      if (batchVideoProgress.value.failed === 0) ElMessage.success(t('t706', { arg0: todo.length }))
      else ElMessage.warning(t('t703', { arg0: batchVideoProgress.value.failed, arg1: todo.length }))
    } else {
      ElMessage.info(t('t704'))
    }
  } finally {
    batchVideoRunning.value = false
  }
}

function getFinalizeMergeOptions() {
  return {
    burn_narration_subtitles: !!videoSubtitle.value,
    burn_dialogue_audio: !!videoBurnDialogue.value,
    watermark_text: videoWatermark.value ? String(videoWatermarkText.value || '').trim().slice(0, 200) : '',
  }
}

async function onGenerateVideo() {
  if (!currentEpisodeId.value) return
  const epId = currentEpisodeId.value
  const did = dramaId.value
  const dramaTitle = store.drama?.title || ''
  const epNum = store.currentEpisode?.episode_number
  const epLabel = dramaTitle ? t('t520', { arg0: dramaTitle, arg1: epNum ?? '' }) : t('t521', { arg0: epNum ?? '' })
  const mergeMeta = {
    dramaId: did,
    episodeId: epId,
    dramaTitle,
    episodeNumber: epNum,
    resourceType: GEN_RESOURCE.EPISODE_MERGE,
    resourceId: epId,
    label: t('t707', { arg0: epLabel }),
  }
  store.setVideoStatus('generating', did, epId)
  store.setVideoProgress(5, did, epId)
  genStore.markRunning(mergeMeta)
  videoErrorMsg.value = ''
  try {
    const result = await dramaAPI.finalizeEpisode(epId, getFinalizeMergeOptions())
    if (result?.task_id != null) {
      store.setVideoProgress(10, did, epId)
      ElMessage.success(result?.message || t('t708'))
      const pollResult = await pollTask(result.task_id, () => loadDrama(), mergeMeta)
      await loadDrama()
      if (pollResult?.status === 'completed') {
        store.setVideoProgress(100, did, epId)
        if (currentEpisodeVideoUrl.value) {
          store.setVideoStatus('done', did, epId)
          ElMessage.success(t('t292'))
        } else {
          store.setVideoStatus('error', did, epId)
          videoErrorMsg.value = t('t709')
          ElMessage.warning(videoErrorMsg.value)
        }
      } else if (pollResult?.status === 'failed') {
        store.setVideoStatus('error', did, epId)
        videoErrorMsg.value = pollResult?.error || t('t522')
      } else if (pollResult?.status === 'timeout') {
        store.setVideoStatus('generating', did, epId)
        videoErrorMsg.value = t('t710')
        ElMessage.warning(videoErrorMsg.value)
      }
    } else {
      store.setVideoStatus('error', did, epId)
      const msg = result?.message || t('t711')
      videoErrorMsg.value = msg
      ElMessage.warning(msg)
    }
  } catch (e) {
    videoErrorMsg.value = e.message || t('t552')
    store.setVideoStatus('error', did, epId)
  } finally {
    if (store.getVideoStatus(did, epId) !== 'generating') {
      genStore.markDone(mergeMeta)
    }
  }
}

/** 无 task_id 时轮询刷新直到资源出现图片或超时（用于角色/道具/场景图生成） */
async function pollUntilResourceHasImage(checker, maxAttempts = 20, intervalMs = 3000) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs))
    await loadDrama()
    if (checker()) return
  }
}

function pollTask(taskId, onDone, meta = {}) {
  const resolvedMeta = {
    dramaId: meta.dramaId ?? dramaId.value,
    episodeId: meta.episodeId ?? currentEpisodeId.value,
    dramaTitle: meta.dramaTitle ?? store.drama?.title,
    episodeNumber: meta.episodeNumber ?? store.currentEpisode?.episode_number,
    resourceType: meta.resourceType || 'unknown',
    resourceId: meta.resourceId,
    label: meta.label,
    ...meta,
  }
  return genStore.pollTask(taskId, resolvedMeta, onDone, { ElMessage })
}

/** 一键生成视频：暂停时等待，返回 { paused: true } 表示被暂停中断 */
function pollTaskWithPause(taskId, onDone, maxAttempts = 450) {
  const interval = 2000
  let attempts = 0
  return new Promise((resolve) => {
    const tick = async () => {
      if (pipelinePaused.value) {
        resolve({ paused: true })
        return
      }
      if (pipelineCancelRequested.value) {
        resolve({ canceled: true })
        return
      }
      attempts++
      try {
        const t = await taskAPI.get(taskId)
        if (t.status === 'completed') {
          if (onDone) await onDone()
          resolve({ result: t.result })
          return
        }
        if (t.status === 'failed') {
          resolve({ error: t.error || t('t584') })
          return
        }
      } catch (pollErr) {
        console.warn('[pollTaskWithPause] poll attempt failed:', pollErr?.message)
      }
      if (attempts < maxAttempts) setTimeout(tick, interval)
      else {
        resolve({ error: t('t712') })
      }
    }
    setTimeout(tick, interval)
  })
}

function waitForResume() {
  return new Promise((resolve) => {
    pipelineResolveResume = resolve
  })
}

function onPipelineResume() {
  pipelinePaused.value = false
  if (pipelineResolveResume) {
    pipelineResolveResume()
    pipelineResolveResume = null
  }
}

function addPipelineError(step, message) {
  // 取消哨兵不写进错误日志（正常中止流程）
  if (message && String(message).includes(PIPELINE_CANCEL_SENTINEL)) return
  const time = new Date().toLocaleTimeString('zh-CN')
  pipelineErrorLog.value = [...pipelineErrorLog.value, { time, step, message }]
}

async function checkPause() {
  // 取消时抛出一个哨兵错误，中断整条 pipeline（由 trigger 侧 try/finally 捕获善后）
  if (pipelineCancelRequested.value) throw new Error(PIPELINE_CANCEL_SENTINEL)
  while (pipelinePaused.value) {
    await waitForResume()
  }
}

/** 请求取消整条 pipeline：置位取消标记，并解除可能存在的暂停等待，让轮询尽快退出 */
function requestPipelineCancel() {
  pipelineCancelRequested.value = true
  if (pipelinePaused.value) pipelinePaused.value = false
  if (pipelineResolveResume) {
    const r = pipelineResolveResume
    pipelineResolveResume = null
    r()
  }
}

/** 每生成好一个图片或内容后休息，防止任务队列过紧 */
function pipelineRest() {
  return new Promise((r) => setTimeout(r, 1000))
}

/** 跳过倒计时，立即进入下一阶段 */
function skipPipelineCountdown() {
  pipelineCountdown.value = 0
}

/** 阶段间倒计时，支持暂停冻结 + 立即跳过 */
async function runPipelineCountdown(totalSeconds, msg) {
  pipelineCountdown.value = totalSeconds
  pipelineCountdownMsg.value = msg
  try {
    while (pipelineCountdown.value > 0) {
      await checkPause()                              // 暂停时冻结在此
      await new Promise((r) => setTimeout(r, 1000))  // 等 1 秒
      if (pipelineCountdown.value > 0) pipelineCountdown.value--
    }
  } finally {
    pipelineCountdown.value = 0
    pipelineCountdownMsg.value = ''
  }
}

/** 执行可失败步骤，失败时重试最多 maxRetries 次；fn 返回 { paused: true } 表示暂停不重试；返回 true 表示成功；抛错会触发重试 */
async function pipelineWithRetry(stepName, fn, maxRetries = 3) {
  let lastErr
  for (let r = 0; r < maxRetries; r++) {
    try {
      const result = await fn()
      if (result && result.paused === true) return result
      return true
    } catch (e) {
      lastErr = e
      if (r < maxRetries - 1) await pipelineRest()
    }
  }
  addPipelineError(stepName, t('t713') + (lastErr?.message || String(lastErr)))
  return false
}

async function startOneClickPipeline() {
  if (!currentEpisodeId.value || pipelineRunning.value) return
  trackFilmCreateAction('one_click_generate_start')
  pipelineErrorLog.value = []
  pipelineCurrentStep.value = ''
  pipelineStepIndex.value = 0
  pipelineActiveTasks.clear()
  pipelineStepTotal.value = 10
  pipelineRunning.value = true
  pipelinePaused.value = false
  pipelineCancelRequested.value = false
  try {
    await runOneClickPipeline(false)
  } finally {
    pipelineRunning.value = false
    pipelineActiveTasks.clear()
    pipelineCancelRequested.value = false
  }
}

async function startTextFrameworkPipeline() {
  if (!currentEpisodeId.value || pipelineRunning.value) return
  pipelineErrorLog.value = []
  pipelineCurrentStep.value = ''
  pipelineStepIndex.value = 0
  pipelineActiveTasks.clear()
  pipelineStepTotal.value = 4
  pipelineRunning.value = true
  pipelinePaused.value = false
  pipelineCancelRequested.value = false
  try {
    await runOneClickPipeline(true)
  } finally {
    pipelineRunning.value = false
    pipelineActiveTasks.clear()
    pipelineCancelRequested.value = false
  }
}

function setPipelineStep(idx, text) {
  pipelineStepIndex.value = idx
  pipelineCurrentStep.value = t('t714', { arg0: idx, arg1: pipelineStepTotal.value, arg2: text })
}

async function runOneClickPipeline(textOnly = false) {
  const episodeId = currentEpisodeId.value
  const dramaIdVal = dramaId.value
  if (!episodeId || !dramaIdVal) return
  const style = getSelectedStyle()

  try {
    // ════════════════════════════════════════════════════════
    // 阶段一：内容提取 & 分镜生成（快速、低成本）
    // ════════════════════════════════════════════════════════

    // 步骤 1：提取角色
    await checkPause()
    let chars = store.currentEpisode?.characters ?? []
    if (chars.length === 0) {
      setPipelineStep(1, t('t715'))
      try {
        const outline = (store.scriptContent || '').toString().trim() || (storyInput.value || '').toString().trim() || undefined
        const res = await generationAPI.generateCharacters(dramaIdVal, { episode_id: store.currentEpisode?.id ?? undefined, outline: outline || undefined })
        const taskId = res?.task_id
        if (taskId) {
          const result = await pollTaskWithPause(taskId, () => loadDrama())
          if (result?.canceled) return
          if (result?.paused) { await waitForResume(); return }
          if (result?.error) { addPipelineError(t('t716'), result.error); return }
        } else {
          await loadDrama()
        }
        await pipelineRest()
      } catch (e) {
        addPipelineError(t('t716'), e.message || String(e))
        return
      }
      chars = store.currentEpisode?.characters ?? []
    } else {
      setPipelineStep(1, t('t717', { arg0: chars.length }))
    }

    // 步骤 2：提取场景
    await checkPause()
    let sceneList = store.currentEpisode?.scenes ?? []
    if (sceneList.length === 0) {
      setPipelineStep(2, t('t718'))
      try {
        const res = await dramaAPI.extractBackgrounds(episodeId, { model: undefined, style, language: scriptLanguage.value })
        const taskId = res?.task_id
        if (taskId) {
          const result = await pollTaskWithPause(taskId, () => loadDrama())
          if (result?.canceled) return
          if (result?.paused) { await waitForResume(); return }
          if (result?.error) { addPipelineError(t('t719'), result.error); return }
        } else {
          await loadDrama()
        }
        await pipelineRest()
      } catch (e) {
        addPipelineError(t('t719'), e.message || String(e))
        return
      }
      sceneList = store.currentEpisode?.scenes ?? []
    } else {
      setPipelineStep(2, t('t720', { arg0: sceneList.length }))
    }

    // 步骤 3：提取道具
    await checkPause()
    let propList = store.props ?? []
    if (propList.length === 0) {
      setPipelineStep(3, t('t721'))
      try {
        const res = await propAPI.extractFromScript(episodeId)
        const taskId = res?.task_id
        if (taskId) {
          const result = await pollTaskWithPause(taskId, () => loadDrama())
          if (result?.canceled) return
          if (result?.paused) { await waitForResume(); return }
          if (result?.error) { addPipelineError(t('t722'), result.error); return }
        } else {
          await loadDrama()
        }
        await pipelineRest()
      } catch (e) {
        addPipelineError(t('t722'), e.message || String(e))
        // 道具提取失败不中断流程
      }
      propList = store.props ?? []
    } else {
      setPipelineStep(3, t('t723', { arg0: propList.length }))
    }

    // 步骤 4：生成分镜脚本
    await checkPause()
    await loadStoryboardMedia()
    let boards = store.storyboards || []
    const hadBoardsBeforeStep4 = boards.length > 0
    if (boards.length === 0) {
      setPipelineStep(4, t('t724'))
      // 与手动生成一样，每 2 秒刷新一次分镜列表，让已解析的分镜逐步显示
      const sbRefreshTimer = setInterval(refreshStoryboardsOnly, 2000)
      let sbResult
      const sbMaxRetry = 3
      try {
        for (let attempt = 1; attempt <= sbMaxRetry; attempt++) {
          const res = await dramaAPI.generateStoryboard(episodeId, {
            style,
            aspect_ratio: projectAspectRatio.value || '16:9',
            storyboard_count: getStoryboardCountForApi(),
            video_duration: getVideoDurationForApi(),
            include_narration: !!storyboardIncludeNarration.value,
            universal_omni_storyboard: !!storyboardUniversalOmni.value,
          })
          const taskId = res?.task_id ?? (typeof res === 'string' ? res : null)
          if (taskId) {
            sbResult = await pollTaskWithPause(taskId, () => loadDrama())
            // 分镜失败：瞬时故障自动重建任务重试（最多 sbMaxRetry 次），与图/视频对齐
            if (sbResult?.error && attempt < sbMaxRetry) continue
            break
          }
          break
        }
          const result = sbResult
          if (result?.canceled) return
          if (result?.paused) { clearInterval(sbRefreshTimer); await waitForResume(); return }
          if (result?.error) {
            // 任务失败（重试已用尽），但后端可能已保存了部分分镜，确保最新状态显示出来再停止
            await loadDrama()
            addPipelineError(t('t725'), result.error)
            clearInterval(sbRefreshTimer)
            return
          }
          if (result?.result?.truncated) {
            sbTruncatedWarning.value = true
            sbTruncatedDismissed.value = false
          }
        await loadDrama()
        await pipelineRest()
      } catch (e) {
        addPipelineError(t('t725'), e.message || String(e))
        clearInterval(sbRefreshTimer)
        return
      }
      clearInterval(sbRefreshTimer)
      await loadStoryboardMedia()
      boards = store.storyboards || []
    } else {
      setPipelineStep(4, t('t726', { arg0: boards.length }))
    }

    const generatedSbThisPipeline = !hadBoardsBeforeStep4
    if (generatedSbThisPipeline && storyboardUniversalOmni.value) {
      await checkPause()
      await polishUniversalSegmentsAfterGeneration({
        checkPause,
        onShotProgress: (cur, total, sb) =>
          setPipelineStep(
            4,
            t('t727', { arg0: cur, arg1: total, arg2: sb.storyboard_number ?? cur, arg3: (sb.title || '').slice(0, 16) })
          ),
        onShotError: (sb, msg) =>
          addPipelineError(t('t728'), t('t729', { arg0: sb.storyboard_number ?? sb.id, arg1: msg })),
      })
      await loadDrama()
      await loadStoryboardMedia()
    }

    if (textOnly) {
      pipelineCurrentStep.value = t('t730')
      ElMessage.success(t('t731'))
      return
    }

    // ════════════════════════════════════════════════════════
    // ⏱ 倒计时 20 秒：请浏览分镜内容，确认后开始生成角色/场景/道具图片
    // ════════════════════════════════════════════════════════
    await runPipelineCountdown(20, t('t732'))
    await checkPause()

    // ════════════════════════════════════════════════════════
    // 阶段二：角色 / 场景 / 道具 图片生成（中等消耗）
    // ════════════════════════════════════════════════════════

    // 步骤 5：生成角色图
    {
      const charsWithoutImage = chars.filter((c) => !hasAssetImage(c))
      const concurrency = pipelineConcurrency.value
      setPipelineStep(5, t('t733', { arg0: charsWithoutImage.length, arg1: concurrency }))
      const { paused } = await runConcurrently(charsWithoutImage, concurrency, async (char) => {
        await checkPause()
        generatingCharIds.add(char.id)
        try {
          const stepName = t('t734') + (char.name || char.id)
          const ok = await pipelineWithRetry(stepName, async () => {
            const res = await characterAPI.generateImage(char.id, undefined, style)
            const taskId = res?.image_generation?.task_id ?? res?.task_id
            if (taskId) {
              const result = await pollTaskWithPause(taskId, () => loadDrama())
              if (result?.canceled) return { canceled: true }
              if (result?.paused) return { paused: true }
              if (result?.error) throw new Error(result.error)
            } else {
              await loadDrama()
              await pollUntilResourceHasImage(() => {
                const list = store.currentEpisode?.characters ?? []
                const c = list.find((x) => Number(x.id) === Number(char.id))
                return !!(c && (c.image_url || c.local_path))
              })
            }
          })
          if (ok && typeof ok === 'object' && ok.paused) return { paused: true }
        } finally {
          generatingCharIds.delete(char.id)
        }
      }, { getLabel: (char) => t('t734') + (char.name || char.id) })
      if (paused) { await waitForResume() }
    }

    // 步骤 6：生成场景图
    {
      const scenesWithoutImage = sceneList.filter((s) => !hasAssetImage(s))
      const concurrency = pipelineConcurrency.value
      setPipelineStep(6, t('t735', { arg0: scenesWithoutImage.length, arg1: concurrency }))
      await checkPause()
      const { paused } = await runConcurrently(scenesWithoutImage, concurrency, async (scene) => {
        await checkPause()
        generatingSceneIds.add(scene.id)
        try {
          const stepName = t('t736') + (scene.location || scene.id)
          const ok = await pipelineWithRetry(stepName, async () => {
            const useQuad = !!sceneUseQuadGrid.value
            const res = await sceneAPI.generateImage({ scene_id: scene.id, model: undefined, style, use_quad_grid: useQuad })
            const taskId = res?.image_generation?.task_id ?? res?.task_id
            if (taskId) {
              const result = await pollTaskWithPause(taskId, () => loadDrama())
              if (result?.canceled) return { canceled: true }
              if (result?.paused) return { paused: true }
              if (result?.error) throw new Error(result.error)
            } else {
              await loadDrama()
              await pollUntilResourceHasImage(() => {
                const list = store.currentEpisode?.scenes ?? []
                const s = list.find((x) => Number(x.id) === Number(scene.id))
                return !!(s && (s.image_url || s.local_path))
              })
            }
          })
          if (ok && typeof ok === 'object' && ok.paused) return { paused: true }
        } finally {
          generatingSceneIds.delete(scene.id)
        }
      }, { getLabel: (scene) => t('t736') + (scene.location || scene.id) })
      if (paused) { await waitForResume() }
    }

    // 步骤 7：生成道具图
    {
      const propsWithoutImage = propList.filter((p) => !hasAssetImage(p))
      const concurrency = pipelineConcurrency.value
      setPipelineStep(7, t('t737', { arg0: propsWithoutImage.length, arg1: concurrency }))
      await checkPause()
      const { paused } = await runConcurrently(propsWithoutImage, concurrency, async (prop) => {
        await checkPause()
        generatingPropIds.add(prop.id)
        try {
          const stepName = t('t738') + (prop.name || prop.id)
          const ok = await pipelineWithRetry(stepName, async () => {
            const res = await propAPI.generateImage(prop.id, undefined, style)
            const taskId = res?.image_generation?.task_id ?? res?.task_id
            if (taskId) {
              const result = await pollTaskWithPause(taskId, () => loadDrama())
              if (result?.canceled) return { canceled: true }
              if (result?.paused) return { paused: true }
              if (result?.error) throw new Error(result.error)
            } else {
              await loadDrama()
              await pollUntilResourceHasImage(() => {
                const list = store.props ?? []
                const p = list.find((x) => Number(x.id) === Number(prop.id))
                return !!(p && (p.image_url || p.local_path))
              })
            }
          })
          if (ok && typeof ok === 'object' && ok.paused) return { paused: true }
        } finally {
          generatingPropIds.delete(prop.id)
        }
      }, { getLabel: (prop) => t('t738') + (prop.name || prop.id) })
      if (paused) { await waitForResume() }
    }

    // ════════════════════════════════════════════════════════
    // ⏱ 倒计时 30 秒：请浏览角色/场景/道具图，确认后开始生成分镜图
    // ════════════════════════════════════════════════════════
    await runPipelineCountdown(30, t('t739'))
    await checkPause()

    // ════════════════════════════════════════════════════════
    // 阶段三：分镜图生成（较高消耗）
    // ════════════════════════════════════════════════════════

    // 步骤 8：生成分镜图
    {
      await loadStoryboardMedia()
      boards = store.storyboards || []
      const boardsWithoutImg = boards.filter((sb) => !hasSbImage(sb))
      const concurrency = pipelineConcurrency.value
      setPipelineStep(8, t('t740', { arg0: boardsWithoutImg.length, arg1: concurrency }))
      const { paused } = await runConcurrently(boardsWithoutImg, concurrency, async (sb) => {
        await checkPause()
        generatingSbImageIds.add(sb.id)
        try {
          const stepName = t('t741') + (sb.storyboard_number ?? sb.id)
          const ok = await pipelineWithRetry(stepName, async () => {
            const useFirstLast = storyboardUseFirstLastFrame.value && !isSbUniversalMode(sb.id)
            let prompt = sb.polished_prompt || sb.image_prompt || sb.description || ''
            let frameTypeForCreate = undefined
            if (useFirstLast) {
              prompt = await ensureProfessionalFramePrompt(sb, 'first')
              frameTypeForCreate = 'storyboard_first'
            }
            const res = await imagesAPI.create({
              storyboard_id: sb.id,
              drama_id: dramaIdVal,
              prompt,
              model: undefined,
              style,
              frame_type: frameTypeForCreate,
              aspect_ratio: projectAspectRatio.value || '16:9',
            })
            if (res?.task_id) {
              // 视频：单次最长等 10 分钟（AGNES 重启等场景会一直 pending，用更短的卡死上限尽早重提交）
              const result = await pollTaskWithPause(res.task_id, () => loadSingleStoryboardMedia(sb.id), 300)
              if (result?.canceled) return { canceled: true }
              if (result?.paused) return { paused: true }
              if (result?.error) throw new Error(result.error)
            } else await loadSingleStoryboardMedia(sb.id)
          })
          if (ok && typeof ok === 'object' && ok.paused) return { paused: true }
        } finally {
          generatingSbImageIds.delete(sb.id)
        }
      }, { getLabel: (sb) => t('t741') + (sb.storyboard_number ?? sb.id) })
      if (paused) { await waitForResume() }
    }

    // ════════════════════════════════════════════════════════
    // ⏱ 倒计时 20 秒：请浏览分镜图，确认后开始生成分镜视频
    // ════════════════════════════════════════════════════════
    await runPipelineCountdown(20, t('t742'))
    await checkPause()

    // ════════════════════════════════════════════════════════
    // 阶段四：分镜视频 & 合集（最高消耗）
    // ════════════════════════════════════════════════════════

    // 步骤 9：生成分镜视频
    {
      await loadStoryboardMedia()
      const boards2 = (store.storyboards || []).filter((sb) => {
        const vidList = sbVideos.value[sb.id] || []
        if (vidList.some((v) => v.status === 'completed' && recordHasPlayableVideoUrl(v))) return false
        if (isSbUniversalMode(sb.id)) {
          if (!sbCanSubmitVideo(sb)) return false
          return collectSbOmniReferenceAbsoluteUrls(sb).length > 0
        }
        return !!getSbFirstFrameUrl(sb)
      })
      const concurrency = pipelineVideoConcurrency.value
      setPipelineStep(9, t('t743', { arg0: boards2.length, arg1: concurrency }))
      const { paused } = await runConcurrently(boards2, concurrency, async (sb) => {
        await checkPause()
        generatingSbVideoIds.add(sb.id)
        try {
          const stepName = t('t744') + (sb.storyboard_number ?? sb.id)
          const ok = await pipelineWithRetry(stepName, async () => {
            const universal = isSbUniversalMode(sb.id)
            const omniRefs = universal ? collectSbOmniReferenceAbsoluteUrls(sb) : []
            const firstFrameUrl = await getMainImageUrlForVideo(sb)
            const absoluteUrl = universal ? (omniRefs[0] || '') : toAbsoluteImageUrl(firstFrameUrl)
            const { first: vFirst, last: vLast } = sbVideoFirstLastUrls(sb, universal, null)
            let refUrls = universal
              ? (omniRefs.length ? omniRefs : undefined)
              : (absoluteUrl ? [absoluteUrl] : undefined)
            if (!universal && vLast && refUrls && !refUrls.includes(vLast)) {
              refUrls = [...refUrls, vLast]
            }
            const res = await videosAPI.create({
              drama_id: dramaIdVal,
              storyboard_id: sb.id,
              prompt: buildSbVideoPromptForApi(sb),
              image_url: vFirst || undefined,
              first_frame_url: vFirst,
              last_frame_url: vLast,
              reference_image_urls: refUrls,
              style,
              aspect_ratio: projectAspectRatio.value || '16:9',
              resolution: videoResolution.value || undefined,
              duration: getSbVideoDurationForApi(sb),
            })
            if (res?.task_id) {
              // 视频：单次最长等 10 分钟（AGNES 重启等场景会一直 pending，用更短的卡死上限尽早重提交）
              const result = await pollTaskWithPause(res.task_id, () => loadSingleStoryboardMedia(sb.id), 300)
              if (result?.canceled) return { canceled: true }
              if (result?.paused) return { paused: true }
              if (result?.error) throw new Error(result.error)
            } else await loadSingleStoryboardMedia(sb.id)
          })
          if (ok && typeof ok === 'object' && ok.paused) return { paused: true }
        } finally {
          generatingSbVideoIds.delete(sb.id)
        }
      }, { getLabel: (sb) => t('t744') + (sb.storyboard_number ?? sb.id) })
      if (paused) { await waitForResume() }
    }

    // 步骤 10：合成整集视频
    await checkPause()
    setPipelineStep(10, t('t745'))
    try {
      // 就绪度检查：先给出缺失素材的分镜清单，避免成片缺镜头被静默吞掉
      for (const sb of (store.storyboards || [])) {
        const lacks = storyboardMissingAssets(sb)
        if (lacks.length) addPipelineError(t('t746'), `分镜 #${sb.storyboard_number ?? sb.id} 缺：${lacks.join('、')}`)
      }
      const result = await dramaAPI.finalizeEpisode(episodeId, getFinalizeMergeOptions())
      if (result?.task_id != null) {
        const pollResult = await pollTaskWithPause(result.task_id, () => loadDrama())
        if (pollResult?.paused) { await waitForResume(); return }
        if (pollResult?.error) addPipelineError(t('t746'), pollResult.error)
        else await pipelineRest()
      } else {
        addPipelineError(t('t746'), result?.message || t('t711'))
      }
    } catch (e) {
      addPipelineError(t('t746'), e.message || String(e))
    }

    pipelineCurrentStep.value = t('t747')
    ElMessage.success(t('t747'))
    trackFilmCreateAction('one_click_generate_complete', {
      extra: { error_count: pipelineErrorLog.value.length },
    })
  } catch (e) {
    addPipelineError(t('t748'), e.message || String(e))
    trackFilmCreateAction('one_click_generate_failed', {
      extra: { message: String(e?.message || 'failed').slice(0, 120) },
    })
  }
}

async function startRepairPipeline() {
  if (!currentEpisodeId.value || pipelineRunning.value) return
  pipelineErrorLog.value = []
  pipelineCurrentStep.value = ''
  pipelineActiveTasks.clear()
  pipelineRunning.value = true
  pipelinePaused.value = false
  try {
    await runRepairPipeline()
  } finally {
    pipelineRunning.value = false
    pipelineActiveTasks.clear()
  }
}

/** 修复缺失：哪一步没有就生成哪一步，有图/有内容就跳过 */
async function runRepairPipeline() {
  const episodeId = currentEpisodeId.value
  const dramaIdVal = dramaId.value
  if (!episodeId || !dramaIdVal) return
  const style = getSelectedStyle()

  try {
    pipelineCurrentStep.value = t('t749')
    await loadDrama()

    // 1. 角色：没有则生成角色；再为每个无图角色生成图
    let chars = store.currentEpisode?.characters ?? []
    if (chars.length === 0) {
      await checkPause()
      pipelineCurrentStep.value = t('t750')
      try {
        const outline = (store.scriptContent || '').toString().trim() || (storyInput.value || '').toString().trim() || undefined
        const res = await generationAPI.generateCharacters(dramaIdVal, { episode_id: store.currentEpisode?.id ?? undefined, outline: outline || undefined })
        const taskId = res?.task_id
        if (taskId) {
          const result = await pollTaskWithPause(taskId, () => loadDrama())
          if (result?.canceled) return
          if (result?.paused) { await waitForResume(); return }
          if (result?.error) { addPipelineError(t('t751'), result.error); return }
        } else await loadDrama()
        await pipelineRest()
      } catch (e) {
        addPipelineError(t('t751'), e.message || String(e))
        return
      }
      chars = store.currentEpisode?.characters ?? []
    }
    const charsWithoutImage = chars.filter((c) => !hasAssetImage(c))
    {
      const concurrency = pipelineConcurrency.value
      pipelineCurrentStep.value = t('t752', { arg0: concurrency })
      const { paused } = await runConcurrently(charsWithoutImage, concurrency, async (char) => {
        await checkPause()
        const stepName = t('t734') + (char.name || char.id)
        const ok = await pipelineWithRetry(stepName, async () => {
          const res = await characterAPI.generateImage(char.id, undefined, style)
          const taskId = res?.image_generation?.task_id ?? res?.task_id
          if (taskId) {
            const result = await pollTaskWithPause(taskId, () => loadDrama())
            if (result?.canceled) return { canceled: true }
            if (result?.paused) return { paused: true }
            if (result?.error) throw new Error(result.error)
          } else {
            await loadDrama()
            await pollUntilResourceHasImage(() => {
              const list = store.currentEpisode?.characters ?? []
              const c = list.find((x) => Number(x.id) === Number(char.id))
              return !!(c && (c.image_url || c.local_path))
            })
          }
        })
        if (ok && typeof ok === 'object' && ok.paused) return { paused: true }
      }, { getLabel: (char) => t('t734') + (char.name || char.id) })
      if (paused) { await waitForResume() }
    }

    // 2. 场景：没有则提取；再为每个无图场景生成图
    let sceneList = store.currentEpisode?.scenes ?? []
    if (sceneList.length === 0) {
      await checkPause()
      pipelineCurrentStep.value = t('t753')
      try {
        const res = await dramaAPI.extractBackgrounds(episodeId, { model: undefined, style, language: scriptLanguage.value })
        const taskId = res?.task_id
        if (taskId) {
          const result = await pollTaskWithPause(taskId, () => loadDrama())
          if (result?.canceled) return
          if (result?.paused) { await waitForResume(); return }
          if (result?.error) { addPipelineError(t('t719'), result.error); return }
        } else await loadDrama()
        await pipelineRest()
      } catch (e) {
        addPipelineError(t('t719'), e.message || String(e))
        return
      }
      sceneList = store.currentEpisode?.scenes ?? []
    }
    const scenesWithoutImage = sceneList.filter((s) => !hasAssetImage(s))
    {
      const concurrency = pipelineConcurrency.value
      pipelineCurrentStep.value = t('t754', { arg0: concurrency })
      const { paused } = await runConcurrently(scenesWithoutImage, concurrency, async (scene) => {
        await checkPause()
        const stepName = t('t736') + (scene.location || scene.id)
        const ok = await pipelineWithRetry(stepName, async () => {
          const useQuad = !!sceneUseQuadGrid.value
          const res = await sceneAPI.generateImage({ scene_id: scene.id, model: undefined, style, use_quad_grid: useQuad })
          const taskId = res?.image_generation?.task_id ?? res?.task_id
          if (taskId) {
            const result = await pollTaskWithPause(taskId, () => loadDrama())
            if (result?.canceled) return { canceled: true }
            if (result?.paused) return { paused: true }
            if (result?.error) throw new Error(result.error)
          } else {
            await loadDrama()
            await pollUntilResourceHasImage(() => {
              const list = store.currentEpisode?.scenes ?? []
              const s = list.find((x) => Number(x.id) === Number(scene.id))
              return !!(s && (s.image_url || s.local_path))
            })
          }
        })
        if (ok && typeof ok === 'object' && ok.paused) return { paused: true }
      }, { getLabel: (scene) => t('t736') + (scene.location || scene.id) })
      if (paused) { await waitForResume() }
    }

    // 2.5 道具：没有则提取；再为每个无图道具生成图
    let propList2 = store.props ?? []
    if (propList2.length === 0) {
      await checkPause()
      pipelineCurrentStep.value = t('t755')
      try {
        const res = await propAPI.extractFromScript(episodeId)
        const taskId = res?.task_id
        if (taskId) {
          const result = await pollTaskWithPause(taskId, () => loadDrama())
          if (result?.canceled) return
          if (result?.paused) { await waitForResume(); return }
          if (result?.error) { addPipelineError(t('t722'), result.error); /* 不中断 */ }
        } else await loadDrama()
        await pipelineRest()
      } catch (e) {
        addPipelineError(t('t722'), e.message || String(e))
      }
      propList2 = store.props ?? []
    }
    const propsWithoutImage2 = propList2.filter((p) => !hasAssetImage(p))
    {
      const concurrency = pipelineConcurrency.value
      pipelineCurrentStep.value = t('t756', { arg0: concurrency })
      await checkPause()
      const { paused } = await runConcurrently(propsWithoutImage2, concurrency, async (prop) => {
        await checkPause()
        generatingPropIds.add(prop.id)
        try {
          const stepName = t('t738') + (prop.name || prop.id)
          const ok = await pipelineWithRetry(stepName, async () => {
            const res = await propAPI.generateImage(prop.id, undefined, style)
            const taskId = res?.image_generation?.task_id ?? res?.task_id
            if (taskId) {
              const result = await pollTaskWithPause(taskId, () => loadDrama())
              if (result?.canceled) return { canceled: true }
              if (result?.paused) return { paused: true }
              if (result?.error) throw new Error(result.error)
            } else {
              await loadDrama()
              await pollUntilResourceHasImage(() => {
                const list = store.props ?? []
                const p = list.find((x) => Number(x.id) === Number(prop.id))
                return !!(p && (p.image_url || p.local_path))
              })
            }
          })
          if (ok && typeof ok === 'object' && ok.paused) return { paused: true }
        } finally {
          generatingPropIds.delete(prop.id)
        }
      }, { getLabel: (prop) => t('t738') + (prop.name || prop.id) })
      if (paused) { await waitForResume() }
    }

    // 3. 分镜：没有则生成分镜；再逐个检查分镜图，没有则生成；再逐个检查分镜视频，没有则生成
    let boards = store.storyboards || []
    const hadBoardsBeforeRepairSb = boards.length > 0
    if (boards.length === 0) {
      await checkPause()
      pipelineCurrentStep.value = t('t757')
      try {
        const res = await dramaAPI.generateStoryboard(episodeId, {
          aspect_ratio: projectAspectRatio.value || '16:9',
          storyboard_count: getStoryboardCountForApi(),
          video_duration: getVideoDurationForApi(),
          include_narration: !!storyboardIncludeNarration.value,
          universal_omni_storyboard: !!storyboardUniversalOmni.value,
        })
        const taskId = res?.task_id ?? (typeof res === 'string' ? res : null)
        if (taskId) {
          const result = await pollTaskWithPause(taskId, () => loadDrama())
          if (result?.canceled) return
          if (result?.paused) { await waitForResume(); return }
          if (result?.error) { addPipelineError(t('t758'), result.error); return }
        }
        await loadDrama()
        await pipelineRest()
      } catch (e) {
        addPipelineError(t('t758'), e.message || String(e))
        return
      }
      boards = store.storyboards || []
    }
    if (!hadBoardsBeforeRepairSb && storyboardUniversalOmni.value) {
      await checkPause()
      await polishUniversalSegmentsAfterGeneration({
        checkPause,
        onShotProgress: (cur, total, sb) => {
          pipelineCurrentStep.value = t('t727', { arg0: cur, arg1: total, arg2: sb.storyboard_number ?? cur, arg3: (sb.title || '').slice(0, 16) })
        },
        onShotError: (sb, msg) =>
          addPipelineError(t('t728'), t('t729', { arg0: sb.storyboard_number ?? sb.id, arg1: msg })),
      })
      await loadDrama()
    }
    // 先拉取分镜图片/视频列表，再批量生成分镜图（并发）
    await loadStoryboardMedia()
    const boardsWithoutImg = boards.filter((sb) => !hasSbImage(sb))
    {
      const concurrency = pipelineConcurrency.value
      pipelineCurrentStep.value = t('t759', { arg0: concurrency })
      const { paused } = await runConcurrently(boardsWithoutImg, concurrency, async (sb) => {
        await checkPause()
        const stepName = t('t741') + (sb.storyboard_number ?? sb.id)
        const ok = await pipelineWithRetry(stepName, async () => {
          const useFirstLast = storyboardUseFirstLastFrame.value && !isSbUniversalMode(sb.id)
          let prompt = sb.polished_prompt || sb.image_prompt || sb.description || ''
          let frameTypeForCreate = undefined
          if (useFirstLast) {
            prompt = await ensureProfessionalFramePrompt(sb, 'first')
            frameTypeForCreate = 'storyboard_first'
          }
          const res = await imagesAPI.create({
            storyboard_id: sb.id,
            drama_id: dramaIdVal,
            prompt,
            model: undefined,
            style,
            frame_type: frameTypeForCreate,
            aspect_ratio: projectAspectRatio.value || '16:9',
          })
          if (res?.task_id) {
            const result = await pollTaskWithPause(res.task_id, () => loadSingleStoryboardMedia(sb.id))
            if (result?.canceled) return { canceled: true }
            if (result?.paused) return { paused: true }
            if (result?.error) throw new Error(result.error)
          } else await loadSingleStoryboardMedia(sb.id)
        })
        if (ok && typeof ok === 'object' && ok.paused) return { paused: true }
      }, { getLabel: (sb) => t('t741') + (sb.storyboard_number ?? sb.id) })
      if (paused) { await waitForResume() }
    }
    await loadStoryboardMedia()
    const boards2 = (store.storyboards || []).filter((sb) => {
      const vidList = sbVideos.value[sb.id] || []
      if (vidList.some((v) => v.status === 'completed' && recordHasPlayableVideoUrl(v))) return false
      if (isSbUniversalMode(sb.id)) {
        if (!sbCanSubmitVideo(sb)) return false
        return collectSbOmniReferenceAbsoluteUrls(sb).length > 0
      }
      return !!getSbFirstFrameUrl(sb)
    })
    {
      const concurrency = pipelineVideoConcurrency.value
      pipelineCurrentStep.value = t('t760', { arg0: concurrency })
      const { paused } = await runConcurrently(boards2, concurrency, async (sb) => {
        await checkPause()
        const stepName = t('t744') + (sb.storyboard_number ?? sb.id)
        const ok = await pipelineWithRetry(stepName, async () => {
          const universal = isSbUniversalMode(sb.id)
          const omniRefs = universal ? collectSbOmniReferenceAbsoluteUrls(sb) : []
          const firstFrameUrl = await getMainImageUrlForVideo(sb)
          const absoluteUrl = universal ? (omniRefs[0] || '') : toAbsoluteImageUrl(firstFrameUrl)
          const { first: vFirst, last: vLast } = sbVideoFirstLastUrls(sb, universal, null)
          let refUrls = universal
            ? (omniRefs.length ? omniRefs : undefined)
            : (absoluteUrl ? [absoluteUrl] : undefined)
          if (!universal && vLast && refUrls && !refUrls.includes(vLast)) {
            refUrls = [...refUrls, vLast]
          }
          const res = await videosAPI.create({
            drama_id: dramaIdVal,
            storyboard_id: sb.id,
            prompt: buildSbVideoPromptForApi(sb),
            image_url: vFirst || undefined,
            first_frame_url: vFirst,
            last_frame_url: vLast,
            reference_image_urls: refUrls,
            aspect_ratio: projectAspectRatio.value || '16:9',
            resolution: videoResolution.value || undefined,
            duration: getSbVideoDurationForApi(sb),
          })
          if (res?.task_id) {
            const result = await pollTaskWithPause(res.task_id, () => loadSingleStoryboardMedia(sb.id))
            if (result?.canceled) return { canceled: true }
            if (result?.paused) return { paused: true }
            if (result?.error) throw new Error(result.error)
          } else await loadSingleStoryboardMedia(sb.id)
        })
        if (ok && typeof ok === 'object' && ok.paused) return { paused: true }
      }, { getLabel: (sb) => t('t744') + (sb.storyboard_number ?? sb.id) })
      if (paused) { await waitForResume() }
    }

    // 4. 生成整集视频（合成整个视频）
    await checkPause()
    pipelineCurrentStep.value = t('t761')
    try {
      // 就绪度检查：先给出缺失素材的分镜清单，避免成片缺镜头被静默吞掉
      for (const sb of (store.storyboards || [])) {
        const lacks = storyboardMissingAssets(sb)
        if (lacks.length) addPipelineError(t('t762'), `分镜 #${sb.storyboard_number ?? sb.id} 缺：${lacks.join('、')}`)
      }
      const result = await dramaAPI.finalizeEpisode(episodeId, getFinalizeMergeOptions())
      if (result?.task_id != null) {
        const pollResult = await pollTaskWithPause(result.task_id, () => loadDrama())
        if (pollResult?.paused) { await waitForResume(); return }
        if (pollResult?.error) addPipelineError(t('t762'), pollResult.error)
        else await pipelineRest()
      } else {
        addPipelineError(t('t762'), result?.message || t('t711'))
      }
    } catch (e) {
      addPipelineError(t('t762'), e.message || String(e))
    }

    // 全剧一致性自检（易用性）：跑完后给出角色/场景一致性结论，不阻断
    try {
      const req = (await import('@/utils/request')).default
      const cons = await req.get(`/dramas/${dramaIdVal}/consistency`)
      const warns = (cons?.findings || []).filter((f) => f.severity === 'warning')
      if (warns.length) {
        addPipelineError(t('t763'), `一致性自检：告警 ${warns.length} 条`)
        warns.slice(0, 3).forEach((f) => addPipelineError(t('t763'), '· ' + f.message))
      } else {
        addPipelineError(t('t763'), '一致性自检通过')
      }
    } catch (_) { /* 自检失败不阻断主流程 */ }

    pipelineCurrentStep.value = t('t763')
    ElMessage.success(t('t764'))
  } catch (e) {
    addPipelineError(t('t748'), e.message || String(e))
  }
}


onBeforeUnmount(() => {
})

function applyRouteToStore() {
  const id = route.params.id
  if (id && id !== 'new') {
    store.setDrama({ id: Number(id) })
    if (route.query.episode) {
      selectedEpisodeId.value = Number(route.query.episode)
    }
    loadDrama()
  } else {
    store.reset()
    storyInput.value = ''
    scriptTitle.value = ''
    selectedEpisodeId.value = null
    savedCurrentEpisodeNumber.value = 1
    storyStyle.value = ''
    storyType.value = ''
    scriptLanguage.value = 'zh'
    scriptStoryboardStyle.value = ''
    generationStyle.value = ''
  }
}

onMounted(async () => {
  loadPipelineConcurrency()
  applyRouteToStore()
})

watch(() => route.params.id, () => {
  applyRouteToStore()
})

// 剧本分集切换时同步 URL query 参数（?episode=<episode_id>），使刷新/分享页面仍保持当前选中集
// 同时监听 query 变化，支持浏览器前进/后退时自动切换对应集次
watch(
  () => selectedEpisodeId.value,
  (newId) => {
    if (!dramaId.value) return
    const currentInQuery = route.query.episode != null ? Number(route.query.episode) : null
    const desired = newId != null ? Number(newId) : null
    if (currentInQuery !== desired) {
      const newQuery = { ...route.query }
      if (desired != null) {
        newQuery.episode = String(desired)
      } else {
        delete newQuery.episode
      }
      router.replace({ query: newQuery }).catch(() => {})
    }
  },
  { flush: 'post' }
)

watch(
  () => route.query.episode,
  (newEp) => {
    if (!dramaId.value) return
    const newVal = newEp != null ? Number(newEp) : null
    const currentSel = selectedEpisodeId.value != null ? Number(selectedEpisodeId.value) : null
    if (currentSel !== newVal) {
      onEpisodeSelect(newVal)
    }
  }
)
</script>

<style scoped>
.script-workbench-unified {
  margin-bottom: 0;
}
.script-workbench-tabs :deep(.el-tabs__header) {
  margin-bottom: 16px;
}
.script-workbench-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
}
.script-workbench-tabs :deep(.el-tabs__item) {
  font-size: 15px;
  font-weight: 600;
}
.script-pane-inner {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.script-sub-block {
  padding-top: 4px;
}
.script-sub-divider {
  margin: 20px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
html.light .script-sub-divider {
  border-top-color: rgba(0, 0, 0, 0.08);
}
.script-mode-hint {
  margin-top: 0;
  margin-bottom: 12px;
}
.script-preview-wrap {
  margin-top: 20px;
}
.preview-block-title {
  margin: 16px 0 8px;
  font-size: 0.95rem;
  font-weight: 600;
  color: #a1a1aa;
}
html.light .preview-block-title {
  color: #64748b;
}
.preview-block-title:first-of-type {
  margin-top: 0;
}
.preview-actions {
  margin-top: 16px;
}
.script-select-empty {
  margin-top: 16px;
  color: #71717a;
  font-size: 14px;
}
.select-script-list {
  min-height: 120px;
  max-height: 420px;
  overflow-y: auto;
}
.select-script-item {
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 8px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.select-script-item:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(99, 102, 241, 0.35);
}
.select-script-item.disabled,
.select-script-item.disabled:hover {
  cursor: not-allowed;
  opacity: 0.55;
  border-color: rgba(255, 255, 255, 0.06);
  background: transparent;
}
html.light .select-script-item {
  border-color: rgba(99, 102, 241, 0.15);
}
html.light .select-script-item:hover {
  background: rgba(99, 102, 241, 0.06);
}
.select-script-title {
  font-weight: 600;
  color: #e4e4e7;
  margin-bottom: 6px;
}
html.light .select-script-title {
  color: #1e1b4b;
}
.select-script-desc {
  font-size: 13px;
  color: #9ca0b2;
  line-height: 1.45;
}
.select-script-empty {
  text-align: center;
  color: #71717a;
  padding: 24px;
}
.preview-ep-tabs {
  margin-top: 4px;
}

.film-create {
  min-height: 100vh;
  background: #16171e;
  background-image:
    radial-gradient(ellipse 80% 50% at 60% -5%, rgba(99, 102, 241, 0.13) 0%, transparent 65%),
    radial-gradient(ellipse 50% 40% at 90% 50%, rgba(139, 92, 246, 0.07) 0%, transparent 55%),
    radial-gradient(ellipse 45% 35% at 5% 75%, rgba(79, 70, 229, 0.06) 0%, transparent 55%),
    linear-gradient(180deg, #16171e 0%, #1a1b24 40%, #1e1f29 100%);
  color: #e4e4e7;
}
html.light .film-create {
  background: #f8f7ff;
  background-image:
    radial-gradient(ellipse 80% 50% at 10% -10%, rgba(139, 92, 246, 0.08) 0%, transparent 50%),
    radial-gradient(ellipse 50% 40% at 85% 110%, rgba(99, 102, 241, 0.06) 0%, transparent 50%);
  color: #1e1b4b;
}
.header {
  background: rgba(20, 21, 28, 0.78);
  backdrop-filter: blur(20px) saturate(1.2);
  -webkit-backdrop-filter: blur(20px) saturate(1.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding: 10px 28px;
  position: sticky;
  top: 0;
  z-index: 200;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.15), 0 4px 20px rgba(0, 0, 0, 0.2);
  margin-left: 180px;
  transition: margin-left 0.25s cubic-bezier(.4,0,.2,1);
}
.sidebar-collapsed .header {
  margin-left: 48px;
}
html.light .header {
  background: rgba(255, 255, 255, 0.82) !important;
  border-bottom-color: rgba(139, 92, 246, 0.1) !important;
  box-shadow: 0 1px 0 rgba(139,92,246,0.06), 0 4px 20px rgba(139, 92, 246, 0.05) !important;
}
.header-inner {
  display: flex;
  align-items: center;
  gap: 16px;
}
.logo {
  margin: 0;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 1px;
  line-height: 1;
  transition: filter 0.3s;
}
.logo:hover { filter: drop-shadow(0 0 10px rgba(139, 92, 246, 0.5)); }
.logo-main {
  font-size: 1.05rem;
  font-weight: 700;
  background: linear-gradient(135deg, #d0d5e8 0%, #a8b0cc 50%, #8890b0 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.01em;
  filter: drop-shadow(0 0 8px rgba(160, 170, 200, 0.15));
}
.logo-sub {
  font-size: 0.65rem;
  font-weight: 400;
  letter-spacing: 0.04em;
  color: #52525e;
  -webkit-text-fill-color: #52525e;
  text-transform: uppercase;
}
html.light .logo-main {
  background: linear-gradient(135deg, #6d28d9, #4f46e5);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
html.light .logo-sub {
  color: #9ca3af;
  -webkit-text-fill-color: #9ca3af;
}
.breadcrumb-sep {
  color: #3a3a44;
  font-size: 0.9rem;
  font-weight: 300;
  flex-shrink: 0;
  user-select: none;
}
html.light .breadcrumb-sep { color: #d1d5db; }
.page-title {
  font-size: 0.82rem;
  font-weight: 500;
  color: #7a7a88;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 4px 12px;
  max-width: 220px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
html.light .page-title {
  color: #6b7280;
  background: rgba(99, 102, 241, 0.04);
  border-color: rgba(99, 102, 241, 0.1);
}
.header-episode-select {
  flex-shrink: 0;
}
.btn-back-drama {
  flex-shrink: 0;
}
.header-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.btn-theme {
  --el-button-bg-color: rgba(255, 255, 255, 0.04);
  --el-button-border-color: rgba(255, 255, 255, 0.08);
  --el-button-text-color: #8b8b96;
  --el-button-hover-bg-color: rgba(255, 255, 255, 0.08);
  --el-button-hover-border-color: rgba(255, 255, 255, 0.18);
  --el-button-hover-text-color: #c8c8d0;
  transition: all 0.2s ease;
}
html.light .btn-theme {
  --el-button-bg-color: rgba(99, 102, 241, 0.04);
  --el-button-border-color: rgba(99, 102, 241, 0.12);
  --el-button-text-color: #6b7280;
  --el-button-hover-bg-color: rgba(99, 102, 241, 0.08);
  --el-button-hover-border-color: rgba(99, 102, 241, 0.3);
  --el-button-hover-text-color: #4f46e5;
}
/* ===== 左侧固定侧边栏 ===== */
.quick-nav {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 210;
  display: flex;
  flex-direction: column;
  padding: 14px 0 10px;
  background: linear-gradient(180deg, #131318 0%, #111116 50%, #0f0f14 100%);
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 1px 0 0 rgba(255,255,255,0.02), 4px 0 24px rgba(0, 0, 0, 0.4);
  width: 180px;
  overflow-y: auto;
  overflow-x: hidden;
  transition: width 0.25s cubic-bezier(.4,0,.2,1), padding 0.25s cubic-bezier(.4,0,.2,1);
}
html.light .quick-nav {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 247, 255, 0.99) 100%);
  border-right-color: rgba(139, 92, 246, 0.1);
  box-shadow: 1px 0 0 rgba(139,92,246,0.06), 4px 0 20px rgba(139, 92, 246, 0.04);
}
.quick-nav::-webkit-scrollbar { width: 4px; }
.quick-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
.quick-nav::-webkit-scrollbar-track { background: transparent; }
.quick-nav.collapsed {
  width: 48px;
  padding: 12px 0;
}
.quick-nav.collapsed .nav-steps,
.quick-nav.collapsed .nav-group {
  display: none;
}
@media (max-width: 768px) {
  .quick-nav { width: 48px; padding: 12px 0; }
  .quick-nav .nav-steps, .quick-nav .nav-group { display: none; }
  .quick-nav .nav-sidebar-title { display: none; }
  .quick-nav .nav-sidebar-header { justify-content: center; padding: 0 4px 8px; }
  .header, .main { margin-left: 48px !important; }
  .main { padding: 16px 12px 48px; }
  .asset-list-two { grid-template-columns: 1fr; }
}
/* 当前任务面板 */
.atp-panel {
  margin-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  padding: 6px 0 4px;
}
.atp-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px 4px;
}
.atp-title {
  font-size: 0.72rem;
  font-weight: 600;
  color: #a78bfa;
  letter-spacing: 0.03em;
  flex: 1;
}
.atp-count-badge {
  font-size: 0.68rem;
  background: rgba(139, 92, 246, 0.25);
  color: #c4b5fd;
  border-radius: 8px;
  padding: 1px 5px;
  min-width: 16px;
  text-align: center;
}
.atp-spin-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #a78bfa;
  flex-shrink: 0;
  animation: atp-pulse 1.2s ease-in-out infinite;
}
@keyframes atp-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.75); }
}
.atp-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.atp-list :deep(.el-tooltip__trigger) {
  display: block;
  width: 100%;
  min-width: 0;
}
.atp-item {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 6px;
  transition: background 0.15s;
  min-width: 0;
  cursor: default;
}
.atp-item:hover { background: rgba(255,255,255,0.05); }
.atp-item-dot {
  display: inline-block;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #7c3aed;
  flex-shrink: 0;
  animation: atp-pulse 1.6s ease-in-out infinite;
}
.atp-item-label {
  font-size: 0.72rem;
  color: #a1a1aa;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}
.atp-more {
  font-size: 0.68rem;
  color: #71717a;
  padding: 2px 10px 2px 19px;
}
/* 折叠态任务徽章 */
.atp-collapsed-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 4px 0;
  cursor: default;
}
.atp-collapsed-count {
  font-size: 0.65rem;
  color: #a78bfa;
  font-weight: 700;
  line-height: 1;
}
html.light .atp-title { color: #7c3aed; }
html.light .atp-count-badge { background: rgba(139,92,246,0.12); color: #7c3aed; }
html.light .atp-spin-dot { background: #7c3aed; }
html.light .atp-item-dot { background: #8b5cf6; }
html.light .atp-item-label { color: #374151; }
html.light .atp-item:hover { background: rgba(0,0,0,0.04); }
html.light .atp-panel { border-top-color: rgba(139,92,246,0.15); }
.nav-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  margin-bottom: 8px;
  flex-shrink: 0;
}
html.light .nav-sidebar-header { border-bottom-color: rgba(139, 92, 246, 0.12); }
.quick-nav.collapsed .nav-sidebar-header {
  justify-content: center;
  padding: 0 4px 8px;
}
.nav-sidebar-title {
  font-size: 13px;
  font-weight: 600;
  color: #7a7a88;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
}
html.light .nav-sidebar-title { color: #7c3aed; }
.nav-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  cursor: pointer;
  color: #5a5a66;
  transition: color 0.15s, background 0.15s;
  border-radius: 6px;
  flex-shrink: 0;
  font-size: 16px;
}
.nav-toggle:hover { color: #c8c8d0; background: rgba(255,255,255,0.06); }
html.light .nav-toggle { color: #9ca3af; }
html.light .nav-toggle:hover { color: #374151; background: rgba(0,0,0,0.05); }

/* ─── Steps ─── */
.nav-steps {
  display: flex;
  flex-direction: column;
  padding: 0 10px 0 10px;
}
.nav-step {
  display: flex;
  align-items: stretch;
  gap: 8px;
  cursor: pointer;
  border-radius: 6px;
  padding: 3px 6px 3px 0;
  transition: background 0.2s ease;
  user-select: none;
}
.nav-step:hover { background: rgba(255,255,255,0.04); }
html.light .nav-step:hover { background: rgba(99,102,241,0.05); }

/* connector column */
.step-connector-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 20px;
  flex-shrink: 0;
}
.step-line {
  width: 2px;
  flex: 1;
  min-height: 6px;
  background: rgba(255,255,255,0.1);
  border-radius: 1px;
  transition: background 0.3s;
}
html.light .step-line { background: rgba(0,0,0,0.1); }
.step-line.filled { background: rgba(34, 197, 94, 0.5); }

/* dot */
.step-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  transition: all 0.25s;
  border: 2px solid transparent;
}
.dot-pending {
  background: rgba(39,39,42,0.6);
  border-color: rgba(63,63,70,0.4);
  color: #52525b;
}
html.light .dot-pending {
  background: rgba(229,231,235,0.6);
  border-color: rgba(156,163,175,0.3);
  color: #9ca3af;
}
.dot-partial {
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.45);
  color: #f59e0b;
}
.dot-generating {
  background: rgba(139, 92, 246, 0.15);
  border-color: rgba(139, 92, 246, 0.5);
  color: #a78bfa;
  box-shadow: 0 0 8px rgba(139, 92, 246, 0.2);
}
.dot-done {
  background: rgba(34, 197, 94, 0.12);
  border-color: rgba(34, 197, 94, 0.5);
  color: #22c55e;
  box-shadow: 0 0 6px rgba(34, 197, 94, 0.15);
}
.dot-icon { font-size: 13px; }
.dot-num { font-size: 11px; line-height: 1; }

/* step body */
.step-body {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  padding: 3px 0;
  min-width: 0;
}
.step-label {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: #71717a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.2s ease;
}
html.light .step-label { color: #6b7280; }
.nav-step:hover .step-label { color: #d4d4d8; }
html.light .nav-step:hover .step-label { color: #1e1b4b; }
.status-done .step-label { color: #6ee7b7; }
html.light .status-done .step-label { color: #059669; }
.status-generating .step-label { color: #c4b5fd; }
html.light .status-generating .step-label { color: #7c3aed; }
.status-partial .step-label { color: #fbbf24; }
html.light .status-partial .step-label { color: #d97706; }

.step-count {
  font-size: 10px;
  color: #52525b;
  background: rgba(255,255,255,0.04);
  border-radius: 10px;
  padding: 1px 5px;
  flex-shrink: 0;
  font-weight: 500;
}
html.light .step-count { background: rgba(0,0,0,0.04); color: #9ca3af; }

.step-badge {
  display: flex;
  align-items: center;
  font-size: 11px;
  flex-shrink: 0;
}
.partial-badge { color: #f59e0b; }
.gen-badge { color: #a78bfa; }

/* spin animation */
@keyframes navSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.spin { animation: navSpin 1s linear infinite; display: inline-flex; }

/* sub-toggle & sub-list */
.nav-group { margin-top: 4px; }
.nav-sub-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  font-size: 12px;
  color: #5a5a66;
  cursor: pointer;
  transition: color 0.15s;
  border-top: 1px solid rgba(255,255,255,0.04);
}
html.light .nav-sub-toggle { border-top-color: rgba(0,0,0,0.07); color: #9ca3af; }
.nav-sub-toggle:hover { color: #e4e4e7; }
html.light .nav-sub-toggle:hover { color: #374151; }
.nav-sub-list {
  background: rgba(0,0,0,0.15);
  padding: 4px 0;
  border-radius: 0 0 6px 6px;
}
html.light .nav-sub-list { background: rgba(99,102,241,0.03); }
.nav-sub-item {
  padding: 4px 10px 4px 26px;
  font-size: 11.5px;
  color: #52525b;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.15s, background 0.15s;
  border-radius: 4px;
  margin: 0 4px;
}
html.light .nav-sub-item { color: #9ca3af; }
.nav-sub-item:hover { color: #d4d4d8; background: rgba(255,255,255,0.04); }
html.light .nav-sub-item:hover { color: #1e1b4b; background: rgba(99,102,241,0.06); }

.main {
  margin-left: 180px;
  margin-right: 0;
  padding: 24px 32px 48px;
  transition: margin-left 0.25s cubic-bezier(.4,0,.2,1);
}
.sidebar-collapsed .main {
  margin-left: 48px;
}
.section {
  margin-bottom: 24px;
}
.card {
  background: #1e1f28;
  border-radius: 14px;
  padding: 22px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  transition: border-color 0.3s ease, box-shadow 0.3s ease, transform 0.3s ease;
}
.card:hover {
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 6px 28px rgba(0, 0, 0, 0.25);
}
html.light .card {
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(16px) saturate(1.3);
  -webkit-backdrop-filter: blur(16px) saturate(1.3);
  border-color: rgba(139, 92, 246, 0.08);
  box-shadow: 0 1px 0 rgba(255,255,255,0.8) inset, 0 4px 20px rgba(99, 102, 241, 0.05);
}
html.light .card:hover {
  border-color: rgba(139, 92, 246, 0.18);
  box-shadow: 0 1px 0 rgba(255,255,255,0.8) inset, 0 8px 36px rgba(99, 102, 241, 0.08);
}
.section-title {
  font-size: 1.05rem;
  margin: 0 0 4px;
  color: #f4f4f5;
  font-weight: 600;
  letter-spacing: -0.01em;
}
html.light .section-title { color: #1e1b4b; }
.pipeline-section {
  padding: 12px 16px !important;
}
.one-click-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.one-click-label {
  font-size: 14px;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  font-weight: 600;
}
.pipeline-status {
  margin-top: 12px;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  font-size: 13px;
}
.pipeline-current-step {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  color: var(--el-text-color-primary);
  font-weight: 500;
  font-size: 13px;
}
.pipeline-step-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  padding: 1px 7px;
  border-radius: 10px;
  background: var(--el-color-primary);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}
.pipeline-active-tasks {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.pipeline-task-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 10px 2px 6px;
  border-radius: 12px;
  background: rgba(64, 158, 255, 0.12);
  border: 1px solid rgba(64, 158, 255, 0.3);
  color: var(--el-color-primary);
  font-size: 12px;
  white-space: nowrap;
}
.pipeline-task-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--el-color-primary);
  flex-shrink: 0;
  animation: pipeline-dot-pulse 1.2s ease-in-out infinite;
}
@keyframes pipeline-dot-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.75); }
}
.pipeline-error-log {
  margin-top: 0;
  padding: 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  font-size: 13px;
  color: #fca5a5;
  max-height: 200px;
  overflow-y: auto;
}
.pipeline-status .pipeline-error-log {
  margin-top: 8px;
}
.pipeline-error-title {
  font-weight: 600;
  margin-bottom: 8px;
}
.pipeline-error-line {
  margin-bottom: 4px;
  word-break: break-all;
}
/* 阶段间倒计时 */
.pipeline-countdown {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin: 10px 0 8px;
  padding: 12px 14px;
  background: rgba(103, 194, 58, 0.08);
  border: 1px solid rgba(103, 194, 58, 0.35);
  border-radius: 10px;
}
.pipeline-countdown-ring {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 54px;
  height: 54px;
  border-radius: 50%;
  background: rgba(103, 194, 58, 0.15);
  border: 2px solid rgba(103, 194, 58, 0.6);
  flex-shrink: 0;
}
.pipeline-countdown-num {
  font-size: 22px;
  font-weight: 700;
  color: var(--el-color-success);
  line-height: 1;
}
.pipeline-countdown-unit {
  font-size: 11px;
  color: var(--el-color-success);
  opacity: 0.8;
}
.pipeline-countdown-body {
  flex: 1;
  min-width: 0;
}
.pipeline-countdown-msg {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--el-text-color-primary);
  line-height: 1.5;
}
.pipeline-countdown-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.pipeline-countdown-paused {
  font-size: 12px;
  color: var(--el-color-warning);
}
/* 批量生成分镜图/视频 */
.sb-batch-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}
.sb-batch-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.batch-status {
  margin-top: 12px;
  padding: 12px 16px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.batch-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-primary);
  font-weight: 500;
}
.batch-failed {
  color: var(--el-color-danger);
  font-size: 12px;
}
.batch-stopping {
  color: var(--el-color-warning);
  font-size: 12px;
}
.batch-error-log {
  padding: 10px 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  font-size: 13px;
  color: #fca5a5;
  max-height: 160px;
  overflow-y: auto;
}
.batch-error-title {
  font-weight: 600;
  margin-bottom: 6px;
  color: #f87171;
}
.batch-error-line {
  margin-bottom: 3px;
  word-break: break-all;
}
/* 角色/场景/道具 → 影响的分镜 */
.asset-storyboard-link {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
  padding: 6px 8px;
  background: rgba(99, 102, 241, 0.07);
  border: 1px solid rgba(99, 102, 241, 0.18);
  border-radius: 6px;
  min-height: 28px;
}
.asl-label {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}
.asl-chip {
  display: inline-flex;
  align-items: center;
  padding: 1px 7px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.35);
  color: #a5b4fc;
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;
  white-space: nowrap;
}
.asl-chip:hover {
  background: rgba(99, 102, 241, 0.28);
  box-shadow: 0 0 6px rgba(99, 102, 241, 0.4);
  color: #c7d2fe;
}
.asl-regen-btn {
  margin-left: auto !important;
  flex-shrink: 0;
  height: 22px !important;
  padding: 0 10px !important;
  font-size: 11px !important;
  font-weight: 500 !important;
  background: rgba(251, 146, 60, 0.15) !important;
  border: 1px solid rgba(251, 146, 60, 0.5) !important;
  color: #fb923c !important;
  border-radius: 11px !important;
  transition: background 0.15s, box-shadow 0.15s !important;
}
.asl-regen-btn:not(.is-loading):hover {
  background: rgba(251, 146, 60, 0.28) !important;
  box-shadow: 0 0 6px rgba(251, 146, 60, 0.35) !important;
  color: #fdba74 !important;
}
.asl-progress {
  font-size: 11px;
  color: #fb923c;
  margin-left: 4px;
  flex-shrink: 0;
}
/* 参考图上传区（添加角色/道具/场景弹窗顶部） */
.ref-image-zone {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.ref-image-box {
  width: 120px;
  height: 120px;
  border: 2px dashed #c0c4cc;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  background: #fafafa;
  flex-shrink: 0;
  transition: border-color 0.2s;
}
.ref-image-box:hover {
  border-color: #409eff;
}
.ref-preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.ref-upload-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: #909399;
  font-size: 12px;
  text-align: center;
  padding: 8px;
}
.ref-upload-icon {
  font-size: 28px;
  line-height: 1;
}
.ref-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 资源管理大面板 + 可折叠标题 */
.resource-panel {
  padding: 0;
  overflow: hidden;
}
.collapse-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}
.collapse-header:hover {
  background: rgba(255, 255, 255, 0.04);
}
.resource-panel .collapse-header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.resource-panel .collapse-header .section-title {
  margin: 0;
}
.collapse-icon {
  font-size: 1.1rem;
  color: #a1a1aa;
  flex-shrink: 0;
  margin-left: 8px;
}
.resource-panel-body {
  padding: 16px 20px 20px;
}
.resource-block {
  margin-bottom: 20px;
  padding: 0;
  overflow: hidden;
}
.resource-block:last-child {
  margin-bottom: 0;
}
.resource-block-header {
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.resource-block-header .collapse-icon {
  font-size: 1rem;
}
.resource-block-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  color: #e4e4e7;
}
html.light .resource-block-title {
  color: #18181b;
}
.resource-block-body {
  padding: 12px 14px 14px;
}
.resource-block-body .asset-actions {
  margin-bottom: 12px;
}
.resource-block-body .asset-list-two {
  gap: 16px;
}
.section-desc {
  color: #52525b;
  font-size: 0.82rem;
  margin: 0 0 14px;
  line-height: 1.5;
}
html.light .section-desc { color: #6b7280; }
.story-textarea {
  margin-bottom: 12px;
}
.row { display: flex; flex-wrap: wrap; align-items: center; }
.gap { gap: 12px; }
.asset-actions { margin-bottom: 12px; }
.asset-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}
.asset-list-two {
  grid-template-columns: repeat(auto-fill, minmax(460px, 1fr));
  gap: 20px;
}
.asset-item {
  background: #22232d;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.asset-item-left-right {
  flex-direction: row;
  align-items: stretch;
}
.asset-item-left-right .asset-info {
  flex: 1;
  min-width: 0;
  padding: 16px;
  display: flex;
  flex-direction: column;
}
.asset-item-left-right .asset-name {
  font-size: 1.05rem;
  margin-bottom: 8px;
}
.asset-item-left-right .asset-desc-full {
  flex: 1;
  font-size: 0.875rem;
  color: #a1a1aa;
  line-height: 1.5;
  margin-bottom: 12px;
  white-space: pre-wrap;
  word-break: break-word;
}
.asset-item-left-right .asset-cover-wrap {
  flex-shrink: 0;
  align-self: flex-start;
}
.asset-item-left-right .asset-cover {
  width: 200px;
  height: 200px;
}
.asset-item-left-right .asset-cover.asset-cover--clickable {
  cursor: pointer;
}
.asset-cover {
  width: 100%;
  aspect-ratio: 1;
  background: #2a2b36;
  position: relative;
  overflow: hidden;
}
.asset-item-left-right .asset-cover .cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cover-img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}
.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #5a5a66;
  font-size: 0.85rem;
}
.cover-placeholder.error {
  background: #450a0a;
  color: #f87171;
  font-size: 0.8rem;
  padding: 8px;
  line-height: 1.4;
  word-break: break-all;
  text-align: center;
}
.sb-image-error {
  width: 100%;
  flex: 1;
  background: #450a0a;
  color: #f87171;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  text-align: center;
  font-size: 0.85rem;
  overflow: hidden;
  margin-bottom: 8px;
}
.asset-cover--dragover {
  outline: 2px dashed var(--el-color-primary);
  outline-offset: -2px;
  background: rgba(64, 158, 255, 0.08);
}
.asset-cover-drop-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 0.9rem;
  pointer-events: none;
}
.image-preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(10, 10, 15, 0.88);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.image-preview-img {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  cursor: pointer;
  pointer-events: auto;
}
.asset-info { padding: 10px; }
.asset-name { font-weight: 600; margin-bottom: 4px; color: #e4e4e7; }
.asset-desc {
  font-size: 0.8rem;
  color: #a1a1aa;
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.asset-desc-full {
  font-size: 0.875rem;
  color: #a1a1aa;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.asset-btns { display: flex; gap: 6px; flex-wrap: wrap; margin-top: auto; }
.asset-item-left-right .asset-name {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}
.asset-item-left-right .asset-name span { flex: 1; min-width: 0; }
.btn-delete-icon { flex-shrink: 0; padding: 2px 4px !important; opacity: 0.45; transition: opacity 0.15s; }
.btn-delete-icon:hover { opacity: 1; }
/* 图片 + 操作按钮 竖向包裹 */
.asset-cover-wrap {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 200px;
}
.asset-cover-actions {
  display: flex;
  gap: 6px;
  padding: 6px 8px;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.asset-cover-actions .el-button { flex: 1; justify-content: center; }
html.light .asset-cover-actions { border-top-color: rgba(139,92,246,0.1); }
/* 额外参考图缩略图条 */
.extra-images-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 5px 8px;
  background: rgba(0,0,0,0.15);
}
.extra-thumb {
  position: relative;
  width: 52px;
  height: 52px;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  border: 1.5px solid transparent;
  transition: border-color 0.15s;
}
.extra-thumb:hover { border-color: #a78bfa; }
.extra-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.extra-thumb-remove {
  position: absolute;
  top: 1px;
  right: 1px;
  width: 16px;
  height: 16px;
  background: rgba(239,68,68,0.85);
  color: #fff;
  border: none;
  border-radius: 50%;
  font-size: 11px;
  line-height: 16px;
  text-align: center;
  cursor: pointer;
  padding: 0;
  opacity: 0;
  transition: opacity 0.15s;
}
.thumb-preview-btn {
  position: absolute;
  top: 1px;
  left: 1px;
  width: 16px;
  height: 16px;
  background: rgba(59,130,246,0.85);
  color: #fff;
  border: none;
  border-radius: 50%;
  font-size: 9px;
  line-height: 1;
  text-align: center;
  cursor: pointer;
  padding: 0;
  opacity: 0;
  transition: opacity 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.thumb-preview-btn .el-icon,
.thumb-preview-btn svg {
  width: 10px;
  height: 10px;
}
.extra-thumb:hover .extra-thumb-remove,
.extra-thumb:hover .thumb-preview-btn { opacity: 1; }
.sb-img-thumb:hover .extra-thumb-remove,
.sb-img-thumb:hover .thumb-preview-btn { opacity: 1; }
html.light .extra-images-strip { background: rgba(139,92,246,0.05); }
.empty-tip {
  color: #5a5a66;
  font-size: 0.9rem;
  padding: 16px 0;
}

/* 亮色模式：资源卡片 */
html.light .asset-item {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(139, 92, 246, 0.12);
  box-shadow: 0 2px 10px rgba(139, 92, 246, 0.06);
}
html.light .asset-item:hover {
  box-shadow: 0 6px 20px rgba(139, 92, 246, 0.12);
  border-color: rgba(139, 92, 246, 0.3);
  transform: translateY(-2px);
  transition: box-shadow 0.25s, transform 0.2s, border-color 0.25s;
}
html.light .asset-cover {
  background: #f3f4f6;
}
html.light .asset-name {
  color: #18181b;
}
html.light .asset-desc,
html.light .asset-desc-full,
html.light .asset-item-left-right .asset-desc-full {
  color: #6b7280;
}
html.light .cover-placeholder {
  color: #9ca3af;
  background: #f3f4f6;
}
html.light .cover-placeholder.error {
  background: #fef2f2;
  color: #dc2626;
}
html.light .empty-tip {
  color: #9ca3af;
}

/* 分镜：每行一个，三列布局 */
@keyframes sb-fade-in {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
/* ── 段落分隔标头 ─────────────────────────────── */
.segment-header {
  margin: 24px 0 14px;
  position: relative;
}
.segment-header:first-child { margin-top: 0; }
.segment-header-inner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  background: linear-gradient(90deg, rgba(139,92,246,0.12) 0%, transparent 80%);
  border-left: 3px solid rgba(139,92,246,0.6);
  border-radius: 0 10px 10px 0;
}
.segment-index-badge {
  font-size: 11px;
  font-weight: 600;
  color: #a78bfa;
  background: rgba(139,92,246,0.15);
  padding: 2px 8px;
  border-radius: 20px;
  letter-spacing: 0.3px;
  white-space: nowrap;
}
.segment-title-text {
  font-size: 14px;
  font-weight: 600;
  color: #d4d4d8;
  flex: 1;
  letter-spacing: -0.01em;
}
.segment-shot-range {
  font-size: 11px;
  color: #52525b;
  white-space: nowrap;
}
html.light .segment-header-inner {
  background: linear-gradient(90deg, rgba(139,92,246,0.07) 0%, transparent 80%);
  border-left-color: rgba(124,58,237,0.5);
}
html.light .segment-title-text { color: #1e1b4b; }
html.light .segment-index-badge { color: #7c3aed; background: rgba(124,58,237,0.08); }
html.light .segment-shot-range { color: #9ca3af; }

/* 左侧导航段落标签 */
.nav-segment-label {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px 2px;
  font-size: 10px;
  font-weight: 700;
  color: #a78bfa;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
.nav-segment-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #8b5cf6;
  flex-shrink: 0;
}

.storyboard-row {
  display: flex;
  align-items: flex-start;
  gap: 0;
  margin-bottom: 16px;
  background: #1e1f28;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  overflow: hidden;
  position: relative;
  transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease;
  animation: sb-fade-in 0.35s ease both;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
}
.storyboard-row:hover {
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 6px 28px rgba(0, 0, 0, 0.25);
  transform: translateY(-1px);
}
html.light .storyboard-row {
  background: rgba(255, 255, 255, 0.7);
  border-color: rgba(139, 92, 246, 0.06);
  box-shadow: 0 1px 0 rgba(255,255,255,0.7) inset, 0 2px 12px rgba(99, 102, 241, 0.04);
}
html.light .storyboard-row:hover {
  border-color: rgba(139, 92, 246, 0.18);
  box-shadow: 0 1px 0 rgba(255,255,255,0.7) inset, 0 6px 24px rgba(99, 102, 241, 0.08);
  transform: translateY(-1px);
}
.storyboard-row:last-child { margin-bottom: 0; }
/* ── 分镜控制栏（卡片外，缩进） ── */
.sb-ctrl-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 32px;
  margin-bottom: 4px;
  height: 26px;
}
.sb-ctrl-num {
  background: var(--el-color-primary);
  color: #fff;
  border-radius: 5px;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}
.sb-ctrl-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: #e4e4e7;
  max-width: 12em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
html.light .sb-ctrl-title {
  color: #000;
}
.sb-movement-tag.el-tag {
  height: 18px;
  line-height: 18px;
  padding: 0 6px;
  font-size: 11px;
  margin-left: 6px;
  flex-shrink: 0;
}
.sb-ctrl-btn.el-button {
  height: 22px;
  padding: 0 8px;
  font-size: 11px;
}
.sb-ctrl-config-btn.el-button {
  border-color: rgba(139,92,246,0.45);
  color: #a78bfa;
  background: rgba(139,92,246,0.08);
}
.sb-ctrl-config-btn.el-button:hover {
  border-color: #8b5cf6;
  color: #fff;
  background: rgba(139,92,246,0.6);
}
html.light .sb-ctrl-config-btn.el-button {
  border-color: rgba(124,58,237,0.35);
  color: #7c3aed;
  background: rgba(124,58,237,0.06);
}
html.light .sb-ctrl-config-btn.el-button:hover {
  border-color: #7c3aed;
  color: #fff;
  background: #7c3aed;
}
.sb-ctrl-delete {
  margin-left: auto;
  opacity: 0.4;
  transition: opacity 0.2s;
  height: 22px;
  padding: 0 4px;
}
.sb-ctrl-bar:hover .sb-ctrl-delete {
  opacity: 1;
}
.sb-panel {
  flex: 1;
  min-width: 0;
  padding: 14px 16px;
  border-right: 1px solid rgba(255,255,255,0.05);
  display: flex;
  flex-direction: column;
}
html.light .sb-panel {
  border-right-color: rgba(139,92,246,0.08);
}
.sb-panel:last-child { border-right: none; }
.sb-panel-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
  font-weight: 600;
  color: #e4e4e7;
  margin-bottom: 10px;
}
.sb-panel-title .el-icon { font-size: 1rem; color: #a1a1aa; }
.sb-panel-title-name {
  margin-left: 4px;
  color: #a1a1aa;
  font-weight: 500;
  max-width: 12em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sb-script { padding-top: 10px; }
.sb-script-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}
.sb-select { flex: 1; min-width: 0; }
.sb-select-empty { font-size: 0.8rem; color: #71717a; padding: 8px; }
.sb-selected-thumbs {
  margin: 10px 0;
  padding: 8px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
.sb-thumb-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.sb-thumb-row:last-child { margin-bottom: 0; }
.sb-thumb-label {
  font-size: 0.8rem;
  color: #71717a;
  flex-shrink: 0;
  width: 36px;
}
.sb-thumb-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.sb-thumb-item {
  flex-shrink: 0;
  border-radius: 6px;
  overflow: hidden;
  background: #22232d;
}
.sb-thumb-item.sb-thumb-clickable {
  cursor: pointer;
}
.sb-thumb-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
}
.sb-thumb-add-char {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 1.5px dashed #52525b;
  background: transparent;
  color: #a1a1aa;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}
.sb-thumb-add-char:hover {
  color: #e4e4e7;
  border-color: #71717a;
  background: rgba(63, 63, 70, 0.5);
}
html.light .sb-thumb-add-char {
  border-color: #d4d4d8;
  color: #71717a;
}
html.light .sb-thumb-add-char:hover {
  color: #18181b;
  border-color: #a1a1aa;
  background: #f4f4f5;
}
.sb-thumb-prop,
.sb-thumb-scene {
  width: 36px;
  height: 36px;
}
.sb-script-row.sb-script-selects {
  gap: 6px;
}
.sb-script-row.sb-script-selects .sb-select {
  min-width: 0;
}
.sb-script-row.sb-script-selects .el-select { flex: 1; min-width: 0; }
.sb-thumb-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.sb-thumb-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: #7a7a88;
  background: #2a2b36;
}
.sb-script-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: #71717a;
  margin-bottom: 6px;
}
.sb-script-label .el-icon { font-size: 0.9rem; }
.sb-upload-icon { margin-left: auto; cursor: pointer; color: #a1a1aa; }
.sb-meta {
  font-size: 0.75rem;
  color: #71717a;
  display: flex;
  gap: 12px;
}
.sb-image-area {
  flex: 1;
  min-height: 200px;
  max-height: 320px;
  background: linear-gradient(145deg, #1a1b24 0%, #1e1f28 60%, #1c1d26 100%);
  border: 1px dashed rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  overflow: hidden;
  position: relative;
  transition: border-color 0.2s, background 0.2s;
}
.sb-image-area:hover {
  border-color: rgba(255, 255, 255, 0.15);
}
html.light .sb-image-area {
  background: linear-gradient(145deg, #f5f3ff 0%, #ede9fe 100%);
  border-color: rgba(124,58,237,0.2);
}
html.light .sb-image-area:hover {
  border-color: rgba(124,58,237,0.45);
}
.sb-image-area--dragover {
  outline: 2px dashed var(--el-color-primary);
  outline-offset: -2px;
  background: rgba(64, 158, 255, 0.1);
}
.sb-image-area-drop-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 0.9rem;
  border-radius: 8px;
  pointer-events: none;
}
.sb-generated-img {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 8px;
}
.sb-image-file-input { position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none; }
.sb-gen-btn { margin-top: 4px; }
.sb-image-area img.sb-generated-img { cursor: pointer; }
.sb-panel.sb-image.sb-image--universal {
  min-height: 300px;
  justify-content: flex-start;
}
.sb-universal-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
}
.sb-universal-label-left {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.sb-universal-hint-icon {
  cursor: help;
  color: #9ca3af;
  font-size: 16px;
  flex-shrink: 0;
}
.sb-universal-hint-icon:hover {
  color: #a78bfa;
}
.sb-universal-gen-btn {
  flex-shrink: 0;
}
.sb-universal-prompt-dd {
  flex-shrink: 0;
}
.sb-universal-dd-caret {
  margin-left: 2px;
  font-size: 12px;
  vertical-align: middle;
}
:global(.sb-universal-tooltip-popper.el-popper) {
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}
.sb-universal-tooltip {
  max-width: 360px;
  font-size: 12px;
  line-height: 1.55;
  padding: 10px 12px;
  border-radius: 8px;
  color: #f1f5f9;
  background: #0f172a;
  border: 1px solid rgba(248, 250, 252, 0.22);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}
.sb-universal-tooltip strong {
  font-weight: 600;
  color: #ffffff;
}
html.light .sb-universal-tooltip {
  color: #0f172a;
  background: #ffffff;
  border-color: #cbd5e1;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
}
html.light .sb-universal-tooltip strong {
  color: #020617;
}
.sb-universal-textarea {
  flex: 1;
  min-height: 0;
}
.sb-universal-textarea :deep(.el-textarea__inner) {
  min-height: 220px !important;
  font-size: 13px;
  line-height: 1.55;
}
.vp-mode-hint {
  font-size: 12px;
  color: #909399;
  line-height: 1.45;
  margin-top: 8px;
  max-width: 520px;
}
.sb-ctrl-mode-btn.el-button {
  border-color: rgba(34, 197, 94, 0.35);
  color: #86efac;
  background: rgba(34, 197, 94, 0.08);
}
.sb-ctrl-mode-btn.el-button:hover {
  border-color: #22c55e;
  color: #fff;
  background: rgba(34, 197, 94, 0.45);
}
html.light .sb-ctrl-mode-btn.el-button {
  border-color: rgba(22, 163, 74, 0.35);
  color: #15803d;
  background: rgba(22, 163, 74, 0.06);
}
html.light .sb-ctrl-mode-btn.el-button:hover {
  border-color: #16a34a;
  color: #fff;
  background: #16a34a;
}
/* 有四宫格或多图时，image-area 改为纵向滚动布局 */
.sb-image-area--first-last {
  min-height: 220px;
  max-height: none;
  padding: 8px;
  align-items: stretch;
  justify-content: flex-start;
}
.sb-fl-dual {
  display: flex;
  align-items: stretch;
  gap: 8px;
  width: 100%;
  flex: 1;
  min-height: 180px;
}
.sb-fl-slot {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sb-fl-slot-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: #a78bfa;
  text-align: center;
}
.sb-fl-slot-body {
  flex: 1;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  overflow: hidden;
}
.sb-fl-slot-body .sb-generated-img {
  max-height: 160px;
}
.sb-fl-empty {
  font-size: 0.75rem;
  color: #71717a;
}
.sb-fl-arrow {
  flex-shrink: 0;
  align-self: center;
  font-size: 1.25rem;
  color: #a78bfa;
  opacity: 0.85;
}
.sb-fl-slot-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  align-items: center;
}
.sb-fl-first-lock-opt {
  margin: 0 2px;
  height: auto;
}
.sb-fl-first-lock-opt :deep(.el-checkbox__label) {
  font-size: 12px;
  padding-left: 4px;
}
.sb-fl-slot-prompt {
  font-size: 0.68rem;
  line-height: 1.35;
  color: #9ca3af;
  max-height: 2.7em;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  padding: 0 4px;
  word-break: break-all;
}
.sb-image-area--has-quad {
  flex-direction: column;
  align-items: stretch;
  overflow-y: auto;
  max-height: 340px;
}
/* 普通多图缩略图条 */
.sb-imgs-strip {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 6px 8px 4px;
  overflow-x: auto;
  border-top: 1px solid var(--el-border-color-lighter);
  flex-shrink: 0;
}
.sb-strip-hint-icon {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  cursor: default;
  transition: color 0.15s;
}
.sb-strip-hint-icon:hover {
  color: var(--el-color-primary);
}
.sb-img-thumb {
  position: relative;
  cursor: pointer;
  border-radius: 4px;
  overflow: hidden;
  border: 2px solid transparent;
  transition: border-color 0.2s;
  flex-shrink: 0;
  width: 52px;
  height: 52px;
}
.sb-img-thumb:hover { border-color: var(--el-color-primary); }
.sb-img-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.sb-img-thumb-label {
  position: absolute;
  bottom: 1px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 10px;
  color: #fff;
  background: rgba(0,0,0,0.45);
  pointer-events: none;
}
/* 主图容器 */
.sb-main-image-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 80px;
}
/* 主图下方提示词预览 */
.sb-main-img-prompt {
  width: 100%;
  font-size: 10px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
  border-top: 1px solid var(--el-border-color-lighter);
  padding: 4px 6px;
  line-height: 1.4;
  max-height: 48px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  word-break: break-all;
  cursor: default;
}
/* 四宫格整图作为上方预览时稍微缩小 */
.sb-quad-preview { max-height: 160px; }
/* 四宫格拆分中占位 */
.quad-splitting-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding: 8px;
}
.sb-image-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-shrink: 0;
  padding-top: 6px;
}
.sb-video-area {
  flex: 1;
  min-height: 200px;
  background: linear-gradient(145deg, #1a1b24 0%, #1e1f28 60%, #1c1d26 100%);
  border: 1px dashed rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s;
}
html.light .sb-video-area {
  background: linear-gradient(145deg, #f5f3ff 0%, #ede9fe 100%);
  border-color: rgba(124,58,237,0.2);
}
.sb-video-placeholder {
  color: #71717a;
  font-size: 0.9rem;
  flex-direction: column;
  gap: 10px;
  text-align: center;
  padding: 16px;
}
html.light .sb-video-placeholder {
  color: #7c3aed;
}
.sb-video-generating-text {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #409eff;
  font-size: 0.85rem;
}
.sb-video-error {
  color: #f56c6c;
  font-size: 0.75rem;
  line-height: 1.4;
  word-break: break-word;
  max-height: 80px;
  overflow-y: auto;
  padding: 4px 8px;
  background: rgba(245, 108, 108, 0.08);
  border-radius: 4px;
  text-align: left;
  width: 100%;
}
.sb-video-player {
  width: 100%;
  max-height: 240px;
  border-radius: 8px;
}
.sb-video-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-shrink: 0;
  padding-top: 6px;
}
.sb-video-regenerating-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 0.82rem;
  color: #a78bfa;
}
.sb-videos-strip {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.sb-video-thumb {
  position: relative;
  width: 72px;
  height: 48px;
  border-radius: 5px;
  overflow: hidden;
  cursor: pointer;
  border: 1.5px solid transparent;
  flex-shrink: 0;
  transition: border-color 0.15s;
}
.sb-video-thumb:hover {
  border-color: #a855f7;
}
.sb-video-thumb-player {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  pointer-events: none;
}
.sb-video-thumb-label {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0,0,0,0.55);
  color: #e4e4e7;
  font-size: 0.65rem;
  text-align: center;
  padding: 1px 0;
  pointer-events: none;
}
.sb-video-prompt-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.sb-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #a855f7;
  flex-shrink: 0;
}
.sb-video-prompt-label > span:not(.sb-dot) { font-size: 0.85rem; color: #e4e4e7; }
.sb-video-params-bar {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 4px 0;
}
.sb-video-params-bar .sb-video-prompt-text {
  flex: 1;
  min-width: 0;
}
.sb-video-prompt-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 4px;
}
.sb-video-prompt-row .sb-video-prompt-text {
  flex: 1;
  min-width: 0;
}
.vp-dialog-form .el-form-item {
  margin-bottom: 12px;
}
.sb-video-prompt-text {
  font-size: 0.85rem;
  color: #a1a1aa;
  line-height: 1.5;
  padding: 8px 0;
}
.sb-video-prompt-text--preview {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
}
.sb-video-prompt-edit {
  margin-bottom: 8px;
}
.sb-video-prompt-edit .el-textarea { margin-bottom: 8px; }
.sb-video-prompt-edit-actions { display: flex; gap: 8px; }
.sb-generate-video-btn { margin-top: 8px; }
.sb-prompt-label { display: flex; align-items: center; gap: 8px; margin: 10px 0 6px; }
.sb-prompt-label .sb-dot { flex-shrink: 0; }
.sb-prompt-label > span:not(.sb-dot) { font-size: 0.85rem; color: #e4e4e7; }
.sb-prompt-row { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px; }
.sb-prompt-row .sb-prompt-text { flex: 1; min-width: 0; font-size: 0.85rem; color: #a1a1aa; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.sb-image-prompt-edit .el-textarea { margin-bottom: 6px; }
.sb-prompt-edit-actions { display: flex; gap: 8px; }
.sb-video-fields-collapse { margin: 8px 0; }
.sb-video-fields-collapse .el-collapse-item__header { font-size: 0.9rem; }
.sb-prompt-section-title { font-size: 0.9rem; font-weight: 600; color: #e4e4e7; margin-bottom: 8px; }
.sb-prompt-section-title--row { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.vp-video-prompt-hint { font-size: 12px; color: #909399; line-height: 1.5; }
.sb-split-audio-tip { font-size: 12px; color: #64748b; line-height: 1.45; margin: 0 0 8px; }
.sb-split-audio-row { display: flex; flex-direction: column; align-items: flex-start; }
.sb-prompt-dialog-form .el-form-item { margin-bottom: 10px; }
.sb-collapse-title { color: #a1a1aa; }
.sb-video-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; padding: 8px 0; }
.sb-field { display: flex; flex-direction: column; gap: 4px; }
.sb-field-full { grid-column: 1 / -1; }
.sb-field-label { font-size: 0.8rem; color: #a1a1aa; }
.sb-field-select { width: 100%; }
.sb-video-fields-actions { grid-column: 1 / -1; margin-top: 8px; }
.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px 24px;
  margin-bottom: 16px;
}
.video-option-hint {
  flex: 1;
  min-width: 200px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--el-text-color-secondary);
}
.video-option-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 10px 12px;
}
.video-watermark-input {
  flex: 1;
  min-width: 200px;
  max-width: 360px;
}
.config-tip {
  margin: 12px 0 0;
  font-size: 0.9rem;
  color: #a1a1aa;
}
.config-tip .el-link { font-size: inherit; }
.sb-truncated-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  margin-bottom: 14px;
  background: rgba(234, 179, 8, 0.12);
  border: 1px solid rgba(234, 179, 8, 0.4);
  border-radius: 8px;
  color: #fbbf24;
  font-size: 0.875rem;
  line-height: 1.5;
}
.sb-truncated-warning .el-icon {
  flex-shrink: 0;
  font-size: 1rem;
  color: #fbbf24;
}
.sb-truncated-warning span {
  flex: 1;
}
/* 分镜生成中提示条 */
.sb-generating-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 18px;
  margin-top: 10px;
  background: rgba(139, 92, 246, 0.08);
  border: 1px dashed rgba(139, 92, 246, 0.35);
  border-radius: 10px;
  color: #a78bfa;
  font-size: 0.9rem;
}
.sb-gen-text {
  flex: 1;
  letter-spacing: 0.03em;
}
.sb-gen-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #a78bfa;
  animation: sb-dot-bounce 1.2s infinite ease-in-out both;
}
.sb-gen-dot:nth-child(1) { animation-delay: 0s; }
.sb-gen-dot:nth-child(2) { animation-delay: 0.2s; }
.sb-gen-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes sb-dot-bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
  40%            { transform: scale(1);   opacity: 1;   }
}
.sb-config-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.sb-config-item {
  display: flex;
  align-items: center;
  gap: 6px;
}
.sb-config-label {
  font-size: 0.85rem;
  color: #a1a1aa;
  white-space: nowrap;
}
.sb-config-input {
  width: 110px;
}
.sb-config-hint {
  font-size: 0.78rem;
  color: #52525b;
  white-space: nowrap;
}
.sb-config-hint--estimate {
  white-space: normal;
  max-width: 220px;
  line-height: 1.35;
}
.sb-config-divider {
  color: #3a3a44;
  font-size: 0.85rem;
  margin: 0 4px;
}
/* 解说导出行：避免浅色主题下勾选文案与卡片背景对比度不足 */
.sb-narration-export-row :deep(.el-checkbox__label) {
  color: #e4e4e7;
  font-size: 0.875rem;
  line-height: 1.45;
}
html.light .sb-narration-export-row :deep(.el-checkbox__label) {
  color: #374151;
}
.sb-export-srt-btn.el-button--primary.is-plain {
  --el-button-bg-color: rgba(124, 58, 237, 0.75);
  --el-button-border-color: #a78bfa;
  --el-button-text-color: #fff;
  --el-button-hover-text-color: #fff;
  --el-button-hover-bg-color: #8b5cf6;
  --el-button-hover-border-color: #c4b5fd;
}
html.light .sb-export-srt-btn.el-button--primary.is-plain {
  --el-button-bg-color: #7c3aed;
  --el-button-border-color: #6d28d9;
  --el-button-text-color: #fff;
  --el-button-hover-text-color: #fff;
  --el-button-hover-bg-color: #6d28d9;
  --el-button-hover-border-color: #5b21b6;
}
.sb-narration-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
/* 分镜内解说旁白输入框：强制字/底对比，避免主题变量与页面继承冲突导致「看不见字」 */
.sb-narration-input :deep(.el-textarea__inner) {
  color: #e4e4e7 !important;
  background-color: rgba(24, 24, 27, 0.85) !important;
  border-color: rgba(255, 255, 255, 0.12) !important;
  box-shadow: none;
}
.sb-narration-input :deep(.el-textarea__inner::placeholder) {
  color: #71717a !important;
}
html.light .sb-narration-input :deep(.el-textarea__inner) {
  color: #1e1b4b !important;
  background-color: #ffffff !important;
  border-color: rgba(139, 92, 246, 0.22) !important;
}
html.light .sb-narration-input :deep(.el-textarea__inner::placeholder) {
  color: #9ca3af !important;
}
.sub-title {
  font-size: 1rem;
  margin: 16px 0 8px;
  color: #e4e4e7;
}
.video-progress, .video-done, .video-error {
  margin-top: 16px;
}
.video-preview-wrap {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
.video-preview-label {
  margin: 0 0 10px;
  font-size: 0.95rem;
  color: #a1a1aa;
}
.video-preview-player {
  display: block;
  max-width: 100%;
  max-height: 360px;
  border-radius: 8px;
  background: #1a1b24;
}

/* 公共库弹窗 */
.library-dialog .el-dialog__body { padding-top: 8px; }
.sd2-cert-dialog .el-dialog__body { padding-top: 10px; }
.sd2-cert-desc :deep(.el-descriptions__cell) {
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.sd2-cert-value {
  display: inline-block;
  max-width: 100%;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
  line-height: 1.5;
}
.library-toolbar { margin-bottom: 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.library-team-hint { font-size: 12px; color: var(--el-text-color-secondary); }
.library-team-hint--warn { color: var(--el-color-warning); }
.char-library-tabs :deep(.el-tabs__header) { margin-bottom: 12px; }
.library-item-sub { font-size: 12px; color: var(--el-text-color-secondary); font-weight: normal; }
.library-list {
  min-height: 200px;
  max-height: 420px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.library-item {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 10px;
  background: #1e1f28;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
}
.library-item-cover {
  width: 72px;
  height: 72px;
  flex-shrink: 0;
  background: #252630;
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.library-item-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.library-item-placeholder {
  font-size: 0.8rem;
  color: #5a5a66;
}
.library-item-info { flex: 1; min-width: 0; }
.library-item-name { font-weight: 500; margin-bottom: 4px; }
.library-item-desc { font-size: 0.85rem; color: #7a7a88; margin-bottom: 8px; }
.library-item-actions { display: flex; gap: 8px; }
.library-empty {
  text-align: center;
  color: #5a5a66;
  padding: 40px 20px;
}
.library-pagination {
  margin-top: 12px;
  display: flex;
  justify-content: center;
}
.library-placeholder {
  padding: 40px 20px;
  text-align: center;
  color: #5a5a66;
}

/* 专业帧提示词弹窗 - 干净美观版 */
.sb-frame-prompt-clean .el-message-box__content {
  padding: 16px 20px 8px;
}
.sb-prompt-clean-body {
  max-width: 680px;
  min-width: 480px;
}
.sb-prompt-pre {
  margin: 0 0 12px 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 13px;
  line-height: 1.65;
  color: #e2e8f0;
  background: #0f172a;
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 8px;
  padding: 14px 16px;
  max-height: 420px;
  overflow-y: auto;
}
html.light .sb-prompt-pre {
  color: #1e2937;
  background: #f8fafc;
  border-color: #cbd5e1;
}
.sb-prompt-meta-line {
  font-size: 11px;
  color: #64748b;
  padding: 0 4px 8px;
  line-height: 1.4;
}
html.light .sb-prompt-meta-line {
  color: #64748b;
}

/* 首尾帧提示词编辑器 */
.frame-prompt-editor-body {
  padding: 4px 0;
}
.frame-prompt-editor-hint {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 10px;
  line-height: 1.5;
}
html.light .frame-prompt-editor-hint {
  color: #475569;
}
.frame-prompt-editor-textarea :deep(.el-textarea__inner) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 13px;
  line-height: 1.65;
}

/* 空间布局锚点展示（首尾帧一致性合同） */
.frame-layout-anchor {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 10px;
}
html.light .frame-layout-anchor {
  background: #f1f5f9;
  border-color: #cbd5e1;
}
.frame-layout-anchor-label {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 4px;
}
.frame-layout-anchor-text {
  font-size: 12.5px;
  line-height: 1.5;
  color: #1e293b;
  background: #fff;
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
  white-space: pre-wrap;
  word-break: break-word;
}
.frame-layout-anchor-note {
  font-size: 11px;
  color: #64748b;
  margin-top: 4px;
  line-height: 1.4;
}
</style>
