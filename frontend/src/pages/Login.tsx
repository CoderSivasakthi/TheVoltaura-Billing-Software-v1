import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sun, Mail, Lock, Building2, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import '../styles/login.css'

export default function Login() {
    const navigate  = useNavigate()
    const { login } = useAuth()

    const [username,    setUsername]    = useState('')
    const [password,    setPassword]    = useState('')
    const [franchiseId, setFranchiseId] = useState('')
    const [error,       setError]       = useState('')
    const [showError,   setShowError]   = useState(false)
    const [showPass,    setShowPass]    = useState(false)
    const [loading,     setLoading]     = useState(false)

    useEffect(() => {
        if (localStorage.getItem('sf_token')) navigate('/', { replace: true })
    }, [navigate])

    const handleSignIn = async () => {
        setShowError(false)
        setLoading(true)

        // Demo super admin shortcut (admin / admin)
        if ((username === 'admin' || username === 'admin@thevoltaura.com') && password === 'admin') {
            const demoUser = { username: 'admin', role: 'super_admin', tenant_id: 'admin', franchise_id: null, franchise_name: null }
            const demoPerms = Object.fromEntries(
                ['customers','quotations','invoices','payments','orders','products','amc','reports','settings','franchises','approvals','branding']
                    .map(r => [r, { view: true, create: true, edit: true, delete: true, approve: true }])
            ) as any
            login('demo-token-12345', demoUser, demoPerms)
            setLoading(false)
            navigate('/', { replace: true })
            return
        }

        try {
            const r = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, franchise_id: franchiseId || undefined })
            })
            const d = await r.json()

            if (r.status === 403 && d.error === 'Account suspended') {
                setError('Your franchise account has been suspended. Please contact TheVoltaura Head Office.')
                setShowError(true)
                setLoading(false)
                return
            }

            if (d.token && d.user) {
                const userObj = {
                    username:       d.user.username,
                    role:           d.user.role || d.role,
                    tenant_id:      d.user.tenant_id || 'admin',
                    franchise_id:   d.user.franchise_id || null,
                    franchise_name: d.user.franchise_name || null,
                }
                login(d.token, userObj, d.permissions || {})
                navigate('/', { replace: true })
            } else {
                setError(d.error || d.message || 'Invalid credentials')
                setShowError(true)
            }
        } catch {
            setError('Cannot connect to server. Try admin / admin for demo.')
            setShowError(true)
        }
        setLoading(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSignIn()
    }

    return (
        <div className="login-page-body" style={{ fontFamily: "'Inter', sans-serif", height: '100vh', display: 'flex', background: '#fff' }}>
            {/* Left: solar image */}
            <div className="left">
                <img
                    src="https://images.unsplash.com/photo-1509391366360-2e959784a276?w=1200&q=80"
                    alt="Solar panels at sunset"
                    onError={(e) => { (e.target as HTMLImageElement).style.background = 'linear-gradient(135deg,#1a1a2e,#16213e)' }}
                />
                <div className="left-overlay"></div>
                <div className="left-content">
                    <div className="left-brand">
                        <span className="icon"><Sun size={32} color="#fff" /></span>
                        <span className="name">TheVoltaura</span>
                    </div>
                    <h1>Powering the future with sustainable energy solutions.</h1>
                    <p>Enterprise-grade Multi-Tenant Franchise ERP for Solar EPC businesses.</p>
                </div>
            </div>

            {/* Right: sign-in form */}
            <div className="right">
                <div className="right-header">
                    <div className="logo-icon"><Sun size={20} color="#fff" /></div>
                    <span className="logo-text">TheVoltaura Portal</span>
                </div>

                <div className="form-area">
                    <h2>Welcome back</h2>
                    <p className="subtitle">Sign in to your account to continue.</p>

                    {showError && (
                        <div className="error-msg" style={{ display: 'block' }}>{error}</div>
                    )}

                    {/* Franchise ID (optional — blank for Super Admin) */}
                    <div className="form-group">
                        <label>Franchise ID <span style={{ color: '#999', fontWeight: 400 }}>(leave blank for Head Office login)</span></label>
                        <div className="input-wrap">
                            <span className="icon"><Building2 size={16} /></span>
                            <input
                                type="text"
                                id="franchiseId"
                                placeholder="TVA-FR-0001  (optional)"
                                autoComplete="off"
                                value={franchiseId}
                                onChange={e => setFranchiseId(e.target.value.toUpperCase())}
                                onKeyDown={handleKeyDown}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Username / Email</label>
                        <div className="input-wrap">
                            <span className="icon"><Mail size={16} /></span>
                            <input
                                type="text"
                                id="loginEmail"
                                placeholder="erode@thevoltaura.com"
                                autoComplete="username"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                onKeyDown={handleKeyDown}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <div className="input-wrap" style={{ position: 'relative' }}>
                            <span className="icon"><Lock size={16} /></span>
                            <input
                                type={showPass ? 'text' : 'password'}
                                id="loginPassword"
                                placeholder="Enter your password"
                                autoComplete="current-password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                onKeyDown={handleKeyDown}
                                style={{ paddingRight: '2.5rem' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPass(p => !p)}
                                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: 0 }}
                                tabIndex={-1}
                            >
                                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <div className="form-row-opts">
                        <label className="check-label"><input type="checkbox" id="rememberMe" /> Remember me</label>
                        <a href="#" className="forgot">Forgot password?</a>
                    </div>

                    <button
                        className="btn-signin"
                        id="signInBtn"
                        onClick={handleSignIn}
                        disabled={loading}
                        style={{ opacity: loading ? 0.7 : 1 }}
                    >
                        {loading ? 'Signing in…' : 'Sign In'}
                    </button>
                </div>

                <div className="right-footer">
                    <div className="org-info">
                        <div className="org-name">TheVoltaura Private Ltd</div>
                        <div className="org-gst">Multi-Tenant Franchise ERP</div>
                    </div>
                    <a href="mailto:contact@thevoltaura.com" className="support">
                        <Mail size={14} /> contact@thevoltaura.com
                    </a>
                </div>
            </div>
        </div>
    )
}
