import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Hint } from '@/components/ui/tooltip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  IconAlert,
  IconBrain,
  IconCheck,
  IconEye,
  IconEyeOff,
  IconInfo,
  IconLayers,
  IconPlus,
  IconSave,
  IconSettings,
  IconSparkles,
  IconTrash,
} from '@/components/icons'
import { cn, clamp, copyText, safeParseJson } from '@/lib/utils'
import { endpointOf } from '@/services/llm'
import { DEFAULT_SYSTEM_IDENTITY } from '@/lib/defaults'
import { useSettingsStore } from '@/store/settings'
import type { ModelPreset, PromptBlockToggle, PromptPreset } from '@/lib/types'

const BLOCK_LABELS: Record<keyof PromptBlockToggle, string> = {
  identity: '系统身份',
  character: '角色卡',
  memory: '长期记忆',
  scenario: '场景设定',
  examples: '示例对话',
  time: '当前时间',
}

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center gap-1.5">
        <Label className="text-xs">{label}</Label>
        {hint && (
          <Hint label={hint}>
            <span className="text-muted-foreground">
              <IconInfo className="h-3 w-3" />
            </span>
          </Hint>
        )}
      </div>
      {children}
    </div>
  )
}

export function Settings() {
  const settings = useSettingsStore((s) => s.settings)
  const presets = settings.presets
  const promptPresets = useSettingsStore((s) => s.promptPresets)
  const update = useSettingsStore((s) => s.update)
  const addPreset = useSettingsStore((s) => s.addPreset)
  const updatePreset = useSettingsStore((s) => s.updatePreset)
  const duplicatePreset = useSettingsStore((s) => s.duplicatePreset)
  const removePreset = useSettingsStore((s) => s.removePreset)
  const setActivePreset = useSettingsStore((s) => s.setActivePreset)
  const savePromptPreset = useSettingsStore((s) => s.savePromptPreset)
  const deletePromptPreset = useSettingsStore((s) => s.deletePromptPreset)

  const [selectedPresetId, setSelectedPresetId] = useState(settings.activePresetId)
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null)

  const selected = useMemo(
    () => presets.find((p) => p.id === selectedPresetId) ?? presets[0],
    [presets, selectedPresetId],
  )

  useEffect(() => {
    if (!presets.some((p) => p.id === selectedPresetId)) {
      setSelectedPresetId(presets[0]?.id ?? '')
    }
  }, [presets, selectedPresetId])

  const patch = (p: Partial<ModelPreset>) => {
    if (selected) void updatePreset(selected.id, p)
  }

  const testConnection = async () => {
    if (!selected) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(endpointOf(selected.apiBase), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(selected.apiKey.trim() ? { Authorization: `Bearer ${selected.apiKey.trim()}` } : {}),
        },
        body: JSON.stringify({
          model: selected.model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 8,
          stream: false,
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        setTestResult({ ok: false, text: `HTTP ${res.status}：${text.slice(0, 300)}` })
      } else {
        const json = await res.json()
        const content = json?.choices?.[0]?.message?.content ?? '(无内容)'
        setTestResult({ ok: true, text: `连通正常，模型回复：${String(content).slice(0, 120)}` })
      }
    } catch (e) {
      setTestResult({
        ok: false,
        text: `请求失败：${(e as Error).message}。常见原因：网络不通 / API Base 写错 / 浏览器跨域(CORS)。可试 npm run proxy 后把 Base 改成 http://127.0.0.1:8787/v1`,
      })
    } finally {
      setTesting(false)
    }
  }

  const activePromptPreset =
    promptPresets.find((p) => p.id === settings.promptPresetId) ?? promptPresets[0]

  const [draftPreset, setDraftPreset] = useState<PromptPreset | null>(null)
  useEffect(() => {
    setDraftPreset(activePromptPreset ? { ...activePromptPreset } : null)
  }, [activePromptPreset])

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="mx-auto max-w-5xl space-y-5 px-3.5 py-5 pb-24 sm:px-5 sm:py-6 xl:pb-6">
        <header className="space-y-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <IconSettings className="h-5 w-5 text-primary" /> 设置
          </h1>
          <p className="text-xs text-muted-foreground">
            兼容 OpenAI 格式的 <code className="rounded bg-muted px-1">/v1/chat/completions</code>
            。所有设置只存在这台机器的浏览器里。
          </p>
        </header>

        <Tabs defaultValue="api">
          <TabsList>
            <TabsTrigger value="api">接口与模型</TabsTrigger>
            <TabsTrigger value="chat">对话与记忆</TabsTrigger>
            <TabsTrigger value="prompt">提示词组装</TabsTrigger>
          </TabsList>

          {/* ---------------- 接口与模型 ---------------- */}
          <TabsContent value="api">
            <div className="grid gap-4 md:grid-cols-[240px_1fr]">
              <Card className="h-fit">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm">模型预设</CardTitle>
                  <CardDescription className="text-[11px]">
                    可以存多套配置随时切换
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-1 p-2">
                  {presets.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPresetId(p.id)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors',
                        p.id === selected?.id ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{p.name}</span>
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {p.model || '未填模型'}
                        </span>
                      </span>
                      {p.id === settings.activePresetId && (
                        <Badge className="px-1.5 py-0 text-[10px]">使用中</Badge>
                      )}
                    </button>
                  ))}
                  <div className="flex gap-1 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs"
                      onClick={() => void addPreset()}
                    >
                      <IconPlus className="h-3.5 w-3.5" /> 新增
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      disabled={!selected}
                      onClick={() => void duplicatePreset(selected!.id)}
                    >
                      复制
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {selected && (
                <Card>
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-sm">预设详情</CardTitle>
                      <CardDescription className="text-[11px]">
                        {selected.id === settings.activePresetId
                          ? '当前正在使用这套配置'
                          : '这套配置还没启用'}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {selected.id !== settings.activePresetId && (
                        <Button size="sm" onClick={() => void setActivePreset(selected.id)}>
                          <IconCheck className="h-3.5 w-3.5" /> 设为使用中
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        disabled={presets.length <= 1}
                        onClick={() => void removePreset(selected.id)}
                      >
                        <IconTrash className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="预设名称">
                        <Input
                          value={selected.name}
                          onChange={(e) => patch({ name: e.target.value })}
                          className="h-9 text-sm"
                        />
                      </Field>
                      <Field
                        label="模型名称"
                        hint="例如 gpt-4o-mini / deepseek-chat / claude-3-5-sonnet"
                      >
                        <Input
                          value={selected.model}
                          onChange={(e) => patch({ model: e.target.value })}
                          className="h-9 text-sm"
                          placeholder="gpt-4o-mini"
                        />
                      </Field>
                    </div>

                    <Field
                      label="API Base"
                      hint="填 https://api.openai.com/v1 这样的地址即可，会自动补 /v1 与 /chat/completions"
                    >
                      <Input
                        value={selected.apiBase}
                        onChange={(e) => patch({ apiBase: e.target.value })}
                        className="h-9 font-mono text-xs"
                        placeholder="https://api.openai.com/v1"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        实际请求地址：
                        <span className="break-all font-mono">{endpointOf(selected.apiBase)}</span>
                      </p>
                    </Field>

                    <Field
                      label="API Key"
                      hint="只存在本地浏览器（IndexedDB 设置里）。想更安全就跑 npm run proxy，Base 改成本地代理地址"
                    >
                      <div className="flex gap-2">
                        <Input
                          type={showKey ? 'text' : 'password'}
                          value={selected.apiKey}
                          onChange={(e) => patch({ apiKey: e.target.value })}
                          className="h-9 font-mono text-xs"
                          placeholder="sk-..."
                          autoComplete="off"
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => setShowKey((v) => !v)}
                          title={showKey ? '隐藏' : '显示'}
                        >
                          {showKey ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void copyText(selected.apiKey)}
                          disabled={!selected.apiKey}
                        >
                          复制
                        </Button>
                      </div>
                    </Field>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label={`温度 ${selected.temperature.toFixed(2)}`} hint="越高越发散，角色扮演建议 0.7 - 1.0">
                        <Slider
                          value={[selected.temperature]}
                          min={0}
                          max={2}
                          step={0.05}
                          onValueChange={([v]) => patch({ temperature: v })}
                        />
                      </Field>
                      <Field label={`Top P ${selected.topP.toFixed(2)}`} hint="一般保持 1 即可">
                        <Slider
                          value={[selected.topP]}
                          min={0.1}
                          max={1}
                          step={0.05}
                          onValueChange={([v]) => patch({ topP: v })}
                        />
                      </Field>
                    </div>

                    <Field label="最大 token" hint="单次回复的长度上限">
                      <Input
                        type="number"
                        min={0}
                        value={selected.maxTokens}
                        onChange={(e) => patch({ maxTokens: clamp(Number(e.target.value), 0, 200000) })}
                        className="h-9 w-40 text-sm"
                      />
                    </Field>

                    <details className="rounded-lg border border-border p-3">
                      <summary className="cursor-pointer text-xs font-medium">
                        高级：额外请求头 / 请求体
                      </summary>
                      <div className="mt-3 space-y-3">
                        <Field
                          label="额外请求头（JSON）"
                          hint='例如 {"X-Title":"companion"}，可覆盖 Authorization'
                        >
                          <Textarea
                            value={selected.extraHeaders}
                            onChange={(e) => patch({ extraHeaders: e.target.value })}
                            className="min-h-[60px] font-mono text-xs"
                            placeholder='{"X-Custom":"value"}'
                          />
                          {selected.extraHeaders.trim() &&
                            !safeParseJson(selected.extraHeaders) && (
                              <p className="text-[11px] text-destructive">不是合法 JSON</p>
                            )}
                        </Field>
                        <Field
                          label="额外请求体（JSON）"
                          hint='例如 {"top_k":40} 或 {"frequency_penalty":0.3}'
                        >
                          <Textarea
                            value={selected.extraBody}
                            onChange={(e) => patch({ extraBody: e.target.value })}
                            className="min-h-[60px] font-mono text-xs"
                            placeholder='{"frequency_penalty":0.2}'
                          />
                          {selected.extraBody.trim() && !safeParseJson(selected.extraBody) && (
                            <p className="text-[11px] text-destructive">不是合法 JSON</p>
                          )}
                        </Field>
                      </div>
                    </details>

                    <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
                      <Button size="sm" variant="outline" onClick={() => void testConnection()} disabled={testing}>
                        {testing ? '测试中…' : '测试连接'}
                      </Button>
                      <span className="text-[11px] text-muted-foreground">
                        会发一条 "ping"，消耗极少额度
                      </span>
                    </div>

                    {testResult && (
                      <div
                        className={cn(
                          'flex items-start gap-2 rounded-md border px-3 py-2 text-[11px]',
                          testResult.ok
                            ? 'border-primary/40 bg-primary/10'
                            : 'border-destructive/40 bg-destructive/10',
                        )}
                      >
                        {testResult.ok ? (
                          <IconCheck className="mt-0.5 h-3.5 w-3.5 text-primary" />
                        ) : (
                          <IconAlert className="mt-0.5 h-3.5 w-3.5 text-destructive" />
                        )}
                        <span className="whitespace-pre-wrap break-words">{testResult.text}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ---------------- 对话与记忆 ---------------- */}
          <TabsContent value="chat">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <IconSparkles className="h-4 w-4 text-primary" /> 上下文
                  </CardTitle>
                  <CardDescription className="text-[11px]">
                    只把最近 N 条消息发给模型，更早的内容靠记忆摘要带过去
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Field
                    label={`上下文条数：${settings.contextMessageLimit}`}
                    hint="太小会失忆，太大会变贵且容易超限。一般 10 - 40"
                  >
                    <Slider
                      value={[settings.contextMessageLimit]}
                      min={2}
                      max={100}
                      step={1}
                      onValueChange={([v]) => void update({ contextMessageLimit: v })}
                    />
                  </Field>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs">流式输出</Label>
                      <p className="text-[11px] text-muted-foreground">逐字显示（推荐开启）</p>
                    </div>
                    <Switch
                      checked={settings.stream}
                      onCheckedChange={(v) => void update({ stream: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs">显示 token 估算</Label>
                      <p className="text-[11px] text-muted-foreground">在消息与输入框旁显示粗略字数</p>
                    </div>
                    <Switch
                      checked={settings.showTokenEstimate}
                      onCheckedChange={(v) => void update({ showTokenEstimate: v })}
                    />
                  </div>
                  <Field label="请求超时（毫秒，0 = 不限）">
                    <Input
                      type="number"
                      min={0}
                      step={1000}
                      value={settings.requestTimeoutMs}
                      onChange={(e) =>
                        void update({ requestTimeoutMs: clamp(Number(e.target.value), 0, 600000) })
                      }
                      className="h-9 w-40 text-sm"
                    />
                  </Field>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <IconBrain className="h-4 w-4 text-primary" /> 记忆
                  </CardTitle>
                  <CardDescription className="text-[11px]">
                    置顶记忆一定注入；其余按重要度与时间取前 N 条
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs">启用长期记忆注入</Label>
                      <p className="text-[11px] text-muted-foreground">关掉后记忆只存不用</p>
                    </div>
                    <Switch
                      checked={settings.memoryEnabled}
                      onCheckedChange={(v) => void update({ memoryEnabled: v })}
                    />
                  </div>
                  <Field
                    label={`每次注入上限：${settings.memoryInjectLimit} 条`}
                    hint="注入越多越容易记住，但会占上下文并可能干扰角色扮演"
                  >
                    <Slider
                      value={[settings.memoryInjectLimit]}
                      min={0}
                      max={40}
                      step={1}
                      onValueChange={([v]) => void update({ memoryInjectLimit: v })}
                    />
                  </Field>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs">自动摘要</Label>
                      <p className="text-[11px] text-muted-foreground">按轮数自动提炼事实入库</p>
                    </div>
                    <Switch
                      checked={settings.autoSummarize}
                      onCheckedChange={(v) => void update({ autoSummarize: v })}
                    />
                  </div>
                  <Field label={`每 ${settings.summarizeEveryRounds} 轮摘要一次`}>
                    <Slider
                      value={[settings.summarizeEveryRounds]}
                      min={2}
                      max={50}
                      step={1}
                      onValueChange={([v]) => void update({ summarizeEveryRounds: v })}
                    />
                  </Field>
                  <Field
                    label="摘要用哪套预设"
                    hint="可以指定一个便宜模型专门做摘要，省额度"
                  >
                    <select
                      className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                      value={settings.summarizePresetId}
                      onChange={(e) => void update({ summarizePresetId: e.target.value })}
                    >
                      <option value="" className="bg-card">
                        跟随当前预设
                      </option>
                      {presets.map((p) => (
                        <option key={p.id} value={p.id} className="bg-card">
                          {p.name}（{p.model}）
                        </option>
                      ))}
                    </select>
                  </Field>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ---------------- 提示词组装 ---------------- */}
          <TabsContent value="prompt">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <IconLayers className="h-4 w-4 text-primary" /> 组装顺序
                  </CardTitle>
                  <CardDescription className="text-[11px]">
                    系统身份 → 角色卡 → 长期记忆 → 场景 / 示例 → 最近对话 → 你的输入
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Field label="系统身份提示词（最前面那段）">
                    <Textarea
                      value={settings.systemIdentity}
                      onChange={(e) => void update({ systemIdentity: e.target.value })}
                      className="min-h-[120px] text-xs leading-5"
                    />
                  </Field>
                  <div className="mt-3 flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs">
                      <Switch
                        checked={settings.strictRoleplay}
                        onCheckedChange={(v) => void update({ strictRoleplay: v })}
                      />
                      追加「不要跳出角色」的约束
                    </label>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs"
                      onClick={() => void update({ systemIdentity: DEFAULT_SYSTEM_IDENTITY })}
                    >
                      恢复默认
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {draftPreset && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">提示词预设</CardTitle>
                    <CardDescription className="text-[11px]">
                      用 {'{{identity}}'} {'{{character}}'} {'{{memory}}'} {'{{scenario}}'}{' '}
                      {'{{examples}}'} {'{{time}}'} 占位
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                      <Field label="当前使用的预设">
                        <select
                          className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                          value={settings.promptPresetId}
                          onChange={(e) => void update({ promptPresetId: e.target.value })}
                        >
                          {promptPresets.map((p) => (
                            <option key={p.id} value={p.id} className="bg-card">
                              {p.name}
                              {p.builtin ? '（内置）' : ''}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <div className="flex items-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            void (async () => {
                              const id = `preset_${Date.now().toString(36)}`
                              const created: PromptPreset = {
                                ...draftPreset,
                                id,
                                name: `${draftPreset.name} 副本`,
                                builtin: false,
                              }
                              await savePromptPreset(created)
                              await update({ promptPresetId: id })
                            })()
                          }}
                        >
                          <IconPlus className="h-3.5 w-3.5" /> 另存为
                        </Button>
                        {!activePromptPreset?.builtin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => void deletePromptPreset(activePromptPreset!.id)}
                          >
                            <IconTrash className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <Field label="启用哪些段落">
                      <div className="flex flex-wrap gap-3">
                        {(Object.keys(BLOCK_LABELS) as (keyof PromptBlockToggle)[]).map((key) => (
                          <label key={key} className="flex items-center gap-1.5 text-xs">
                            <Switch
                              checked={draftPreset.blocks[key]}
                              onCheckedChange={(v) =>
                                setDraftPreset({
                                  ...draftPreset,
                                  blocks: { ...draftPreset.blocks, [key]: v },
                                })
                              }
                            />
                            {BLOCK_LABELS[key]}
                          </label>
                        ))}
                      </div>
                    </Field>

                    <Field label="模板">
                      <Textarea
                        value={draftPreset.template}
                        onChange={(e) => setDraftPreset({ ...draftPreset, template: e.target.value })}
                        className="min-h-[200px] font-mono text-[11px] leading-5"
                      />
                    </Field>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        disabled={draftPreset.builtin && activePromptPreset?.builtin}
                        onClick={() => {
                          void (async () => {
                            await savePromptPreset({ ...draftPreset, builtin: false })
                            await update({ promptPresetId: draftPreset.id })
                          })()
                        }}
                      >
                        <IconSave className="h-3.5 w-3.5" /> 保存预设
                      </Button>
                      {activePromptPreset?.builtin && (
                        <span className="text-[11px] text-muted-foreground">
                          内置预设不可覆盖，点「另存为」建一个自己的
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
