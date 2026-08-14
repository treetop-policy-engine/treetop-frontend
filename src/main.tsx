import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { WorkspaceProvider } from './app/workspace'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WorkspaceProvider>
      <App />
    </WorkspaceProvider>
  </StrictMode>,
)
