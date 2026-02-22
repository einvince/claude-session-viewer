<template>
  <div class="app">
    <div class="sidebar">
      <div class="sidebar-header">
        <input
          v-model="searchTerm"
          type="text"
          class="search-box"
          placeholder="搜索会话名称..."
          @input="contentSearchResults = null"
        >
        <div class="content-search">
          <input
            v-model="contentSearchTerm"
            type="text"
            class="search-box"
            placeholder="搜索会话内容..."
            @keyup.enter="searchContent"
          >
          <button class="search-btn" @click="searchContent" :disabled="contentSearching">
            {{ contentSearching ? '搜索中...' : '搜索' }}
          </button>
        </div>
      </div>
      <div class="session-list">
        <div class="list-header">
          <span>{{ showArchived ? '已归档' : '活跃' }}</span>
          <button class="toggle-btn" @click="showArchived = !showArchived">
            {{ showArchived ? '显示活跃' : '显示归档' }}
          </button>
        </div>
        <div
          v-for="session in filteredSessions"
          :key="session.id"
          :class="['session-item', { active: currentSession?.id === session.id }]"
          @click="selectSession(session.id)"
        >
          <div class="session-name">{{ getSessionName(session.id) }}</div>
          <div v-if="session.snippet" class="session-snippet">{{ session.snippet }}</div>
          <div class="session-time">{{ formatDate(session.modified) }}</div>
        </div>
      </div>
    </div>

    <div class="main-content">
      <div class="toolbar">
        <div class="toolbar-left">
          <button class="btn primary" @click="exportMarkdown" :disabled="!currentSession">
            导出为 Markdown
          </button>
          <button class="btn" @click="loadSessions">刷新</button>
        </div>
        <div class="toolbar-right" v-if="currentSession">
          <span class="session-info">{{ getSessionName(currentSession.id) }}</span>
          <button class="btn" @click="showRenameDialog">重命名</button>
          <button class="btn" @click="toggleArchive">{{ isArchived ? '取消归档' : '归档' }}</button>
        </div>
      </div>

      <div class="tabs">
        <div
          v-for="view in ['chat', 'timeline']"
          :key="view"
          :class="['tab', { active: currentView === view }]"
          @click="currentView = view"
        >
          {{ view === 'chat' ? '对话视图' : '时间线' }}
        </div>
      </div>

      <div class="content-area">
        <div v-if="!currentSession" class="empty-state">
          选择一个会话开始
        </div>

        <template v-else-if="currentView === 'chat'">
          <div
            v-for="(msg, idx) in currentSession.messages"
            :key="idx"
            :class="['message', msg.role]"
          >
            <div class="message-role">{{ msg.role }}</div>
            <div class="message-content">{{ msg.content }}</div>
          </div>
        </template>

        <template v-else>
          <div
            v-for="(msg, idx) in currentSession.messages"
            :key="idx"
            class="timeline-item"
          >
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <div class="timeline-time">{{ msg.timestamp || 'N/A' }}</div>
              <div class="timeline-message">
                <strong>{{ msg.role }}</strong>: {{ msg.content.substring(0, 100) }}...
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <div v-if="showRename" class="modal-overlay" @click="showRename = false">
      <div class="modal" @click.stop>
        <h3>重命名会话</h3>
        <input v-model="renameInput" type="text" class="rename-input" placeholder="输入新名称">
        <div class="modal-buttons">
          <button class="btn" @click="showRename = false">取消</button>
          <button class="btn primary" @click="saveRename">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const formatDate = (date) => {
  return new Date(date).toLocaleString('zh-CN')
}

const sessions = ref([])
const currentSession = ref(null)
const searchTerm = ref('')
const currentView = ref('chat')
const sessionNames = ref({})
const archived = ref([])
const showArchived = ref(false)
const showRename = ref(false)
const renameInput = ref('')
const contentSearchTerm = ref('')
const contentSearchResults = ref(null)
const contentSearching = ref(false)

const API_BASE = window.location.origin

const isArchived = computed(() => {
  return currentSession.value && archived.value.includes(currentSession.value.id)
})

const filteredSessions = computed(() => {
  // 如果有内容搜索结果，优先显示
  if (contentSearchResults.value) {
    const resultIds = new Set(contentSearchResults.value.map(r => r.id))
    const snippetMap = Object.fromEntries(contentSearchResults.value.map(r => [r.id, r.snippet]))
    return sessions.value
      .filter(s => resultIds.has(s.id))
      .map(s => ({ ...s, snippet: snippetMap[s.id] }))
  }

  const filtered = sessions.value.filter(s => {
    const isArch = archived.value.includes(s.id)
    return showArchived.value ? isArch : !isArch
  })
  if (!searchTerm.value) return filtered
  return filtered.filter(s =>
    (sessionNames.value[s.id] || s.name).toLowerCase().includes(searchTerm.value.toLowerCase())
  )
})

const getSessionName = (id) => {
  const alias = sessionNames.value[id]
  if (alias) return `${alias} (${id.substring(0, 8)})`
  return id.substring(0, 8)
}

