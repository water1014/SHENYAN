import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/app-shell'
import { Home } from '@/pages/home'
import { ChatView } from '@/pages/chat'
import { Settings } from '@/pages/settings'
import { Characters } from '@/pages/characters'
import { CharacterEditor } from '@/pages/character-editor'
import { MemoryManager } from '@/pages/memory'
import { DataPage } from '@/pages/data'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="home" element={<Home />} />
        <Route index element={<ChatView />} />
        <Route path="settings" element={<Settings />} />
        <Route path="characters" element={<Characters />} />
        <Route path="characters/:id" element={<CharacterEditor />} />
        <Route path="memory" element={<MemoryManager />} />
        <Route path="data" element={<DataPage />} />
        {/* 找不到的路径回聊天页，保持旧行为 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
