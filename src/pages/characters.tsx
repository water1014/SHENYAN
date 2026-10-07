import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Hint } from '@/components/ui/tooltip'
import {
  IconAlert,
  IconCopy,
  IconDownload,
  IconEdit,
  IconMessages,
  IconPlus,
  IconTrash,
  IconUpload,
  IconUser,
} from '@/components/icons'
import { downloadJson, safeParseJson } from '@/lib/utils'
import { useCharacterStore } from '@/store/characters'
import { useSessionStore } from '@/store/sessions'
import { useUiStore } from '@/store/ui'
import type { Character } from '@/lib/types'

export function Characters() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const characters = useCharacterStore((s) => s.characters)
  const create = useCharacterStore((s) => s.create)
  const remove = useCharacterStore((s) => s.remove)
  const duplicate = useCharacterStore((s) => s.duplicate)
  const importCharacters = useCharacterStore((s) => s.importCharacters)
  const createSession = useSessionStore((s) => s.createSession)
  const showToast = useUiStore((s) => s.showToast)

  const [pendingDelete, setPendingDelete] = useState<Character | null>(null)
  const [importPreview, setImportPreview] = useState<Partial<Character>[] | null>(null)

  const handleFile = async (file: File) => {
    const text = await file.text()
    const parsed = safeParseJson<any>(text)
    if (!parsed) {
      showToast('文件不是合法 JSON', 'error')
      return
    }
    // 支持三种形态：单张角色卡、角色数组、完整备份文件
    const list: Partial<Character>[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.characters)
        ? parsed.characters
        : [parsed]
    const valid = list.filter((c) => c && typeof c === 'object')
    if (valid.length === 0) {
      showToast('里面没有找到角色数据', 'error')
      return
    }
    setImportPreview(valid)
  }

  const confirmImport = async () => {
    if (!importPreview) return
    const added = await importCharacters(importPreview, 'rename')
    showToast(`已导入 ${added.length} 个角色`, 'success')
    setImportPreview(null)
  }

  const startChat = async (character: Character) => {
    await createSession(character.id, '新的对话', character.firstMessage)
    navigate('/')
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="mx-auto max-w-5xl space-y-5 px-3.5 py-5 pb-24 sm:px-5 sm:py-6 xl:pb-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1 className="flex items-center gap-2 text-xl font-semibold">
              <IconUser className="h-5 w-5 text-primary" /> 角色卡
            </h1>
            <p className="text-xs text-muted-foreground">
              共 {characters.length} 个角色。可以导入导出来分享角色卡。
            </p>
          </div>
          <div className="flex w-full shrink-0 gap-2 sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() => fileRef.current?.click()}
            >
              <IconUpload className="h-3.5 w-3.5" /> 导入角色卡
            </Button>
            <Button
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() => {
                void (async () => {
                  const created = await create()
                  navigate(`/characters/${created.id}`)
                })()
              }}
            >
              <IconPlus className="h-3.5 w-3.5" /> 新建角色
            </Button>
          </div>
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
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {characters.map((character) => (
            <Card key={character.id} className="group overflow-hidden">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={character.name} src={character.avatar} size={48} />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold">{character.name}</h2>
                    <p className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                      {character.persona || '（没有人设）'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {character.tags.slice(0, 4).map((t) => (
                    <Badge key={t} variant="muted" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
                  {character.addressUser && (
                    <Badge variant="secondary" className="text-[10px]">
                      称呼：{character.addressUser}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-1 border-t border-border pt-3">
                  <Button size="sm" variant="secondary" className="flex-1" onClick={() => void startChat(character)}>
                    <IconMessages className="h-3.5 w-3.5" /> 开始聊天
                  </Button>
                  <Hint label="编辑">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => navigate(`/characters/${character.id}`)}
                    >
                      <IconEdit className="h-3.5 w-3.5" />
                    </Button>
                  </Hint>
                  <Hint label="导出角色卡">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => {
                        const safe = character.name.replace(/[\\/:*?"<>|]/g, '_')
                        downloadJson(`character-card-${safe}.json`, character)
                        showToast('已导出角色卡', 'success')
                      }}
                    >
                      <IconDownload className="h-3.5 w-3.5" />
                    </Button>
                  </Hint>
                  <Hint label="复制一份">
                    <Button size="icon-sm" variant="ghost" onClick={() => void duplicate(character.id)}>
                      <IconCopy className="h-3.5 w-3.5" />
                    </Button>
                  </Hint>
                  <Hint label="删除">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setPendingDelete(character)}
                    >
                      <IconTrash className="h-3.5 w-3.5" />
                    </Button>
                  </Hint>
                </div>
              </CardContent>
            </Card>
          ))}

          <button
            onClick={() => {
              void (async () => {
                const created = await create()
                navigate(`/characters/${created.id}`)
              })()
            }}
            className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <IconPlus className="h-6 w-6" />
            <span className="text-xs">新建角色</span>
          </button>
        </div>
      </div>

      {/* 删除确认 */}
      <Dialog open={Boolean(pendingDelete)} onOpenChange={(v) => !v && setPendingDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconAlert className="h-4 w-4 text-destructive" /> 删除「{pendingDelete?.name}」？
            </DialogTitle>
            <DialogDescription>
              它的所有对话、消息和记忆都会一起删除，无法撤销。建议先在「导入导出」页备份。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingDelete) void remove(pendingDelete.id)
                setPendingDelete(null)
              }}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 导入预览 */}
      <Dialog open={Boolean(importPreview)} onOpenChange={(v) => !v && setImportPreview(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>导入 {importPreview?.length} 个角色</DialogTitle>
            <DialogDescription>
              id 重复时会自动改名另存，不会覆盖现有角色。
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-60 space-y-1 overflow-y-auto scrollbar-thin rounded-md border border-border p-2 text-xs">
            {importPreview?.map((c, i) => (
              <li key={i} className="flex items-center gap-2">
                <Avatar name={c.name ?? '?'} src={c.avatar} size={22} />
                <span className="truncate font-medium">{c.name ?? '未命名'}</span>
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                  {c.persona ? `${c.persona.slice(0, 16)}…` : '没有人设'}
                </span>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setImportPreview(null)}>
              取消
            </Button>
            <Button onClick={() => void confirmImport()}>确认导入</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
