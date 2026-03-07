import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { AppShell, Group, Text, ThemeIcon } from '@mantine/core'
import { IconFileText, IconListCheck } from '@tabler/icons-react'
import { DocumentLibrary } from './DocumentLibrary'
import { Questionnaire } from './Questionnaire'

function NavButton({ to, icon: Icon, label }: { to: string; icon: typeof IconFileText; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      style={({ isActive }) => ({
        padding: '10px 16px',
        borderRadius: 8,
        background: isActive ? '#e2e8f0' : 'transparent',
        color: isActive ? '#0f172a' : '#64748b',
        fontWeight: isActive ? 600 : 400,
        textDecoration: 'none',
      })}
    >
      <Group gap="sm">
        <ThemeIcon variant="light" size="md">
          <Icon size={18} />
        </ThemeIcon>
        <Text size="sm">{label}</Text>
      </Group>
    </NavLink>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppShell
        header={{ height: 56 }}
        padding="md"
        styles={{
          main: { backgroundColor: '#f8fafc' },
        }}
      >
        <AppShell.Header style={{ borderBottom: '1px solid #e2e8f0' }}>
          <Group h="100%" px="lg" justify="space-between">
            <Text fw={700} size="lg" c="dark.8">Security Questionnaire Assistant</Text>
            <Group gap="xs">
              <NavButton to="/" icon={IconFileText} label="Documents" />
              <NavButton to="/questionnaire" icon={IconListCheck} label="Questionnaire" />
            </Group>
          </Group>
        </AppShell.Header>
        <AppShell.Main>
          <Routes>
            <Route path="/" element={<DocumentLibrary />} />
            <Route path="/questionnaire" element={<Questionnaire />} />
          </Routes>
        </AppShell.Main>
      </AppShell>
    </BrowserRouter>
  )
}

export default App
