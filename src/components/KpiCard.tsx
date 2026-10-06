import clsx from 'clsx';

interface KpiCardProps {
  label: string;
  value: string;
  variation?: number | null;
  dotColor?: string;
  children?: React.ReactNode;
}

export function KpiCard({ label, value, variation, dotColor = '#22c55e', children }: KpiCardProps) {
  const isPositive = (variation ?? 0) >= 0;

  return (
    <div className="rounded-xl bg-card p-5 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dotColor }} />
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {typeof variation === 'number' && (
        <div
          className={clsx(
            'mt-1 text-xs font-medium',
            isPositive ? 'text-green-600' : 'text-red-600'
          )}
        >
          {isPositive ? '+' : ''}
          {variation.toFixed(1)}% vs período anterior
        </div>
      )}
      {children}
    </div>
  );
}
