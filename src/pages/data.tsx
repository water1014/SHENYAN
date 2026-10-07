import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  IconAlert,
  IconArchive,
  IconCheck,
  IconDatabase,
  IconDownload,
  IconInfo,
  IconRefresh,
  IconTrash,
  IconUpload,
} from '@/components/icons'
import { formatDateTime, safeParseJson, timestampSlug } from '@/lib/utils'
import { dbStats, requestPersistentStorage } from '@/lib/db'
import {
  buildFullBackup,
  createAutoBackup,
  deleteAutoBackup,
  downloadAutoBackup,
  exportCharacterToFile,
  exportFullBackupToFile,
  exportSessionToFile,
  importBackup,
  listAutoBackups,
  previewImport,
  pruneAutoBackups,
  restoreAutoBackup,
  validateBackup,
  type AutoBackupEntry,
  type ImportPreview,
} from '@/services/backup'
import { useCharacterStore } from '@/store/characters'
import { useSessionStore } from '@/store/sessions'
import { useMemoryStore } from '@/store/memory'
import { useSettingsStore } from '@/store/settings'
import { useUiStore } from '@/store/ui'
import { downloadJson } from '@/lib/utils'
import { PageShell } from '@/components/page-shell'

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function DataPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const characters = useCharacterStore((s) => s.characters)
  const reloadCharacters = useCharacterStore((s) => s.reload)
  const sessions = useSessionStore((s) => s.sessions)
  const loadSessions = useSessionStore((s) => s.loadSessions)
  const settings = useSettingsStore((s) => s.settings)
  const updateSettings = useSettingsStore((s) => s.update)
  const initSettings = useSettingsStore((s) => s.init)
  const showToast = useUiStore((s) => s.showToast)

  const [stats, setStats] = useState<Awaited<ReturnType<typeof dbStats>> | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [backups, setBackups] = useState<AutoBackupEntry[]>([])
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge')
  const [importSettings, setImportSettings] = useState(false)
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState<AutoBackupEntry | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const refreshStats = async () => {
    setStats(await dbStats())
    setBackups(await listAutoBackups())
  }

  useEffect(() => {
    void refreshStats()
    void (async () => setPersisted(await requestPersistentStorage()))()
  }, [])

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try {
      await fn()
    } catch (e) {
      showToast((e as Error).message || '操作失败', 'error')
    } finally {
      setBusy(null)
      await refreshStats()
    }
  }

  const handleFile = async (file: File) => {
    const text = await file.text()
    const raw = safeParseJson<unknown>(text)
    if (!raw) {
      showToast('文件不是合法 JSON', 'error')
      return
    }
    try {
      setPreview(await previewImport(validateBackup(raw)))
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  const doImport = async () => {
    if (!preview) return
    if (importMode === 'replace' && !confirmReplace) {
      setConfirmReplace(true)
      return
    }
    await run('import', async () => {
      // 覆盖导入前先自动留一份快照，防止误操作
      if (importMode === 'replace') {
        await createAutoBackup()
        await pruneAutoBackups(settings.autoBackupKeep)
      }
      const result = await importBackup(preview.file, importMode, { importSettings })
      await reloadCharacters()
      await loadSessions()
      if (importSettings) await initSettings()
      await useMemoryStore.getState().load(
        useCharacterStore.getState().activeCharacterId ?? preview.file.characters[0]?.id ?? '',
      )
      showToast(
        `导入完成：角色 ${result.characters}、会话 ${result.sessions}、消息 ${result.messages}、记忆 ${result.memories}`,
        'success',
      )
      setPreview(null)
      setConfirmReplace(false)
    })
  }

  return (
    <PageShell
      icon={<IconDatabase className="h-[18px] w-[18px]" />}
      title="导入导出与备份"
      description="数据全部存在浏览器 IndexedDB 里。换电脑或清理浏览器前，一定要导出一次。"
    >

        {/* 数据概况 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">数据概况</CardTitle>
            <CardDescription className="text-[11px]">
              存储状态：{persisted === null ? '检测中…' : persisted ? '已申请持久化（浏览器不会自动清理）' : '未持久化，浏览器可能在空间紧张时清理数据'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 text-xs">
            <Badge variant="muted">角色 {stats?.characters ?? 0}</Badge>
            <Badge variant="muted">会话 {stats?.sessions ?? 0}</Badge>
            <Badge variant="muted">消息 {stats?.messages ?? 0}</Badge>
            <Badge variant="muted">记忆 {stats?.memories ?? 0}</Badge>
            <Badge variant="outline">占用 {formatBytes(stats?.usage ?? null)}</Badge>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => void refreshStats()}>
              <IconRefresh className="h-3.5 w-3.5" /> 刷新
            </Button>
          </CardContent>
        </Card>

        {/* 导出 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <IconDownload className="h-4 w-4 text-primary" /> 导出
            </CardTitle>
            <CardDescription className="text-[11px]">
              导出的 JSON 可以直接再导入回来，也可以拿去备份或分享角色卡
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full justify-start"
              disabled={busy === 'full'}
              onClick={() =>
                void run('full', async () => {
                  const name = await exportFullBackupToFile()
                  showToast(`已导出 ${name}`, 'success')
                })
              }
            >
              <IconDownload className="h-4 w-4" /> 导出全部数据（角色 / 会话 / 消息 / 记忆 / 设置）
            </Button>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">导出单个角色</Label>
                <div className="flex flex-wrap gap-1.5">
                  {characters.length === 0 && (
                    <span className="text-[11px] text-muted-foreground">没有角色</span>
                  )}
                  {characters.map((c) => (
                    <Button
                      key={c.id}
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() =>
                        void run(`char-${c.id}`, async () => {
                          await exportCharacterToFile(c.id)
                          showToast(`已导出「${c.name}」`, 'success')
                        })
                      }
                    >
                      {c.name}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">导出单个会话（当前角色的会话）</Label>
                <div className="flex flex-wrap gap-1.5">
                  {sessions.length === 0 && (
                    <span className="text-[11px] text-muted-foreground">没有会话</span>
                  )}
                  {sessions.slice(0, 8).map((s) => (
                    <Button
                      key={s.id}
                      size="sm"
                      variant="outline"
                      className="max-w-[10rem] truncate text-xs"
                      onClick={() =>
                        void run(`sess-${s.id}`, async () => {
                          await exportSessionToFile(s.id)
                          showToast('已导出会话', 'success')
                        })
                      }
                    >
                      {s.title}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 导入 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <IconUpload className="h-4 w-4 text-primary" /> 导入
            </CardTitle>
            <CardDescription className="text-[11px]">
              支持本应用导出的备份文件，也支持单个角色卡 JSON
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <IconUpload className="h-4 w-4" /> 选择 JSON 文件
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleFile(file)
                  e.target.value = ''
                }}
              />
              <span className="text-[11px] text-muted-foreground">
                也可以把文件内容直接粘贴到下面
              </span>
            </div>

            <textarea
              placeholder="粘贴备份 JSON 后失焦即解析"
              className="h-20 w-full rounded-md border border-input bg-transparent p-2 font-mono text-[11px] scrollbar-thin"
              onBlur={(e) => {
                const text = e.target.value.trim()
                if (!text) return
                const raw = safeParseJson<unknown>(text)
                if (!raw) {
                  showToast('JSON 解析失败', 'error')
                  return
                }
                void (async () => {
                  try {
                    setPreview(await previewImport(validateBackup(raw)))
                  } catch (err) {
                    showToast((err as Error).message, 'error')
                  }
                })()
              }}
            />
          </CardContent>
        </Card>

        {/* 自动备份 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <IconArchive className="h-4 w-4 text-primary" /> 自动备份
            </CardTitle>
            <CardDescription className="text-[11px]">
              快照存在本地数据库里，误删或改坏时可以一键回滚（不占用下载目录）
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-xs">
                <Switch
                  checked={settings.autoBackupMinutes > 0}
                  onCheckedChange={(v) => void updateSettings({ autoBackupMinutes: v ? 30 : 0 })}
                />
                开启定时备份
              </label>
              <label className="flex items-center gap-2 text-xs">
                间隔
                <Input
                  type="number"
                  min={1}
                  value={settings.autoBackupMinutes || 30}
                  onChange={(e) =>
                    void updateSettings({ autoBackupMinutes: Number(e.target.value) || 30 })
                  }
                  className="h-7 w-20 text-xs"
                />
                分钟
              </label>
              <label className="flex items-center gap-2 text-xs">
                保留
                <Input
                  type="number"
                  min={1}
                  value={settings.autoBackupKeep}
                  onChange={(e) =>
                    void updateSettings({ autoBackupKeep: Number(e.target.value) || 5 })
                  }
                  className="h-7 w-16 text-xs"
                />
                份
              </label>
              <Button
                size="sm"
                variant="outline"
                disabled={busy === 'snapshot'}
                onClick={() =>
                  void run('snapshot', async () => {
                    await createAutoBackup()
                    await pruneAutoBackups(settings.autoBackupKeep)
                    showToast('已创建快照', 'success')
                  })
                }
              >
                <IconArchive className="h-3.5 w-3.5" /> 立即快照
              </Button>
            </div>

            <ul className="space-y-2">
              {backups.length === 0 && (
                <li className="rounded-md border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground">
                  还没有快照
                </li>
              )}
              {backups.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 text-[11px]"
                >
                  <span className="font-medium">{formatDateTime(b.createdAt)}</span>
                  <span className="text-muted-foreground">
                    角色 {b.counts.characters} · 会话 {b.counts.sessions} · 消息 {b.counts.messages} ·
                    记忆 {b.counts.memories}
                  </span>
                  <span className="ml-auto flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => setConfirmRestore(b)}
                    >
                      回滚
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px]"
                      onClick={() => void downloadAutoBackup(b.id)}
                    >
                      <IconDownload className="h-3 w-3" /> 下载
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px] text-destructive"
                      onClick={() =>
                        void run(`del-${b.id}`, async () => {
                          await deleteAutoBackup(b.id)
                        })
                      }
                    >
                      <IconTrash className="h-3 w-3" />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="flex items-start gap-2 rounded-lg border border-border bg-card/60 px-3 py-2.5 text-[11px] text-muted-foreground">
          <IconInfo className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            换浏览器、清除站点数据、用无痕模式都会让本地数据消失。重要对话请定期「导出全部数据」并保存到别处。
          </p>
        </div>

      {/* 导入预览 */}
      <Dialog open={Boolean(preview)} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>导入预览</DialogTitle>
            <DialogDescription>
              导出时间：
              {preview ? formatDateTime(preview.file.exportedAt) : '—'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs">
            <div className="flex flex-wrap gap-2">
              <Badge variant="muted">角色 {preview?.counts.characters ?? 0}</Badge>
              <Badge variant="muted">会话 {preview?.counts.sessions ?? 0}</Badge>
              <Badge variant="muted">消息 {preview?.counts.messages ?? 0}</Badge>
              <Badge variant="muted">记忆 {preview?.counts.memories ?? 0}</Badge>
              <Badge variant="muted">提示词预设 {preview?.counts.promptPresets ?? 0}</Badge>
            </div>

            {(preview?.conflicts.characters ?? 0) > 0 && (
              <p className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5">
                <IconAlert className="h-3.5 w-3.5 text-primary" />
                有 {preview?.conflicts.characters} 个角色 id 与现有数据相同，合并时会改名另存
              </p>
            )}

            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={importMode === 'merge'}
                  onChange={() => setImportMode('merge')}
                />
                合并导入（保留现有数据，按 id 去重）
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                />
                覆盖导入（清空现有数据，导入前自动留一份快照）
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={importSettings}
                  onChange={(e) => setImportSettings(e.target.checked)}
                />
                同时导入设置与模型预设（会覆盖当前 API 配置）
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreview(null)}>
              取消
            </Button>
            <Button
              variant={importMode === 'replace' ? 'destructive' : 'default'}
              disabled={busy === 'import'}
              onClick={() => void doImport()}
            >
              {busy === 'import' ? '导入中…' : importMode === 'replace' ? '覆盖导入' : '合并导入'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 覆盖导入二次确认 */}
      <Dialog open={confirmReplace} onOpenChange={setConfirmReplace}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconAlert className="h-4 w-4 text-destructive" /> 确认覆盖全部数据？
            </DialogTitle>
            <DialogDescription>
              当前所有角色、会话、消息、记忆都会被替换。系统会先自动创建一个快照，但如果要稳妥，请先手动导出。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmReplace(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={() => void doImport()}>
              确认覆盖
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 回滚确认 */}
      <Dialog open={Boolean(confirmRestore)} onOpenChange={(v) => !v && setConfirmRestore(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>回滚到这份快照？</DialogTitle>
            <DialogDescription>
              {confirmRestore ? formatDateTime(confirmRestore.createdAt) : ''} 之后的所有改动都会丢失。
              回滚前会自动为当前数据留一份快照。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmRestore(null)}>
              取消
            </Button>
            <Button
              onClick={() =>
                void run('restore', async () => {
                  if (!confirmRestore) return
                  await createAutoBackup()
                  await restoreAutoBackup(confirmRestore.id)
                  await reloadCharacters()
                  await loadSessions()
                  await initSettings()
                  showToast('已回滚', 'success')
                  setConfirmRestore(null)
                })
              }
            >
              <IconCheck className="h-3.5 w-3.5" /> 回滚
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}

/** 供外部一键导出（顶栏等处可复用） */
export async function quickExport() {
  const backup = await buildFullBackup()
  downloadJson(`ai-companion-backup-${timestampSlug()}.json`, backup)
  return true
}
