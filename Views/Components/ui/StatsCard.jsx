import clsx from 'clsx';

/**
 * StatsCard — Corporate-Compact KPI card.
 * Slim profile, no excessive padding. Scales gracefully across grid widths.
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
                'flex items-center gap-3 rounded-lg border border-gray-100 bg-white px-4 py-3 min-w-0 w-full',
                className,
            )}
        >
            <span className={clsx('flex size-9 shrink-0 items-center justify-center rounded-full', iconBg, iconColor)}>
                {icon}
            </span>
            <div className="min-w-0 flex-1 overflow-hidden">
                <p className="text-lg font-semibold text-gray-900 truncate leading-tight">{value}</p>
                <p className="text-xs text-gray-500 truncate">{title}</p>
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </article>
    );
}
