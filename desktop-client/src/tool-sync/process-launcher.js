const { spawn, execFileSync } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')

const SYSTEM_ROOT = process.env.SystemRoot || 'C:\\Windows'
const WHERE_EXE = path.join(SYSTEM_ROOT, 'System32', 'where.exe')
const CMD_EXE = path.join(SYSTEM_ROOT, 'System32', 'cmd.exe')
const POWERSHELL_EXE = path.join(SYSTEM_ROOT, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')

function findCommand(command) {
  try {
    const exe = fs.existsSync(WHERE_EXE) ? WHERE_EXE : 'where.exe'
    const result = execFileSync(exe, [command], { encoding: 'utf8', windowsHide: true })
    return result.split(/\r?\n/).map((item) => item.trim()).find(Boolean) || null
  } catch {
    return null
  }
}

function launchInTerminal(command, title) {
  const wt = findCommand('wt')
  const powershell = findCommand('powershell') || (fs.existsSync(POWERSHELL_EXE) ? POWERSHELL_EXE : null)
  const cmd = findCommand('cmd') || (fs.existsSync(CMD_EXE) ? CMD_EXE : null)

  // 1. 优先尝试 Windows Terminal (现代多标签，视觉效果最好)
  if (wt) {
    try {
      spawn(wt, ['--title', title, 'powershell.exe', '-NoExit', '-Command', command], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      }).unref()
      return { launched: true, message: `${title} 已在 Windows Terminal 中启动` }
    } catch {
      // 降级到下一个终端
    }
  }

  // 2. 其次尝试 PowerShell 窗口
  if (powershell) {
    try {
      spawn(powershell, ['-NoExit', '-Command', `& { [Console]::Title='${title}'; ${command} }`], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      }).unref()
      return { launched: true, message: `${title} 已在 PowerShell 中启动` }
    } catch {
      // 降级
    }
  }

  // 3. 兜底 CMD 窗口
  if (cmd) {
    try {
      spawn(cmd, ['/k', `title ${title} && ${command}`], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      }).unref()
      return { launched: true, message: `${title} 已在命令行终端中启动` }
    } catch {
      // 降级
    }
  }

  return { launched: false, message: '配置已写入，但未检测到可用终端' }
}

function launchChatGptDesktop() {
  if (process.platform === 'win32') {
    // 1. 优先通过 Windows Store / MSIX 统一应用标识符 (AUMID) 唤起
    // OpenAI Codex 桌面客户端: OpenAI.Codex_2p2nqsd0c76g0!App
    // OpenAI ChatGPT 桌面客户端: OpenAI.ChatGPT_2p2nqsd0c76g0!App
    const aumids = [
      'OpenAI.Codex_2p2nqsd0c76g0!App',
      'OpenAI.ChatGPT_2p2nqsd0c76g0!App',
    ]

    for (const aumid of aumids) {
      try {
        const child = spawn('explorer.exe', [`shell:AppsFolder\\${aumid}`], {
          detached: true,
          stdio: 'ignore',
        })
        child.unref()
        return { launched: true, message: '已唤起 ChatGPT 桌面客户端' }
      } catch {
        // 继续尝试下一个方式
      }
    }

    // 2. 尝试协议唤起 (codex:// 或 chatgpt://)
    try {
      const child = spawn('cmd.exe', ['/c', 'start', '', 'codex://'], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      })
      child.unref()
      return { launched: true, message: '已唤起 ChatGPT 客户端' }
    } catch {
      // 降级
    }

    // 3. 兜底检测是否安装了 codex 命令行终端
    const codex = findCommand('codex')
    if (codex) {
      return launchInTerminal('codex', 'Codex')
    }

    return {
      launched: false,
      message: '配置已写入本地环境，但未检测到 ChatGPT 桌面应用或 Codex，请先安装客户端',
    }
  }

  if (process.platform === 'darwin') {
    try {
      spawn('open', ['-a', 'ChatGPT'], { detached: true, stdio: 'ignore' }).unref()
      return { launched: true, message: '已唤起 ChatGPT 桌面客户端' }
    } catch {
      const codex = findCommand('codex')
      if (codex) return launchInTerminal('codex', 'Codex')
    }
  }

  return { launched: false, message: '当前平台暂不支持自动唤起 ChatGPT 客户端' }
}

function launchTool(toolId) {
  if (toolId === 'codex-gpt') {
    return launchChatGptDesktop()
  }

  if (toolId === 'claude-code') {
    const claude = findCommand('claude')
    if (!claude) {
      return { launched: false, message: '配置已写入，但未检测到 Claude Code CLI，请先安装' }
    }
    return launchInTerminal('claude', 'Claude Code')
  }

  return { launched: false, message: '暂不支持启动该工具' }
}

module.exports = { findCommand, launchTool }