const loadSessionNames = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/session-names`)
    sessionNames.value = await response.json()
  } catch (error) {
    console.error('Failed to load session names:', error)
  }
}

const loadArchived = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/archived`)
    archived.value = await response.json()
  } catch (error) {
    console.error('Failed to load archived:', error)
  }
}

const loadSessions = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/sessions`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    sessions.value = data
    await loadSessionNames()
    await loadArchived()
  } catch (error) {
    console.error('Failed to load sessions:', error)
    alert('加载会话失败: ' + error.message)
  }
}

const toggleArchive = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/archived/${currentSession.value.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archive: !isArchived.value })
    })
    if (!response.ok) throw new Error('Failed to save')
    await loadArchived()
  } catch (error) {
    alert('操作失败: ' + error.message)
  }
}

const selectSession = async (id) => {
  try {
    const response = await fetch(`${API_BASE}/api/sessions/${id}`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    currentSession.value = data
  } catch (error) {
    console.error('Failed to load session:', error)
    alert('加载会话失败: ' + error.message)
  }
}

const showRenameDialog = () => {
  renameInput.value = sessionNames.value[currentSession.value.id] || ''
  showRename.value = true
}

const saveRename = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/session-names/${currentSession.value.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: renameInput.value })
    })
    if (!response.ok) throw new Error('Failed to save')
    sessionNames.value[currentSession.value.id] = renameInput.value
    showRename.value = false
  } catch (error) {
    alert('保存失败: ' + error.message)
  }
}

const searchContent = async () => {
  if (!contentSearchTerm.value.trim()) {
    contentSearchResults.value = null
    return
  }
  contentSearching.value = true
  try {
    const response = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(contentSearchTerm.value)}`)
    contentSearchResults.value = await response.json()
  } catch (error) {
    console.error('Content search failed:', error)
    alert('搜索失败: ' + error.message)
  } finally {
    contentSearching.value = false
  }
}

const exportMarkdown = () => {
  if (!currentSession.value) return
  let md = `# ${getSessionName(currentSession.value.id)}\n\n`
  currentSession.value.messages.forEach(msg => {
    md += `## ${msg.role}\n\n${msg.content}\n\n`
  })
  const blob = new Blob([md], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${getSessionName(currentSession.value.id)}.md`
  a.click()
}

onMounted(() => {
  loadSessions()
})
</script>

<style scoped>
.app {
  display: flex;
  height: 100vh;
}

.sidebar {
  width: 300px;
  background: white;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
}

.search-box {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

.content-search {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.content-search .search-box {
  flex: 1;
}

.search-btn {
  padding: 8px 12px;
  border: 1px solid #2196f3;
  background: #2196f3;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
}

.search-btn:hover:not(:disabled) {
  background: #1976d2;
}

.search-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.session-snippet {
  font-size: 12px;
  color: #888;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-list {
  flex: 1;
  overflow-y: auto;
}

.list-header {
  padding: 12px 16px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  color: #666;
}

.toggle-btn {
  padding: 4px 8px;
  font-size: 11px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 3px;
  cursor: pointer;
}

.session-item {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background 0.2s;
}

.session-item:hover {
  background: #f9f9f9;
}

.session-item.active {
  background: #e3f2fd;
  border-left: 3px solid #2196f3;
}

.session-name {
  font-weight: 500;
  font-size: 14px;
  margin-bottom: 4px;
}

.session-time {
  font-size: 12px;
  color: #999;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
}

.toolbar {
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toolbar-left {
  display: flex;
  gap: 8px;
}

.toolbar-right {
  display: flex;
  gap: 12px;
  align-items: center;
}

.session-info {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn:hover:not(:disabled) {
  background: #f5f5f5;
  border-color: #999;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn.primary {
  background: #2196f3;
  color: white;
  border-color: #2196f3;
}

.btn.primary:hover:not(:disabled) {
  background: #1976d2;
}

.tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid #e0e0e0;
  padding: 0 16px;
}

.tab {
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  font-size: 14px;
  transition: all 0.2s;
}

.tab:hover {
  color: #2196f3;
}

.tab.active {
  color: #2196f3;
  border-bottom-color: #2196f3;
}

.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
  font-size: 16px;
}

.message {
  margin-bottom: 16px;
  padding: 12px;
  border-radius: 4px;
  line-height: 1.6;
}

.message.user {
  background: #e3f2fd;
  margin-left: 40px;
}

.message.assistant {
  background: #f5f5f5;
  margin-right: 40px;
}

.message-role {
  font-weight: 600;
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
  text-transform: uppercase;
}

.message-content {
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
}

.timeline-item {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
}

.timeline-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #2196f3;
  margin-top: 4px;
  flex-shrink: 0;
}

.timeline-content {
  flex: 1;
}

.timeline-time {
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
}

.timeline-message {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 4px;
  font-size: 14px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  padding: 24px;
  border-radius: 8px;
  min-width: 300px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.modal h3 {
  margin-bottom: 16px;
  font-size: 16px;
}

.rename-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  margin-bottom: 16px;
}

.modal-buttons {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
