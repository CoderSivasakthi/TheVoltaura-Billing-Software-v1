import { useState, useEffect, useRef } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
    Sun, LayoutDashboard, Users, FileText, Receipt, CreditCard, Package,
    Wrench, BarChart2, Settings as SettingsIcon, HelpCircle, LogOut,
    Menu, Search, Bell, X, Phone, Mail, MessageCircle, Flag, Activity,
    Building2, CheckSquare, Crown, ShieldCheck
} from 'lucide-react'
import { avColor, avInitials, api } from '../services/api'
import { t } from '../i18n'
import { useSettings } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
    const navigate = useNavigate()
    const location = useLocation()
    const { settings, updateSettings } = useSettings()
    const auth = useAuth()
    const isAdmin = auth.isSuperAdmin()
    const franchiseName = auth.user?.franchise_name || localStorage.getItem('sf_franchise_name') || null
    const franchiseId   = auth.user?.franchise_id   || localStorage.getItem('sf_franchise_id')   || null

    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [notifOpen, setNotifOpen] = useState(false)
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [supportOpen, setSupportOpen] = useState(false)
    const [pendingApprovals, setPendingApprovals] = useState(0)

    const [sdOrgName, setSdOrgName] = useState('TheVoltaura Private ltd')
    const [sdOrgGst, setSdOrgGst] = useState('33AAAA0000A1Z5')
    const [sdOrgEmail, setSdOrgEmail] = useState('contact@thevoltaura.com')
    const [sdOrgPhone, setSdOrgPhone] = useState('+91 99999 00000')
    const [sdLowStock, setSdLowStock] = useState(true)
    const [sdOverdueAlert, setSdOverdueAlert] = useState(true)
    const [sdAmcAlert, setSdAmcAlert] = useState(true)

    useEffect(() => {
        if (settings) {
            setSdOrgName(settings.orgName || 'TheVoltaura Private ltd')
            setSdOrgGst(settings.branches?.[0]?.gst || '33AAAA0000A1Z5')
            setSdOrgEmail(settings.email || 'contact@thevoltaura.com')
            setSdOrgPhone(settings.phone || '+91 99999 00000')
            setSdLowStock(settings.lowStock ?? true)
            setSdOverdueAlert(settings.overdueAlert ?? true)
            setSdAmcAlert(settings.amcAlert ?? true)
        }
    }, [settings])

    // Load pending approvals count for Super Admin
    useEffect(() => {
        if (!isAdmin) return
        const load = async () => {
            try {
                const data = await api('GET', '/api/approvals/pending', undefined, true)
                setPendingApprovals(data?.total || 0)
            } catch {}
        }
        load()
        const iv = setInterval(load, 30000)
        return () => clearInterval(iv)
    }, [isAdmin])

    useEffect(() => {
        const handleAuthExpired = () => {
            auth.logout();
            navigate('/login');
        };
        window.addEventListener('auth-expired', handleAuthExpired);
        return () => window.removeEventListener('auth-expired', handleAuthExpired);
    }, [auth, navigate]);

    // Close sidebar on route change (mobile/tablet UX)
    useEffect(() => {
        setSidebarOpen(false);
    }, [location.pathname]);

    // Prevent accidental wheel-scroll on number inputs (Qty, Price, etc.)
    useEffect(() => {
        const handler = (e: WheelEvent) => {
            const target = e.target as HTMLElement;
            if (target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'number') {
                (target as HTMLInputElement).blur();
            }
        };
        document.addEventListener('wheel', handler, { passive: true });
        return () => document.removeEventListener('wheel', handler);
    }, []);

    const [suppTab, setSuppTab] = useState('faq')
    const [faqExpanded, setFaqExpanded] = useState(false)
    const [fontSize, setFontSize] = useState(localStorage.getItem('sf_fontSize') || 'md')
    const [lang, setLang] = useState(localStorage.getItem('sf_lang') || 'en')
    const [fontOpen, setFontOpen] = useState(false)
    const [langOpen, setLangOpen] = useState(false)
    const [notifications, setNotifications] = useState<Array<any>>([])
    const notifRef = useRef<HTMLDivElement>(null)
    const fontRef = useRef<HTMLDivElement>(null)
    const langRef = useRef<HTMLDivElement>(null)

    const [userName, setUserName] = useState(localStorage.getItem('sf_user') || 'TheVoltaura Admin')
    const [userRole, setUserRole] = useState(localStorage.getItem('sf_role') || 'Administrator')
    const currentPage = location.pathname.split('/')[1] || 'dashboard'

    // Sidebar nav items — common for all roles
    const navItems = [
        { page: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { page: 'customers', icon: Users, label: 'Customers' },
        { page: 'quotations', icon: FileText, label: 'Quotations' },
        { page: 'invoices', icon: Receipt, label: 'Invoices' },
        { page: 'payments', icon: CreditCard, label: 'Payments' },
        { page: 'products', icon: Package, label: 'Products' },
    ]
    // Operations — shown to all
    const opsItems = [
        { page: 'amc', icon: Wrench, label: 'AMC Contracts' },
        { page: 'priority-orders', icon: Flag, label: 'Priority Orders' },
        { page: 'reports', icon: BarChart2, label: 'Reports' },
        { page: 'settings', icon: SettingsIcon, label: 'Settings' },
        ...(isAdmin ? [{ page: 'system-diagnostics', icon: Activity, label: 'System Diagnostics' }] : []),
    ]
    // Administration — Super Admin only
    const adminItems = isAdmin ? [
        { page: 'administration/franchises', icon: Building2, label: 'Franchise Management' },
        { page: 'approvals', icon: CheckSquare, label: `Approvals${pendingApprovals > 0 ? ` (${pendingApprovals})` : ''}`, badge: pendingApprovals },
    ] : []

    useEffect(() => {
        document.documentElement.className = `font-${fontSize}`
    }, [fontSize])

    const loadNotifications = async () => {
        try {
            const data = await api('GET', '/api/notifications', undefined, true);
            setNotifications(data || []);
        } catch (e) { console.error(e) }
    }

    useEffect(() => {
        loadNotifications();
        const intv = setInterval(loadNotifications, 30000);
        return () => clearInterval(intv);
    }, [])

    const unreadCount = notifications.filter(n => !n.read).length;

    const handleNotifClick = async (n: any) => {
        setNotifOpen(false);
        if (!n.read) {
            try {
                await api('PUT', `/api/notifications/read/${n.id}`, {});
                loadNotifications();
            } catch (e) { }
        }
        if (n.link) navigate(n.link);
    }

    const handleMarkAllRead = async () => {
        try {
            await api('PUT', '/api/notifications/read-all', {});
            loadNotifications();
        } catch (e) { }
    }

    // Refresh context if necessary, but context state manages settings.
    useEffect(() => {
        const u = localStorage.getItem('sf_user')
        if (u) setUserName(u)
        const r = localStorage.getItem('sf_role')
        if (r) setUserRole(r)
    }, [])

    const companyLogo = settings?.logo || ''
    const companyName = settings?.orgName || 'TheVoltaura'

    // Close panels on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
            if (fontRef.current && !fontRef.current.contains(e.target as Node)) setFontOpen(false)
            if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.altKey && e.key === 'd') { e.preventDefault(); navigate('/dashboard') }
            if (e.altKey && e.key === 'c') { e.preventDefault(); navigate('/customers') }
            if (e.altKey && e.key === 'i') { e.preventDefault(); navigate('/create-invoice') }
            if (e.altKey && e.key === 'q') { e.preventDefault(); navigate('/create-quotation') }
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault()
                document.getElementById('globalSearch')?.focus()
            }
            if (e.key === 'Escape') {
                setSupportOpen(false)
                setSettingsOpen(false)
                setSidebarOpen(false)
            }
        }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [navigate])

    const handleLogout = () => {
        auth.logout()
        navigate('/login')
    }

    const handleFontSize = (size: string) => {
        setFontSize(size)
        localStorage.setItem('sf_fontSize', size)
        setFontOpen(false)
    }

    const handleLanguage = (l: string) => {
        localStorage.setItem('sf_lang', l)
        setLang(l)
        setLangOpen(false)
        window.location.reload(); // Quick explicit repaint strategy to cascade translation keys without complex context wiring
    }

    const saveSettings = async () => {
        localStorage.setItem('sf_fontSize', fontSize)
        localStorage.setItem('sf_lang', lang)

        if (settings && updateSettings) {
            const updatedBranches = [...(settings.branches || [])];
            if (updatedBranches.length > 0) {
                updatedBranches[0] = { ...updatedBranches[0], gst: sdOrgGst };
            }
            try {
                await updateSettings({
                    ...settings,
                    orgName: sdOrgName,
                    email: sdOrgEmail,
                    phone: sdOrgPhone,
                    lowStock: sdLowStock,
                    overdueAlert: sdOverdueAlert,
                    amcAlert: sdAmcAlert,
                    branches: updatedBranches
                });
            } catch (e) {
                console.error("Failed to save settings", e);
            }
        }

        setSettingsOpen(false)
        window.location.reload()
    }

    return (
        <div className="app">
            {/* ══════════════ SIDEBAR ══════════════ */}
            <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} id="sidebar">
                <div className="sb-logo" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {companyLogo ? (
                        <img src={companyLogo} alt="Company Logo" style={{ height: '32px', width: 'auto', objectFit: 'contain' }} />
                    ) : (
                        <div className="li"><Sun size={18} color="#fff" /></div>
                    )}
                    <div>
                        <div className="ln">{companyName.split(' ')[0]} {companyName.includes(' ') ? companyName.split(' ')[1] : ''}</div>
                        <div className="ls" style={{ fontSize: '10px' }}>{t('Billing Accounts')}</div>
                    </div>
                </div>
                <div className="sb-user">
                    <div className={`av ${avColor(userName)}`} id="sbAvatar">{avInitials(userName)}</div>
                    <div>
                        <div className="un" id="sbUserName">{userName}</div>
                        <div className="ur">
                            {isAdmin
                                ? <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Crown size={11} color="#f59e0b" /> Head Office</span>
                                : franchiseName || userRole
                            }
                        </div>
                        {!isAdmin && franchiseId && (
                            <div style={{ fontSize: '10px', color: '#a78bfa', marginTop: '2px', fontWeight: 600 }}>{franchiseId}</div>
                        )}
                    </div>
                </div>
                <nav className="sb-nav">
                    <div className="sb-sec">{t('Menu')}</div>
                    {navItems.map(item => (
                        <button
                            key={item.page}
                            className={`nav-it ${currentPage === item.page ? 'active' : ''}`}
                            onClick={() => navigate(`/${item.page}`)}
                        >
                            <item.icon className="ni" />
                            {t(item.label)}
                        </button>
                    ))}
                    <div className="sb-sec">{t('Operations')}</div>
                    {opsItems.map(item => (
                        <button
                            key={item.page}
                            className={`nav-it ${currentPage === item.page || location.pathname.startsWith(`/${item.page}`) ? 'active' : ''}`}
                            onClick={() => navigate(`/${item.page}`)}
                        >
                            <item.icon className="ni" />
                            {t(item.label)}
                        </button>
                    ))}
                    {adminItems.length > 0 && (
                        <>
                            <div className="sb-sec" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <ShieldCheck size={12} color="#f59e0b" /> {t('Administration')}
                            </div>
                            {adminItems.map(item => (
                                <button
                                    key={item.page}
                                    className={`nav-it ${location.pathname.startsWith(`/${item.page.split('/')[0]}`) ? 'active' : ''}`}
                                    onClick={() => navigate(`/${item.page}`)}
                                    style={{ position: 'relative' }}
                                >
                                    <item.icon className="ni" />
                                    {t(item.label.replace(/ \(\d+\)/, ''))}
                                    {(item as any).badge > 0 && (
                                        <span style={{
                                            position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                                            background: '#ef4444', color: '#fff', borderRadius: '999px',
                                            fontSize: '10px', fontWeight: 700, minWidth: '18px', height: '18px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px'
                                        }}>{(item as any).badge}</span>
                                    )}
                                </button>
                            ))}
                        </>
                    )}
                </nav>
                <div className="sb-footer">
                    <div className="brand-credits">
                        <div className="copyright">&copy; {new Date().getFullYear()} {companyName}</div>
                        <div className="developer">Developed by <span className="dv-name">AmarLogicLabs</span></div>
                    </div>
                    <button className="nav-it" onClick={() => setSupportOpen(true)}>
                        <HelpCircle className="ni" />Help &amp; Support
                    </button>
                    <button className="nav-it" id="logoutBtn" onClick={handleLogout}>
                        <LogOut className="ni" />Log Out
                    </button>
                </div>
            </aside>
            {/* Sidebar overlay for mobile */}
            <div className={`sb-overlay ${sidebarOpen ? 'open' : ''}`} id="sbOverlay" onClick={() => setSidebarOpen(false)}></div>

            {/* ══════════════ MAIN ══════════════ */}
            <div className="main">
                {/* TOPBAR */}
                <header className="topbar">
                    <button className="sb-toggle" id="sidebarToggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
                        <Menu />
                    </button>
                    <div className="tb-brand" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {companyLogo ? (
                            <img src={companyLogo} alt="Company Logo" style={{ height: '24px', width: 'auto', objectFit: 'contain' }} />
                        ) : (
                            <div className="ti"><Sun size={16} color="#fff" /></div>
                        )}
                        <span className="tn">{companyName.split(' ')[0]} {companyName.includes(' ') ? companyName.split(' ')[1] : ''}</span>
                    </div>
                    <div className="tb-search">
                        <Search className="si" />
                        <input type="text" id="globalSearch" placeholder={t("Search customers, quotes, invoices...")} />
                    </div>
                    <div className="tb-right">
                        <button
                            className="tb-icon-btn"
                            title="System Health"
                            onClick={() => navigate('/system-health')}
                            style={{ position: 'relative' }}
                        >
                            <Activity size={18} />
                            <span style={{
                                position: 'absolute', top: 6, right: 6,
                                width: 8, height: 8, borderRadius: '50%',
                                background: '#22c55e',
                                border: '2px solid #fff',
                            }} />
                        </button>
                        <div style={{ position: 'relative' }} ref={notifRef}>
                            <button
                                className="tb-icon-btn"
                                id="notifBtn"
                                title="Notifications"
                                onClick={() => { setNotifOpen(!notifOpen); setFontOpen(false); setLangOpen(false); }}
                            >
                                <Bell />
                                {unreadCount > 0 && (
                                    <div style={{
                                        position: 'absolute', top: 4, right: 4,
                                        background: '#ef4444', color: '#fff', fontSize: '10px',
                                        fontWeight: 800, minWidth: 16, height: 16, borderRadius: 8,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px #fff'
                                    }}>
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </div>
                                )}
                            </button>
                            {notifOpen && (
                                <div className="notif-panel open" id="notifPanel" style={{ display: 'block' }}>
                                    <div className="notif-hdr">
                                        <span className="notif-title">{t('Notifications')}</span>
                                        {unreadCount > 0 && <button className="notif-clear" onClick={handleMarkAllRead}>{t('Mark all read')}</button>}
                                    </div>
                                    <div id="notifList" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                                        {notifications.length === 0 && (
                                            <div style={{ padding: '20px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>
                                                {t('No notifications')}
                                            </div>
                                        )}
                                        {notifications.map(n => (
                                            <div key={n.id} className={`notif-item notif-${n.type} ${!n.read ? 'unread' : ''}`} onClick={() => handleNotifClick(n)} style={{ cursor: 'pointer', opacity: n.read ? 0.6 : 1 }}>
                                                <div className="notif-item-title" style={{ fontWeight: n.read ? 500 : 700 }}>{n.title}</div>
                                                <div className="notif-item-desc">{n.desc}</div>
                                                <div className="notif-item-time">{new Date(n.createdAt).toLocaleString()}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Font Size Selector */}
                        <div style={{ position: 'relative' }} ref={fontRef}>
                            <button className="tb-icon-btn" title="Font Size" onClick={() => { setFontOpen(!fontOpen); setLangOpen(false); setNotifOpen(false); }}>
                                <span style={{ fontWeight: 800, fontSize: '16px' }}>A</span>
                            </button>
                            {fontOpen && (
                                <div className="notif-panel open" style={{ display: 'block', width: '150px', right: '-10px', left: 'auto', padding: '10px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                        <button className={`nav-it ${fontSize === 'sm' ? 'active' : ''}`} onClick={() => handleFontSize('sm')}>A- <span style={{ fontSize: '11px', marginLeft: 'auto' }}>(Small)</span></button>
                                        <button className={`nav-it ${fontSize === 'md' ? 'active' : ''}`} onClick={() => handleFontSize('md')}>A <span style={{ fontSize: '11px', marginLeft: 'auto' }}>(Normal)</span></button>
                                        <button className={`nav-it ${fontSize === 'lg' ? 'active' : ''}`} onClick={() => handleFontSize('lg')}>A+ <span style={{ fontSize: '11px', marginLeft: 'auto' }}>(Large)</span></button>
                                        <button className={`nav-it ${fontSize === 'xl' ? 'active' : ''}`} onClick={() => handleFontSize('xl')}>AXL <span style={{ fontSize: '11px', marginLeft: 'auto' }}>(X-Large)</span></button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Language Selector */}
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }} ref={langRef}>
                            <button className="btn btn-secondary" style={{ padding: '6px 12px', height: '36px' }} onClick={() => { setLangOpen(!langOpen); setFontOpen(false); setNotifOpen(false); }}>
                                {lang === 'en' ? 'English' : lang === 'ta' ? 'Tamil' : 'Hindi'} ▼
                            </button>
                            {langOpen && (
                                <div className="notif-panel open" style={{ display: 'block', width: '130px', right: '0px', left: 'auto', padding: '10px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                        <button className={`nav-it ${lang === 'en' ? 'active' : ''}`} onClick={() => handleLanguage('en')}>English</button>
                                        <button className={`nav-it ${lang === 'ta' ? 'active' : ''}`} onClick={() => handleLanguage('ta')}>Tamil</button>
                                        <button className={`nav-it ${lang === 'hi' ? 'active' : ''}`} onClick={() => handleLanguage('hi')}>Hindi</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="tb-sep"></div>
                        <div className="tb-user-info">
                            <div className="tun" id="tbUserName">{userName}</div>
                            <div className="tur">{userRole}</div>
                        </div>
                        <div className={`tb-avatar ${avColor(userName)}`} id="tbAvatar">{avInitials(userName)}</div>
                    </div>
                </header>

                {/* ══════════════ SETTINGS DRAWER ══════════════ */}
                <div className={`settings-drawer ${settingsOpen ? 'open' : ''}`} id="settingsDrawer">
                    <div className="sd-hdr">
                        <span className="sd-title"><SettingsIcon size={16} /> {t('Settings')}</span>
                        <button className="sd-close" id="settingsClose" onClick={() => setSettingsOpen(false)}><X /></button>
                    </div>
                    <div className="sd-body">
                        <div className="sd-sec">{t('Appearance')}</div>
                        <div className="sd-row">
                            <label className="sd-lbl">{t('Font Size')}</label>
                            <div className="fs-btns">
                                {(['sm', 'md', 'lg', 'xl'] as const).map(sz => (
                                    <button
                                        key={sz}
                                        className={`fs-btn ${fontSize === sz ? 'active' : ''}`}
                                        onClick={() => handleFontSize(sz)}
                                    >
                                        A{sz === 'sm' ? <small>-</small> : sz === 'lg' ? <small>+</small> : sz === 'xl' ? <sup>XL</sup> : null}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="sd-sec">{t('Language')}</div>
                        <div className="sd-row">
                            <label className="sd-lbl">{t('Interface Language')}</label>
                            <select className="fi" id="langSelect" style={{ maxWidth: 160 }} value={lang} onChange={e => setLang(e.target.value)}>
                                <option value="en">English</option>
                                <option value="ta">Tamil</option>
                                <option value="hi">Hindi</option>
                            </select>
                        </div>
                        <div className="sd-sec">{t('Company')}</div>
                        <div className="sd-row fd">
                            <label className="fl">{t('Company Name')}</label>
                            <input className="fi" id="sdOrgName" value={sdOrgName} onChange={e => setSdOrgName(e.target.value)} />
                        </div>
                        <div className="sd-row fd">
                            <label className="fl">{t('GST Number')}</label>
                            <input className="fi" id="sdOrgGst" value={sdOrgGst} onChange={e => setSdOrgGst(e.target.value)} />
                        </div>
                        <div className="sd-row fd">
                            <label className="fl">{t('Support Email')}</label>
                            <input className="fi" id="sdOrgEmail" type="email" value={sdOrgEmail} onChange={e => setSdOrgEmail(e.target.value)} />
                        </div>
                        <div className="sd-row fd">
                            <label className="fl">{t('Phone')}</label>
                            <input className="fi" id="sdOrgPhone" value={sdOrgPhone} onChange={e => setSdOrgPhone(e.target.value)} />
                        </div>
                        <div className="sd-sec">{t('Notifications')}</div>
                        <label className="fcheck sd-row"><input type="checkbox" checked={sdLowStock} onChange={e => setSdLowStock(e.target.checked)} /><span className="fcheck-label">{t('Low stock alerts')}</span></label>
                        <label className="fcheck sd-row"><input type="checkbox" checked={sdOverdueAlert} onChange={e => setSdOverdueAlert(e.target.checked)} /><span className="fcheck-label">{t('Overdue invoice alerts')}</span></label>
                        <label className="fcheck sd-row"><input type="checkbox" checked={sdAmcAlert} onChange={e => setSdAmcAlert(e.target.checked)} /><span className="fcheck-label">{t('AMC expiry alerts')}</span></label>
                        <button className="btn btn-primary btn-full" style={{ marginTop: 16 }} onClick={saveSettings}>{t('Save Settings')}</button>
                    </div>
                </div>
                {settingsOpen && <div className="sd-overlay" id="sdOverlay" onClick={() => setSettingsOpen(false)}></div>}

                {/* ══════════════ SUPPORT MODAL ══════════════ */}
                {supportOpen && (
                    <>
                        {/* Backdrop */}
                        <div
                            style={{
                                position: 'fixed', inset: 0,
                                background: 'rgba(0,0,0,0.45)',
                                zIndex: 1000,
                                backdropFilter: 'blur(2px)',
                            }}
                            onClick={() => setSupportOpen(false)}
                        />

                        {/* Modal */}
                        <div
                            id="supportModal"
                            style={{
                                position: 'fixed',
                                top: '50%', left: '50%',
                                transform: 'translate(-50%, -50%)',
                                zIndex: 1001,
                                width: '720px',
                                maxWidth: '92vw',
                                maxHeight: '90vh',
                                background: 'var(--g0)',
                                borderRadius: '16px',
                                boxShadow: '0 24px 60px rgba(0,0,0,0.18)',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                            }}
                        >
                            {/* Header */}
                            <div style={{
                                position: 'relative',
                                padding: '20px 56px 16px 24px',
                                borderBottom: '1px solid var(--g100)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                flexShrink: 0,
                            }}>
                                <HelpCircle size={20} color="var(--orange)" />
                                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--g900)', margin: 0 }}>
                                    {t('Help & Support')}
                                </h3>
                                {/* Close button fixed at top-right */}
                                <button
                                    onClick={() => setSupportOpen(false)}
                                    style={{
                                        position: 'absolute', top: 16, right: 16,
                                        background: 'var(--g100)', border: 'none',
                                        borderRadius: '50%', width: 32, height: 32,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', color: 'var(--g600)',
                                        transition: 'background 0.15s',
                                    }}
                                    onMouseOver={e => (e.currentTarget.style.background = 'var(--g200)')}
                                    onMouseOut={e => (e.currentTarget.style.background = 'var(--g100)')}
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Tabs */}
                            <div style={{ display: 'flex', gap: 6, padding: '14px 24px 0', flexShrink: 0 }}>
                                {(['faq', 'contact', 'shortcuts'] as const).map(tab => (
                                    <button
                                        key={tab}
                                        className={`supp-tab ${suppTab === tab ? 'active' : ''}`}
                                        onClick={() => { setSuppTab(tab); setFaqExpanded(false); }}
                                    >
                                        {tab === 'faq' ? t('FAQ') : tab === 'contact' ? t('Contact Us') : t('Shortcuts')}
                                    </button>
                                ))}
                            </div>

                            {/* Body */}
                            <div style={{ padding: '20px 24px 24px', overflowY: 'auto' }}>

                                {/* ── FAQ ── */}
                                {suppTab === 'faq' && (() => {
                                    const allFaqs = [
                                        { q: 'How do I create an invoice?', a: 'Go to Invoices → click "New Invoice" → select a customer, add products, then click Save Invoice.' },
                                        { q: 'How do I convert a quotation to invoice?', a: 'Open Quotations → click "Convert" in the Actions column, or click "Convert to Invoice" on the Create Quotation form.' },
                                        { q: 'How do I record a payment?', a: 'Open an invoice → click "Record Payment", or go to Payments → "+ Record Payment".' },
                                        { q: 'How do I export a report?', a: 'Go to Reports → click "Export Report" at the top right.' },
                                        { q: 'How to change font size?', a: 'Click the "A" icon in the top bar → choose your preferred font size.' },
                                        { q: 'How do I add a new customer?', a: 'Go to Customers → click "+ New Customer", fill in the details and save.' },
                                        { q: 'How do I manage AMC contracts?', a: 'Go to AMC Contracts in the sidebar, click "+ New Contract" to create or manage existing ones.' },
                                    ]
                                    const visible = faqExpanded ? allFaqs : allFaqs.slice(0, 4)
                                    return (
                                        <div id="suppFaq">
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                {visible.map((item, i) => (
                                                    <div key={i} style={{
                                                        background: 'var(--g50)',
                                                        border: '1px solid var(--g200)',
                                                        borderRadius: 10,
                                                        padding: '14px 16px',
                                                    }}>
                                                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--g800)', marginBottom: 5, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                                            <span style={{ color: 'var(--orange)', fontWeight: 800, fontSize: 15, lineHeight: 1, flexShrink: 0 }}>Q</span>
                                                            {item.q}
                                                        </div>
                                                        <div style={{ fontSize: 13, color: 'var(--g500)', paddingLeft: 22, lineHeight: 1.6 }}>{item.a}</div>
                                                    </div>
                                                ))}
                                            </div>
                                            {!faqExpanded && allFaqs.length > 4 && (
                                                <button
                                                    onClick={() => setFaqExpanded(true)}
                                                    style={{
                                                        marginTop: 14, width: '100%',
                                                        padding: '10px', border: '1.5px dashed var(--g300)',
                                                        borderRadius: 8, background: 'none',
                                                        color: 'var(--orange)', fontWeight: 600, fontSize: 13,
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    View More FAQs →
                                                </button>
                                            )}
                                            {faqExpanded && (
                                                <button
                                                    onClick={() => setFaqExpanded(false)}
                                                    style={{
                                                        marginTop: 14, width: '100%',
                                                        padding: '10px', border: '1.5px solid var(--g200)',
                                                        borderRadius: 8, background: 'none',
                                                        color: 'var(--g500)', fontWeight: 600, fontSize: 13,
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    ↑ Show Less
                                                </button>
                                            )}
                                        </div>
                                    )
                                })()}

                                {/* ── Contact Us ── */}
                                {suppTab === 'contact' && (
                                    <div id="suppContact" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {[
                                            { icon: <Phone size={22} color="var(--green)" />, label: 'Phone Support', sub: 'Mon–Sat, 9AM–6PM', link: 'tel:+919999900000', linkText: '+91 99999 00000' },
                                            { icon: <Mail size={22} color="var(--blue)" />, label: 'Email Support', sub: 'Response within 24 hrs', link: 'mailto:contact@thevoltaura.com', linkText: 'contact@thevoltaura.com' },
                                            { icon: <MessageCircle size={22} color="var(--green)" />, label: 'WhatsApp', sub: 'Quick chat support', link: 'https://wa.me/919999900000', linkText: 'Chat on WhatsApp', external: true },
                                        ].map((c, i) => (
                                            <div key={i} style={{
                                                display: 'flex', alignItems: 'center', gap: 16,
                                                background: 'var(--g50)', border: '1px solid var(--g200)',
                                                borderRadius: 10, padding: '16px 20px',
                                            }}>
                                                <div style={{ flexShrink: 0 }}>{c.icon}</div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--g800)', marginBottom: 2 }}>{c.label}</div>
                                                    <div style={{ fontSize: 12, color: 'var(--g400)', marginBottom: 4 }}>{c.sub}</div>
                                                    <a href={c.link} target={(c as any).external ? '_blank' : undefined}
                                                        style={{ color: 'var(--orange)', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}
                                                    >{c.linkText}</a>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* ── Shortcuts ── */}
                                {suppTab === 'shortcuts' && (
                                    <div id="suppShortcuts">
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                            {[
                                                { action: 'New Invoice', keys: ['Alt', 'I'] },
                                                { action: 'New Quotation', keys: ['Alt', 'Q'] },
                                                { action: 'Global Search', keys: ['Ctrl', 'K'] },
                                                { action: 'Go to Dashboard', keys: ['Alt', 'D'] },
                                                { action: 'Go to Customers', keys: ['Alt', 'C'] },
                                                { action: 'Close / Cancel', keys: ['Esc'] },
                                            ].map((s, i) => (
                                                <div key={i} style={{
                                                    display: 'flex', alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    background: 'var(--g50)',
                                                    border: '1px solid var(--g200)',
                                                    borderRadius: 8, padding: '12px 16px', gap: 12,
                                                }}>
                                                    <span style={{ fontSize: 13, color: 'var(--g700)', fontWeight: 500 }}>{s.action}</span>
                                                    <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                                                        {s.keys.map((k, ki) => (
                                                            <>
                                                                {ki > 0 && <span key={`plus-${ki}`} style={{ fontSize: 11, color: 'var(--g400)' }}>+</span>}
                                                                <kbd key={k} style={{
                                                                    background: 'var(--g0)', border: '1.5px solid var(--g300)',
                                                                    borderBottom: '3px solid var(--g400)',
                                                                    borderRadius: 5, padding: '2px 8px',
                                                                    fontSize: 11, fontWeight: 700,
                                                                    color: 'var(--g800)', fontFamily: 'monospace',
                                                                }}>{k}</kbd>
                                                            </>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                            </div>
                        </div>
                    </>
                )}


                <div className="page-area">
                    <Outlet />
                </div>
            </div>
        </div>
    )
}
