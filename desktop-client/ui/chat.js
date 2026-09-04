const chatStream = document.querySelector('#chat-stream')
const welcomeBox = document.querySelector('#welcome-box')
const messagesList = document.querySelector('#messages-list')
const chatInput = document.querySelector('#chat-input')
const btnSend = document.querySelector('#btn-send')
const currentModelName = document.querySelector('#current-model-name')
const btnClearChat = document.querySelector('#btn-clear-chat')

const winMin = document.querySelector('#chat-win-min')
const winMax = document.querySelector('#chat-win-max')
const winClose = document.querySelector('#chat-win-close')

if (winMin) winMin.addEventListener('click', () => window.chatWindow?.minimize())
if (winMax) winMax.addEventListener('click', () => window.chatWindow?.maximize())
if (winClose) winClose.addEventListener('click', () => window.chatWindow?.close())

let toolConfig = null
let currentAccount = null
let isGenerating = false
const messagesHistory = []

const KIMI_SVG = `
  <svg viewBox="0 0 24 25" fill="currentColor">
    <path d="M21.7202 0.939941C22.9502 0.939941 23.9502 1.93994 23.9502 3.16994C23.9502 4.39994 22.9502 5.39994 21.7202 5.39994H19.7502C19.6002 5.39994 19.4902 5.27994 19.4902 5.13994V3.16994C19.4902 1.93994 20.4902 0.939941 21.7202 0.939941Z" fill="#1783FF"></path>
    <path d="M9.39 13.9501L17.82 5.59012C17.98 5.43012 17.89 5.12012 17.68 5.12012H13.14C13.14 5.12012 13.04 5.14012 13 5.18012L3.92 14.1901C3.78 14.3301 3.57 14.2101 3.57 13.9801V5.39012C3.57 5.24012 3.47 5.12012 3.35 5.12012H0.219999C0.0999993 5.12012 0 5.24012 0 5.39012V23.9201C0 24.0701 0.0999993 24.1901 0.219999 24.1901H3.35C3.47 24.1901 3.57 24.0701 3.57 23.9201V20.1401C3.57 20.0601 3.6 19.9801 3.65 19.9301L6.47 17.1401C6.54 17.0701 6.63 17.0601 6.71 17.1101L14.24 22.6501C15.47 23.4801 16.85 23.9901 18.25 24.1401C18.37 24.1501 18.48 24.0301 18.48 23.8701V20.3101C18.48 20.1701 18.4 20.0601 18.29 20.0501C17.47 19.9201 16.66 19.6001 15.94 19.1101L9.42 14.3901C9.28 14.3001 9.27 14.0701 9.39 13.9501Z" fill="#1783FF"></path>
  </svg>
`

function scrollToBottom() {
  chatStream.scrollTop = chatStream.scrollHeight
}

function renderMessage(role, content) {
  welcomeBox.classList.add('hidden')

  const row = document.createElement('div')
  row.className = `chat-message-row ${role}`

  if (role === 'ai') {
    row.innerHTML = `
      <div class="msg-avatar ai">
        ${KIMI_SVG}
      </div>
      <div class="msg-bubble">
        <span class="bubble-content">${escapeHtml(content)}</span>
      </div>
    `
  } else {
    const userLetter = (currentAccount?.username || 'U').slice(0, 1).toUpperCase()
    row.innerHTML = `
      <div class="msg-bubble">
        <span class="bubble-content">${escapeHtml(content)}</span>
      </div>
      <div class="msg-avatar user">
        ${userLetter}
      </div>
    `
  }

  messagesList.append(row)
  scrollToBottom()
  return row
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML.replace(/\n/g, '<br>')
}

async function handleSend() {
  const text = chatInput.value.trim()
  if (!text || isGenerating) return

  chatInput.value = ''
  chatInput.style.height = 'auto'
  isGenerating = true
  btnSend.disabled = true

  // 渲染用户输入
  renderMessage('user', text)
  messagesHistory.push({ role: 'user', content: text })

  // 创建 AI 回复气泡
  const aiRow = renderMessage('ai', '')
  const contentSpan = aiRow.querySelector('.bubble-content')
  contentSpan.innerHTML = '<span class="typing-cursor"></span>'

  const endpoint = `${toolConfig?.apiBaseUrl || 'http://127.0.0.1:3000/v1'}/chat/completions`
  const apiKey = toolConfig?.apiKey || ''
  const model = toolConfig?.model || 'moonshot-v1-8k'

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: messagesHistory,
        stream: true,
      }),
    })

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}))
      const errMsg = errJson?.error?.message || `请求失败 (${response.status})`
      contentSpan.innerHTML = `<span style="color:#ef4444;">${escapeHtml(errMsg)}</span>`
      isGenerating = false
      btnSend.disabled = false
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let accumulatedText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.slice(6)
          if (dataStr === '[DONE]') continue
          try {
            const parsed = JSON.parse(dataStr)
            const delta = parsed?.choices?.[0]?.delta?.content || ''
            accumulatedText += delta
            contentSpan.innerHTML = escapeHtml(accumulatedText) + '<span class="typing-cursor"></span>'
            scrollToBottom()
          } catch {
            // best effort
          }
        }
      }
    }

    // 完成输出
    contentSpan.innerHTML = escapeHtml(accumulatedText)
    messagesHistory.push({ role: 'assistant', content: accumulatedText })
  } catch (err) {
    contentSpan.innerHTML = `<span style="color:#ef4444;">连接服务失败: ${escapeHtml(err.message || '网络错误')}</span>`
  } finally {
    isGenerating = false
    btnSend.disabled = false
    scrollToBottom()
  }
}

// 快捷点击卡片发送
document.querySelectorAll('.prompt-quick-card').forEach((card) => {
  card.addEventListener('click', () => {
    chatInput.value = card.dataset.prompt
    handleSend()
  })
})

btnSend.addEventListener('click', handleSend)

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
})

chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto'
  chatInput.style.height = `${Math.min(chatInput.scrollHeight, 120)}px`
})

btnClearChat.addEventListener('click', () => {
  messagesHistory.length = 0
  messagesList.replaceChildren()
  welcomeBox.classList.remove('hidden')
})

// 初始化获取配置
async function init() {
  const result = await window.chatContext?.getConfig()
  if (result?.success) {
    toolConfig = result.config
    currentAccount = result.account
    if (toolConfig?.model) {
      currentModelName.textContent = toolConfig.model
    }
  }
}

init()
