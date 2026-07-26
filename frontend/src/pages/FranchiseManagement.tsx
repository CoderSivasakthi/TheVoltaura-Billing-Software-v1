import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Building2, Plus, Search,
    ToggleLeft, ToggleRight,
    RefreshCw, Key,X, Check, AlertTriangle, Sun, User, Phone, Mail,
    MapPin, ChevronLeft, Save, Copy, CheckCircle
} from 'lucide-react'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'

interface Franchise {
    id: string
    franchise_code: string
    name: string
    city: string
    state: string
    admin_name: string
    admin_email: string
    admin_phone: string
    branch_address: string
    status: 'Active' | 'Suspended' | 'Inactive'
    created_at: string
    total_customers?: number
    total_revenue?: number
}

interface CreateForm {
    name: string
    city: string
    state: string
    adminName: string
    adminEmail: string
    adminPhone: string
    branchAddress: string
    username: string
    password: string
}

const emptyForm: CreateForm = {
    name: '', city: '', state: '', adminName: '', adminEmail: '',
    adminPhone: '', branchAddress: '', username: '', password: ''
}

const genPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!'
    return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function FranchiseManagement() {
    const navigate      = useNavigate()
    const { isSuperAdmin } = useAuth()


    const [franchises, setFranchises]   = useState<Franchise[]>([])
    const [loading, setLoading]         = useState(true)
    const [search,  setSearch]          = useState('')
    const [showCreate, setShowCreate]   = useState(false)
    const [form,    setForm]            = useState<CreateForm>(emptyForm)
    const [saving,  setSaving]          = useState(false)
    const [error,   setError]           = useState('')
    const [success, setSuccess]         = useState('')
    const [copiedPwd, setCopiedPwd]     = useState(false)
    const [confirmSuspend, setConfirmSuspend] = useState<Franchise | null>(null)
    const [resetFranchise, setResetFranchise] = useState<Franchise | null>(null)
    const [resetPwd, setResetPwd]       = useState('')

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const data = await api('GET', '/api/franchises', undefined, true)
            setFranchises(Array.isArray(data) ? data : [])
        } catch (e: any) {
            setError(e.message)
        } finally { setLoading(false) }
    }, [])

    useEffect(() => { load() }, [load])

    if (!isSuperAdmin()) return (
        <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>
            Access denied. Super Admin only.
        </div>
    )

    const filtered = franchises.filter(f =>
        f.name?.toLowerCase().includes(search.toLowerCase()) ||
        f.franchise_code?.toLowerCase().includes(search.toLowerCase()) ||
        f.city?.toLowerCase().includes(search.toLowerCase())
    )

    const handleCreate = async () => {
        if (!form.name || !form.adminEmail || !form.username || !form.password) {
            setError('Name, Admin Email, Username and Password are required.')
            return
        }
        setSaving(true)
        setError('')
        try {
            await api('POST', '/api/franchises', form, true)
            setSuccess(`Franchise "${form.name}" created successfully!`)
            setShowCreate(false)
            setForm(emptyForm)
            load()
        } catch (e: any) {
            setError(e.message || 'Failed to create franchise')
        } finally { setSaving(false) }
    }

    const handleToggleStatus = async (fr: Franchise) => {
        if (fr.status === 'Active') {
            setConfirmSuspend(fr)
        } else {
            await api('POST', `/api/franchises/${fr.id}/activate`, {}, true)
            setSuccess(`${fr.name} activated.`)
            load()
        }
    }

    const handleSuspendConfirm = async () => {
        if (!confirmSuspend) return
        await api('POST', `/api/franchises/${confirmSuspend.id}/suspend`, {}, true)
        setSuccess(`${confirmSuspend.name} suspended.`)
        setConfirmSuspend(null)
        load()
    }

    const handleResetPassword = async () => {
        if (!resetFranchise || !resetPwd) return
        setSaving(true)
        try {
            await api('POST', `/api/franchises/${resetFranchise.id}/reset-password`, { newPassword: resetPwd }, true)
            setSuccess(`Password reset for ${resetFranchise.name} successfully.`)
            setResetFranchise(null)
            setResetPwd('')
        } catch (e: any) {
            setError(e.message || 'Failed to reset password')
        } finally { setSaving(false) }
    }

    const copyPassword = async (pwd: string) => {
        await navigator.clipboard.writeText(pwd)
        setCopiedPwd(true)
        setTimeout(() => setCopiedPwd(false), 2000)
    }

    return (
        <div style={{ padding: '24px', fontFamily: "'Inter', sans-serif" }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                        <ChevronLeft size={16} /> Dashboard
                    </button>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Building2 size={22} color="#6366f1" />
                            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-primary, #1e293b)' }}>Franchise Management</h1>
                        </div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                            {franchises.length} franchise{franchises.length !== 1 ? 's' : ''} registered
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => { setShowCreate(true); setForm({ ...emptyForm, password: genPassword() }) }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
                >
                    <Plus size={16} /> Create Franchise
                </button>
            </div>

            {/* Alerts */}
            {success && (
                <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid #6ee7b7', borderRadius: '8px', padding: '10px 16px', marginBottom: '16px', color: '#065f46', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <CheckCircle size={14} color="#10b981" /> {success}
                    <button onClick={() => setSuccess('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#10b981' }}><X size={14} /></button>
                </div>
            )}
            {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 16px', marginBottom: '16px', color: '#dc2626', fontSize: '13px' }}>
                    {error} <button onClick={() => setError('')} style={{ marginLeft: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}><X size={14} /></button>
                </div>
            )}

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: '20px', maxWidth: '360px' }}>
                <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                    type="text"
                    placeholder="Search by name, code or city…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px 9px 36px', border: '1px solid var(--border, #e2e8f0)', borderRadius: '8px', background: 'var(--card, #fff)', fontSize: '13px', outline: 'none', color: 'var(--text-primary, #1e293b)', boxSizing: 'border-box' }}
                />
            </div>

            {/* Franchise Cards Grid */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>Loading franchises…</div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
                    <Building2 size={40} color="#e2e8f0" />
                    <div style={{ marginTop: '16px', fontSize: '16px', fontWeight: 600 }}>No franchises yet</div>
                    <div style={{ marginTop: '4px', fontSize: '13px' }}>Create your first franchise to get started.</div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
                    {filtered.map(fr => (
                        <div key={fr.id} style={{
                            background: 'var(--card, #fff)', border: '1px solid var(--border, #e2e8f0)',
                            borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                            borderLeft: `4px solid ${fr.status === 'Active' ? '#10b981' : '#ef4444'}`
                        }}>
                            {/* Card Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary, #1e293b)' }}>{fr.name}</div>
                                    <div style={{ fontSize: '11px', color: '#6366f1', fontWeight: 600, marginTop: '2px' }}>{fr.franchise_code}</div>
                                </div>
                                <span style={{
                                    background: fr.status === 'Active' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                    color: fr.status === 'Active' ? '#10b981' : '#ef4444',
                                    borderRadius: '999px', padding: '3px 10px', fontSize: '11px', fontWeight: 600
                                }}>{fr.status}</span>
                            </div>

                            {/* Details */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px', fontSize: '12px', color: '#64748b' }}>
                                {fr.admin_name  && <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><User size={12} /> {fr.admin_name}</div>}
                                {fr.admin_email && <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Mail size={12} /> {fr.admin_email}</div>}
                                {fr.admin_phone && <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={12} /> {fr.admin_phone}</div>}
                                {(fr.city || fr.state) && <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={12} /> {[fr.city, fr.state].filter(Boolean).join(', ')}</div>}
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <button
                                    onClick={() => handleToggleStatus(fr)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: fr.status === 'Active' ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)', color: fr.status === 'Active' ? '#ef4444' : '#10b981', border: `1px solid ${fr.status === 'Active' ? '#fca5a5' : '#6ee7b7'}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                                >
                                    {fr.status === 'Active' ? <><ToggleRight size={13} /> Suspend</> : <><ToggleLeft size={13} /> Activate</>}
                                </button>
                                <button
                                    onClick={() => { setResetFranchise(fr); setResetPwd(genPassword()); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', background: 'rgba(99,102,241,0.08)', color: '#6366f1', border: '1px solid #c7d2fe', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                                >
                                    <Key size={13} /> Reset Pwd
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Franchise Modal */}
            {showCreate && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div style={{ background: 'var(--card, #fff)', borderRadius: '16px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                        <div style={{ padding: '24px', borderBottom: '1px solid var(--border, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Sun size={20} color="#6366f1" />
                                <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary, #1e293b)' }}>Create New Franchise</div>
                            </div>
                            <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
                        </div>

                        <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            {error && <div style={{ gridColumn: '1/-1', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px', color: '#dc2626', fontSize: '13px' }}>{error}</div>}

                            {[
                                { label: 'Franchise Name *', key: 'name',          placeholder: 'Erode Franchise' },
                                { label: 'City',             key: 'city',          placeholder: 'Erode' },
                                { label: 'State',            key: 'state',         placeholder: 'Tamil Nadu' },
                                { label: 'Admin Name',       key: 'adminName',     placeholder: 'Ravi Kumar' },
                                { label: 'Admin Email *',    key: 'adminEmail',    placeholder: 'erode@thevoltaura.com' },
                                { label: 'Admin Phone',      key: 'adminPhone',    placeholder: '+91 99999 00000' },
                            ].map(f => (
                                <div key={f.key}>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>{f.label}</label>
                                    <input
                                        type="text"
                                        placeholder={f.placeholder}
                                        value={(form as any)[f.key]}
                                        onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                                        style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border, #e2e8f0)', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'var(--card, #fff)', color: 'var(--text-primary, #1e293b)', boxSizing: 'border-box' }}
                                    />
                                </div>
                            ))}

                            <div style={{ gridColumn: '1/-1' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Branch Address</label>
                                <textarea
                                    placeholder="123 Solar Street, Erode - 638001"
                                    value={form.branchAddress}
                                    onChange={e => setForm(p => ({ ...p, branchAddress: e.target.value }))}
                                    style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border, #e2e8f0)', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'var(--card, #fff)', color: 'var(--text-primary, #1e293b)', boxSizing: 'border-box', resize: 'vertical', minHeight: '72px' }}
                                />
                            </div>

                            <div style={{ gridColumn: '1/-1', background: 'rgba(99,102,241,0.05)', border: '1px solid #c7d2fe', borderRadius: '10px', padding: '16px' }}>
                                <div style={{ fontWeight: 600, fontSize: '13px', color: '#4f46e5', marginBottom: '12px' }}>Login Credentials</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Username *</label>
                                        <input
                                            type="text"
                                            placeholder="erode@thevoltaura.com"
                                            value={form.username}
                                            onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                                            style={{ width: '100%', padding: '9px 12px', border: '1px solid #c7d2fe', borderRadius: '8px', fontSize: '13px', outline: 'none', background: '#fff', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Initial Password *</label>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <input
                                                type="text"
                                                value={form.password}
                                                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                                                style={{ flex: 1, padding: '9px 12px', border: '1px solid #c7d2fe', borderRadius: '8px', fontSize: '12px', outline: 'none', background: '#fff', fontFamily: 'monospace', boxSizing: 'border-box' }}
                                            />
                                            <button onClick={() => copyPassword(form.password)} title="Copy" style={{ padding: '9px', background: copiedPwd ? '#10b981' : '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                                                {copiedPwd ? <Check size={14} /> : <Copy size={14} />}
                                            </button>
                                            <button onClick={() => setForm(p => ({ ...p, password: genPassword() }))} title="Regenerate" style={{ padding: '9px', background: '#e0e7ff', color: '#6366f1', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                                                <RefreshCw size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border, #e2e8f0)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button onClick={() => setShowCreate(false)} style={{ padding: '9px 18px', background: 'var(--bg, #f8fafc)', border: '1px solid var(--border, #e2e8f0)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#64748b' }}>
                                Cancel
                            </button>
                            <button onClick={handleCreate} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 20px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
                                <Save size={14} /> {saving ? 'Creating…' : 'Create Franchise'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Suspend Confirm Modal */}
            {confirmSuspend && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'var(--card, #fff)', borderRadius: '12px', padding: '28px', maxWidth: '400px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ width: 40, height: 40, background: '#fef2f2', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <AlertTriangle size={20} color="#ef4444" />
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary, #1e293b)' }}>Suspend Franchise?</div>
                        </div>
                        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px', lineHeight: 1.6 }}>
                            This will immediately block all logins for <strong>{confirmSuspend.name}</strong>. Their data will remain intact.
                        </p>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setConfirmSuspend(null)} style={{ padding: '8px 16px', background: 'var(--bg, #f8fafc)', border: '1px solid var(--border, #e2e8f0)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Cancel</button>
                            <button onClick={handleSuspendConfirm} style={{ padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Suspend</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {resetFranchise && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div style={{ background: 'var(--card, #fff)', borderRadius: '12px', padding: '24px', maxWidth: '400px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                        <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary, #1e293b)', marginBottom: '16px' }}>Reset Password</div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>Generate a new secure password for <strong>{resetFranchise.name}</strong>.</div>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>New Password</label>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <input
                                    type="text"
                                    value={resetPwd}
                                    onChange={e => setResetPwd(e.target.value)}
                                    style={{ flex: 1, padding: '9px 12px', border: '1px solid #c7d2fe', borderRadius: '8px', fontSize: '12px', outline: 'none', background: '#fff', fontFamily: 'monospace', boxSizing: 'border-box' }}
                                />
                                <button onClick={() => copyPassword(resetPwd)} title="Copy" style={{ padding: '9px', background: copiedPwd ? '#10b981' : '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                                    {copiedPwd ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                                <button onClick={() => setResetPwd(genPassword())} title="Regenerate" style={{ padding: '9px', background: '#e0e7ff', color: '#6366f1', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                                    <RefreshCw size={14} />
                                </button>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button onClick={() => { setResetFranchise(null); setResetPwd(''); }} style={{ padding: '8px 16px', background: 'var(--bg, #f8fafc)', border: '1px solid var(--border, #e2e8f0)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Cancel</button>
                            <button onClick={handleResetPassword} disabled={saving} style={{ padding: '8px 16px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>{saving ? 'Resetting…' : 'Reset Password'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
