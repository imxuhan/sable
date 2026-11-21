import { app } from 'electron'
import { execFile } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

async function resolveSableExecutable(): Promise<string> {
  if (path.basename(process.execPath).toLowerCase() === 'sable.exe') {
    return process.execPath
  }
  const localPacked = path.resolve(app.getAppPath(), 'release', 'Sable', 'Sable.exe')
  try {
    await fs.access(localPacked)
    return localPacked
  } catch {
    return process.execPath
  }
}

async function runReg(args: string[]): Promise<void> {
  await execFileAsync('reg.exe', args, { windowsHide: true })
}

export async function registerWindowsShellIntegration(): Promise<{
  ok: boolean
  message: string
}> {
  if (process.platform !== 'win32') {
    return { ok: false, message: '仅 Windows 平台支持注册资源管理器右键菜单' }
  }

  try {
    const exePath = await resolveSableExecutable()
    const commandValue = `"${exePath}" "%1"`
    const iconValue = `${exePath},0`

    await runReg([
      'add',
      'HKCU\\Software\\Classes\\*\\shell\\Sable',
      '/ve',
      '/d',
      '使用 Sable 打开',
      '/f'
    ])
    await runReg([
      'add',
      'HKCU\\Software\\Classes\\*\\shell\\Sable',
      '/v',
      'Icon',
      '/d',
      iconValue,
      '/f'
    ])
    await runReg([
      'add',
      'HKCU\\Software\\Classes\\*\\shell\\Sable\\command',
      '/ve',
      '/d',
      commandValue,
      '/f'
    ])

    await runReg([
      'add',
      'HKCU\\Software\\Classes\\Sable.Markdown',
      '/ve',
      '/d',
      'Sable Markdown Document',
      '/f'
    ])
    await runReg([
      'add',
      'HKCU\\Software\\Classes\\Sable.Markdown\\Application',
      '/v',
      'ApplicationName',
      '/d',
      'Sable',
      '/f'
    ])
    await runReg([
      'add',
      'HKCU\\Software\\Classes\\Sable.Markdown\\Application',
      '/v',
      'ApplicationIcon',
      '/d',
      iconValue,
      '/f'
    ])
    await runReg([
      'add',
      'HKCU\\Software\\Classes\\Sable.Markdown\\DefaultIcon',
      '/ve',
      '/d',
      iconValue,
      '/f'
    ])
    await runReg([
      'add',
      'HKCU\\Software\\Classes\\Sable.Markdown\\shell\\open',
      '/v',
      'FriendlyAppName',
      '/d',
      'Sable',
      '/f'
    ])
    await runReg([
      'add',
      'HKCU\\Software\\Classes\\Sable.Markdown\\shell\\open\\command',
      '/ve',
      '/d',
      commandValue,
      '/f'
    ])

    await runReg([
      'add',
      'HKCU\\Software\\Classes\\Applications\\Sable.exe',
      '/v',
      'FriendlyAppName',
      '/d',
      'Sable',
      '/f'
    ])
    await runReg([
      'add',
      'HKCU\\Software\\Classes\\Applications\\Sable.exe\\DefaultIcon',
      '/ve',
      '/d',
      iconValue,
      '/f'
    ])
    await runReg([
      'add',
      'HKCU\\Software\\Classes\\Applications\\Sable.exe\\shell\\open',
      '/v',
      'FriendlyAppName',
      '/d',
      'Sable',
      '/f'
    ])
    await runReg([
      'add',
      'HKCU\\Software\\Classes\\Applications\\Sable.exe\\shell\\open\\command',
      '/ve',
      '/d',
      commandValue,
      '/f'
    ])

    // Refresh Windows MuiCache so "Open with" never shows stale "Electron" name
    const muiCacheKey =
      'HKCU\\Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\Shell\\MuiCache'
    await runReg(['add', muiCacheKey, '/v', `${exePath}.FriendlyAppName`, '/d', 'Sable', '/f']).catch(
      () => undefined
    )
    await runReg(['add', muiCacheKey, '/v', `${exePath}.ApplicationCompany`, '/d', 'Sable', '/f']).catch(
      () => undefined
    )

    await runReg([
      'add',
      'HKCU\\Software\\Classes\\.md\\OpenWithProgids',
      '/v',
      'Sable.Markdown',
      '/t',
      'REG_NONE',
      '/f'
    ])
    await runReg([
      'add',
      'HKCU\\Software\\Classes\\.markdown\\OpenWithProgids',
      '/v',
      'Sable.Markdown',
      '/t',
      'REG_NONE',
      '/f'
    ])

    return { ok: true, message: '已成功注册系统右键菜单与 .md 文件关联图标' }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : '注册表写入失败'
    }
  }
}

export async function unregisterWindowsShellIntegration(): Promise<{
  ok: boolean
  message: string
}> {
  if (process.platform !== 'win32') {
    return { ok: false, message: '仅 Windows 平台支持该操作' }
  }

  try {
    await runReg(['delete', 'HKCU\\Software\\Classes\\*\\shell\\Sable', '/f']).catch(
      () => undefined
    )
    await runReg(['delete', 'HKCU\\Software\\Classes\\Sable.Markdown', '/f']).catch(
      () => undefined
    )
    await runReg(['delete', 'HKCU\\Software\\Classes\\Applications\\Sable.exe', '/f']).catch(
      () => undefined
    )
    await runReg([
      'delete',
      'HKCU\\Software\\Classes\\.md\\OpenWithProgids',
      '/v',
      'Sable.Markdown',
      '/f'
    ]).catch(() => undefined)
    await runReg([
      'delete',
      'HKCU\\Software\\Classes\\.markdown\\OpenWithProgids',
      '/v',
      'Sable.Markdown',
      '/f'
    ]).catch(() => undefined)

    return { ok: true, message: '已移除系统右键菜单与文件关联记录' }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : '移除注册表项失败'
    }
  }
}
