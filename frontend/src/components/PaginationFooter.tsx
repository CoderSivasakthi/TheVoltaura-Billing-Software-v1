import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
    page: number
    totalPages: number
    totalResults: number
    pageStart: number
    pageEnd: number
    onPage: (p: number) => void
}

export function PaginationFooter({ page, totalPages, totalResults, pageStart, pageEnd, onPage }: PaginationProps) {
    if (totalResults === 0) return (
        <div className="tf" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end' }}>
            <div className="tf-info">No results</div>
        </div>
    )
    return (
        <div className="tf" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => onPage(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, height: 32, padding: '0 10px', fontSize: 13, borderRadius: 6 }}
                >
                    <ChevronLeft size={14} /> Previous
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    // Show pages near current
                    const pg = totalPages <= 7 ? i + 1 : Math.max(1, Math.min(page - 3, totalPages - 6)) + i
                    return (
                        <button
                            key={pg}
                            onClick={() => onPage(pg)}
                            style={{
                                minWidth: 32,
                                height: 32,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '0 8px',
                                background: pg === page ? 'var(--brand, #F59E0B)' : '#fff',
                                color: pg === page ? '#fff' : 'var(--g700)',
                                border: '1px solid',
                                borderColor: pg === page ? 'var(--brand, #F59E0B)' : 'var(--g200)',
                                borderRadius: 6,
                                fontWeight: pg === page ? 600 : 500,
                                cursor: 'pointer',
                                fontSize: 13,
                                transition: 'all 0.15s'
                            }}
                        >
                            {pg}
                        </button>
                    )
                })}
                <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => onPage(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, height: 32, padding: '0 10px', fontSize: 13, borderRadius: 6 }}
                >
                    Next <ChevronRight size={14} />
                </button>
            </div>
            <div className="tf-info" style={{ color: 'var(--g500)', fontSize: 13 }}>
                Showing {totalResults === 0 ? 0 : pageStart + 1} to {pageEnd} of {totalResults} results
            </div>
        </div>
    )
}

export function usePagination(total: number, pageSize = 10) {
    return { totalPages: Math.max(1, Math.ceil(total / pageSize)), pageSize }
}
