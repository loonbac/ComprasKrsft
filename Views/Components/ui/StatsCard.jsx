import clsx from 'clsx';

/**
 * StatsCard — compact version.
 */
export default function StatsCard({
    title,
    value,
    icon,
    iconBg = 'bg-blue-100',
    iconColor = 'text-blue-600',
    className = '',
    action,
}) {
    return (
        <article
            className={clsx(
                'flex items-center gap-2.5 rounded-lg border border-gray-100 bg-white px-4 py-3 min-w-0 w-full max-w-full',
                className,
            )}
        >
            <span className={clsx('rounded-full p-2.5 flex-shrink-0 flex items-center justify-center', iconBg, iconColor, '[&>svg]:size-5 [&>svg]:flex-shrink-0')}>
                {icon}
            </span>
            <div className="min-w-0 flex-1 overflow-hidden">
                <p className="text-base font-semibold text-gray-900 truncate whitespace-nowrap leading-tight">{value}</p>
                <p className="text-[11px] text-gray-500 truncate whitespace-nowrap">{title}</p>
            </div>
            {action && <div className="flex-shrink-0">{action}</div>}
        </article>
    );
}
