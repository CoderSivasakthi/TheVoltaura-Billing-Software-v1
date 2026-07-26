import { useState, useRef } from 'react'
import { UploadCloud, FileText, CheckCircle, AlertTriangle, Trash2, RefreshCw } from 'lucide-react'

interface DocumentUploaderProps {
    id?: string
    title: string
    acceptedFormats: string
    value: any
    onChange: (doc: any) => void
}

export default function DocumentUploader({ title, acceptedFormats, value, onChange }: DocumentUploaderProps) {
    const [isUploading] = useState(false)
    const [error, setError] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setError('')
        // Pass the raw File object to parent. Parent handles upload on Complete Now.
        onChange(file)
    }

    const handleDelete = () => {
        onChange(null)
    }

    const triggerUpload = () => {
        fileInputRef.current?.click()
    }

    return (
        <div className="card p-3" style={{ border: '1px solid #ddd', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>{title}</h4>
                    <span style={{ fontSize: '12px', color: '#666' }}>{acceptedFormats}</span>
                </div>
                <div>
                    {value instanceof File ? (
                        <span className="badge badge-info" style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#e0f2fe', color: '#0369a1' }}>
                            <CheckCircle size={14} /> Selected
                        </span>
                    ) : value ? (
                        <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle size={14} /> Uploaded
                        </span>
                    ) : (
                        <span className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#fff3cd', color: '#856404' }}>
                            <AlertTriangle size={14} /> Pending
                        </span>
                    )}
                </div>
            </div>

            {value ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                    {value.type?.includes('pdf') ? (
                        <FileText size={32} color="#dc3545" />
                    ) : value.type?.includes('image') ? (
                        <img src={value instanceof File ? URL.createObjectURL(value) : value.url} alt={value.name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                    ) : (
                        <FileText size={32} color="#007bff" />
                    )}
                    
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{value.name}</div>
                        <div style={{ fontSize: '11px', color: '#666' }}>{value instanceof File ? 'Pending Upload' : new Date(value.uploadedAt).toLocaleString()}</div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={triggerUpload} className="btn btn-sm btn-outline" title="Replace">
                            <RefreshCw size={14} />
                        </button>
                        <button onClick={handleDelete} className="btn btn-sm btn-outline" style={{ color: '#dc3545', borderColor: '#dc3545' }} title="Delete">
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
            ) : (
                <div 
                    onClick={triggerUpload}
                    style={{ 
                        border: '2px dashed #ccc', 
                        padding: '20px', 
                        textAlign: 'center', 
                        borderRadius: '4px', 
                        cursor: 'pointer',
                        backgroundColor: isUploading ? '#f8f9fa' : 'transparent'
                    }}
                >
                    {isUploading ? (
                        <div style={{ fontSize: '13px', color: '#007bff' }}>Uploading...</div>
                    ) : (
                        <>
                            <UploadCloud size={24} color="#666" style={{ margin: '0 auto 8px' }} />
                            <div style={{ fontSize: '13px', color: '#666' }}>Click or drag file to upload</div>
                            {error && <div style={{ fontSize: '12px', color: '#dc3545', marginTop: '4px' }}>{error}</div>}
                        </>
                    )}
                </div>
            )}

            <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleFileSelect}
                accept={acceptedFormats.includes('PDF') ? '.pdf,.jpg,.jpeg,.png' : '.jpg,.jpeg,.png'}
            />
        </div>
    )
}
