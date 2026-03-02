import { useEffect, useState } from 'react';

/**
 * Toast – HyperUI-aligned notification (self-contained for compras module).
 */
export default function Toast({ show, message, type = 'success', duration = 4000, onHide }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (show) {
            setVisible(true);
            const t = setTimeout(() => { setVisible(false); onHide?.(); }, duration);
            return () => clearTimeout(t);
        }
        setVisible(false);
    }, [show, duration, onHide]);

    if (!visible) return null;

    const colors = {
        success: 'border-emerald-500 bg-emerald-50 text-emerald-700',
        error:   'border-red-500 bg-red-50 text-red-700',
        warning: 'border-amber-500 bg-amber-50 text-amber-700',
        info:    'border-blue-500 bg-blue-50 text-blue-700',
    };

    return (
        <div className="fixed bottom-6 right-6 z-[100] animate-[slideUp_0.3s_ease-out]">
            <div
                role="alert"
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg ${colors[type] || colors.success}`}
            >
                {type === 'success' && (
                    <svg className="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                )}
                {type === 'error' && (
                    <svg className="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                )}
                <p className="text-sm font-medium">{message}</p>
            </div>
        </div>
    );
}
