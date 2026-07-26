import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Sun } from 'lucide-react'

export default function PageLoader() {
    const location = useLocation()
    const [loading, setLoading] = useState(false)
    const [progress, setProgress] = useState(0)

    const [apiLoading, setApiLoading] = useState(false)

    useEffect(() => {
        const handleApi = (e: any) => setApiLoading(e.detail)
        window.addEventListener('global-loader', handleApi)
        return () => window.removeEventListener('global-loader', handleApi)
    }, [])

    useEffect(() => {
        setLoading(true)
        setProgress(10)

        const t1 = setTimeout(() => setProgress(40), 80)
        const t2 = setTimeout(() => setProgress(70), 200)
        const t3 = setTimeout(() => setProgress(90), 350)
        const t4 = setTimeout(() => {
            setProgress(100)
            const t5 = setTimeout(() => {
                setLoading(false)
                setProgress(0)
            }, 250)
            return () => clearTimeout(t5)
        }, 500)

        return () => {
            clearTimeout(t1)
            clearTimeout(t2)
            clearTimeout(t3)
            clearTimeout(t4)
        }
    }, [location.pathname])

    if (!loading && progress === 0 && !apiLoading) return null

    return (
        <>
            {/* Top progress bar */}
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    zIndex: 99999,
                    background: 'rgba(255,255,255,0.1)',
                }}
            >
                <div
                    style={{
                        height: '100%',
                        width: `${progress}%`,
                        background: 'linear-gradient(90deg, #f97316, #fb923c, #fdba74)',
                        borderRadius: '0 3px 3px 0',
                        transition: progress === 100 ? 'width 0.15s ease-out, opacity 0.3s ease' : 'width 0.3s ease-out',
                        opacity: progress === 100 ? 0 : 1,
                        boxShadow: '0 0 10px rgba(249, 115, 22, 0.7), 0 0 5px rgba(249, 115, 22, 0.5)',
                    }}
                />
            </div>

            {/* Overlay with spinner — shows only briefly on first paint or API calls */}
            {(loading && progress < 90) || apiLoading ? (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 99998,
                        background: 'rgba(15, 23, 42, 0.35)',
                        backdropFilter: 'blur(2px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        animation: 'loaderFadeIn 0.15s ease',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '16px',
                        }}
                    >
                        {/* Zoho-style ring spinner with icon */}
                        <div style={{ position: 'relative', width: 64, height: 64 }}>
                            {/* Outer spinning ring */}
                            <div
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    borderRadius: '50%',
                                    border: '3px solid transparent',
                                    borderTopColor: '#f97316',
                                    borderRightColor: '#fb923c',
                                    animation: 'loaderSpin 0.8s linear infinite',
                                }}
                            />
                            {/* Inner counter-spinning ring */}
                            <div
                                style={{
                                    position: 'absolute',
                                    inset: '10px',
                                    borderRadius: '50%',
                                    border: '2px solid transparent',
                                    borderBottomColor: 'rgba(249, 115, 22, 0.4)',
                                    animation: 'loaderSpinReverse 1.2s linear infinite',
                                }}
                            />
                            {/* Center icon */}
                            <div
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Sun size={20} color="#f97316" style={{ animation: 'loaderPulse 1.5s ease-in-out infinite' }} />
                            </div>
                        </div>

                        {/* Loading text with animated dots */}
                        <div
                            style={{
                                color: '#fff',
                                fontSize: '13px',
                                fontWeight: 500,
                                letterSpacing: '0.05em',
                                opacity: 0.85,
                            }}
                        >
                            Loading<span style={{ animation: 'loaderDots 1.2s steps(4, end) infinite' }}>...</span>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    )
}
