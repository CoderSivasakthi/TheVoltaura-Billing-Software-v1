import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { store } from './store/store'
import App from './App'
import { SettingsProvider } from './context/SettingsContext'
import { AuthProvider } from './context/AuthContext'
import './styles/styles.css'

const useHashRouter = import.meta.env.VITE_ROUTER_MODE === 'hash'
const basename = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || undefined
const Router: any = useHashRouter ? HashRouter : BrowserRouter
const routerProps = useHashRouter ? {} : { basename: basename === '' ? undefined : basename }

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router {...routerProps}>
      <AuthProvider>
        <SettingsProvider>
          <Provider store={store}>
            <App />
          </Provider>
        </SettingsProvider>
      </AuthProvider>
    </Router>
  </React.StrictMode>,
)
