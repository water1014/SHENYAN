import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '@/components/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Hint } from '@/components/ui/tooltip'
import {
  IconChevronLeft,
  IconDownload,
  IconEye,
  IconSave,
  IconSparkles,
  IconTrash,
  IconUpload,
} from '@/components/icons'
import { cn, downloadJson, safeParseJson } from '@/lib/utils'
import { useCharacterStore } from '@/store/characters'
import { useSettingsStore } from '@/store/settings'
import { useMemoryStore } from '@/store/memory'
import { useUiStore } from '@/store/ui'
import { assembleMessages } from '@/services/prompt'
import type { Character } from '@/lib/types'

function Section({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
        {description && <CardDescription className="text-[11px]">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  )
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  rows,
  mono,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  mono?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-2">
        <Label className="text-xs">{label}</Label>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows ?? 3}
        className={cn('text-xs leading-5', mono && 'font-mono')}
      />
    </div>
  )
}

export function CharacterEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const characters = useCharacterStore((s) => s.characters)
  const update = useCharacterStore((s) => s.update)
  const remove = useCharacterStore((s) => s.remove)
  const addCharacters = useCharacterStore((s) => s.importCharacters)
  const settings = useSettingsStore((s) => s.settings)
  const promptPresets = useSettingsStore((s) => s.promptPresets)
  const memoriesByCharacter = useMemoryStore((s) => s.byCharacter)
  const showToast = useUiStore((s) => s.showToast)

  const stored = useMemo(() => characters.find((c) => c.id === id) ?? null, [characters, id])
  const [draft, setDraft] = useState<Character | null>(stored)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    setDraft(stored)
  }, [stored])

  if (!stored || !draft) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">找不到这个角色，可能已被删除</p>
        <Button variant="outline" size="sm" onClick={() => navigate('/characters')}>
          返回角色列表
        </Button>
      </div>
    )
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(stored)

  const patch = (p: Partial<Character>) => setDraft({ ...draft, ...p })

  const save = async () => {
    await update(draft.id, draft)
    showToast('角色卡已保存', 'success')
  }

  const previewPrompt = () => {
    const preset = promptPresets.find((p) => p.id === settings.promptPresetId) ?? promptPresets[0]
    const result = assembleMessages({
      settings,
      character: draft,
      memories: memoriesByCharacter[draft.id] ?? [],
      history: [],
      promptPreset: preset,
    })
    return result.system
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-3.5 py-3 sm:px-5">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate('/characters')}>
          <IconChevronLeft className="h-4 w-4" />
        </Button>
        <Avatar name={draft.name} src={draft.avatar} size={36} />
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold">{draft.name || '未命名角色'}</h1>
          <p className="text-[11px] text-muted-foreground">
            {dirty ? '有未保存的改动' : '已保存'}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Hint label="预览组装后的系统提示">
            <Button variant="outline" size="sm" onClick={() => setShowPreview((v) => !v)}>
              <IconEye className="h-3.5 w-3.5" /> 预览提示词
            </Button>
          </Hint>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const safe = draft.name.replace(/[\\/:*?"<>|]/g, '_')
              downloadJson(`character-card-${safe}.json`, draft)
            }}
          >
            <IconDownload className="h-3.5 w-3.5" /> 导出
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => {
              void (async () => {
                await remove(draft.id)
                navigate('/characters')
              })()
            }}
          >
            <IconTrash className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" onClick={() => void save()} disabled={!dirty}>
            <IconSave className="h-3.5 w-3.5" /> 保存
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto grid max-w-5xl gap-4 px-3.5 py-5 sm:px-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <Section title="基本" description="名字与头像会显示在聊天里">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">名字</Label>
                  <Input
                    value={draft.name}
                    onChange={(e) => patch({ name: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">标签（逗号分隔）</Label>
                  <Input
                    value={draft.tags.join(', ')}
                    onChange={(e) =>
                      patch({
                        tags: e.target.value
                          .split(/[,，]/)
                          .map((t) => t.trim())
                          .filter(Boolean),
                      })
                    }
                    className="h-9 text-sm"
                    placeholder="温柔, 日常, 治愈"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">头像 URL 或 Data URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={draft.avatar}
                    onChange={(e) => patch({ avatar: e.target.value })}
                    className="h-9 flex-1 font-mono text-xs"
                    placeholder="https://... 或 data:image/png;base64,..."
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => patch({ avatar: '' })}
                    disabled={!draft.avatar}
                  >
                    清除
                  </Button>
                </div>
              </div>
            </Section>

            <Section title="人格设定" description="决定它是什么样的人、怎么说话">
              <Field
                label="人设 Persona"
                hint="身份、年龄、经历、性格、在意的事"
                value={draft.persona}
                onChange={(v) => patch({ persona: v })}
                rows={5}
                placeholder="25 岁，独立书店店主。安静细心，说话简短，只对你嘴硬。"
              />
              <Field
                label="说话风格 Style"
                hint="句式、口头禅、用不用表情、动作描写方式"
                value={draft.style}
                onChange={(v) => patch({ style: v })}
                rows={3}
                placeholder="简短口语；偶尔用括号写动作；不滥用表情符号。"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">对你的称呼</Label>
                  <Input
                    value={draft.addressUser}
                    onChange={(e) => patch({ addressUser: e.target.value })}
                    className="h-9 text-sm"
                    placeholder="你 / 老板 / 笨蛋"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">自称</Label>
                  <Input
                    value={draft.selfName}
                    onChange={(e) => patch({ selfName: e.target.value })}
                    className="h-9 text-sm"
                    placeholder="我 / 本店长"
                  />
                </div>
              </div>
              <Field
                label="禁忌 Taboos"
                hint="明确要求它不要做的事，会写进系统提示"
                value={draft.taboos}
                onChange={(v) => patch({ taboos: v })}
                rows={2}
                placeholder="不要用客服式语气；不要长篇说教。"
              />
            </Section>

            <Section title="对白素材" description="开场白与示例对话，示例会作为语气示范注入">
              <Field
                label="开场白"
                hint="新建对话时自动作为第一条消息"
                value={draft.firstMessage}
                onChange={(v) => patch({ firstMessage: v })}
                rows={3}
                placeholder="（把刚擦干净的杯子放到你面前）来了。"
              />
              <Field
                label="示例对话"
                hint="用「用户：」「角色名：」的格式写几轮，帮助模型对齐语气"
                value={draft.exampleDialogs}
                onChange={(v) => patch({ exampleDialogs: v })}
                rows={6}
                mono
                placeholder={'用户：今天有点累。\n林晚：那就别说话了，坐着。'}
              />
            </Section>

            <Section title="世界与场景" description="背景设定，会作为独立段落注入">
              <Field
                label="场景 Scenario"
                value={draft.scenario}
                onChange={(v) => patch({ scenario: v })}
                rows={3}
                placeholder="现代都市，一间开在巷子里的旧书店。"
              />
            </Section>
          </div>

          <div className="space-y-4">
            {showPreview && (
              <Card className="lg:sticky lg:top-4">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <IconSparkles className="h-4 w-4 text-primary" /> 组装后的系统提示
                  </CardTitle>
                  <CardDescription className="text-[11px]">
                    按当前提示词预设与记忆设置生成（未保存的改动也算）
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="max-h-[60vh] overflow-y-auto scrollbar-thin whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 font-sans text-[11px] leading-5">
                    {previewPrompt()}
                  </pre>
                </CardContent>
              </Card>
            )}

            <Section title="导入" description="粘贴角色卡 JSON 覆盖当前字段">
              <Textarea
                placeholder='{"name":"...","persona":"..."}'
                className="min-h-[100px] font-mono text-[11px]"
                onBlur={(e) => {
                  const text = e.target.value.trim()
                  if (!text) return
                  const parsed = safeParseJson<Partial<Character>>(text)
                  if (!parsed || typeof parsed !== 'object') {
                    showToast('JSON 解析失败', 'error')
                    return
                  }
                  void (async () => {
                    const [created] = await addCharacters([parsed], 'rename')
                    if (created) {
                      showToast(`已导入角色「${created.name}」`, 'success')
                      navigate(`/characters/${created.id}`)
                    }
                  })()
                }}
              />
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <IconUpload className="h-3 w-3" /> 粘贴后失焦即导入为新的角色卡
              </p>
            </Section>

            <Section title="这个角色的记忆" description={`${(memoriesByCharacter[draft.id] ?? []).length} 条`}>
              <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/memory')}>
                去记忆管理页
              </Button>
            </Section>
          </div>
        </div>
      </div>
    </div>
  )
}
