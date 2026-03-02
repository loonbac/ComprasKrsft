import { createPortal } from 'react-dom';

/**
 * Modal — HyperUI-aligned portal modal.
 * Supports floating/drawer mode for bottom-right positioning.
 */
export default function Modal({
    open,
    onClose,
    title,
    titleIcon,
    children,
    footer,
    size = 'md',
    position = 'center', // 'center' or 'bottom-right'
}) {
    if (!open) return null;

    const widths = {
        sm: 'max-w-sm',
        md: 'max-w-lg',
        lg: 'max-w-3xl',
        xl: 'max-w-5xl',
    };

    // Determine container classes based on position
    const containerClass = position === 'bottom-right'
        ? 'fixed bottom-4 right-4 z-50 flex items-end justify-end p-4 backdrop-blur-sm'
        : 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25';

    // Determine dialog classes based on position
    const dialogClass = position === 'bottom-right'
        ? `w-full ${widths[size] || 'max-w-lg'} max-h-[80vh] flex flex-col rounded-lg bg-white shadow-2xl border-2 border-gray-200`
        : `w-full ${widths[size]} max-h-[90vh] flex flex-col rounded-lg bg-white shadow-2xl border-2 border-gray-200`;

    return createPortal(
        <div
            className={containerClass}
            onClick={position === 'center' ? onClose : undefined}
        >
            <div
                className={dialogClass}
                onClick={(e) => e.stopPropagation()}
            >
                {title && (
                    <div className="flex items-center border-b border-gray-100 px-6 py-4 shrink-0">
                        <h2 className="flex items-center gap-2 text-lg font-medium text-gray-900">
                            {titleIcon}
                            {title}
                        </h2>
                    </div>
                )}
                <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
                {footer && (
                    <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 shrink-0">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
