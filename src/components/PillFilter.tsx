import clsx from 'clsx';

export interface PillOption<T extends string> {
  value: T;
  label: string;
}

interface PillFilterProps<T extends string> {
  options: PillOption<T>[];
  selected: T;
  onChange: (value: T) => void;
}

export function PillFilter<T extends string>({ options, selected, onChange }: PillFilterProps<T>) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-gray-100 p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={clsx(
            'rounded-full px-3 py-1.5 text-xs font-medium transition',
            selected === opt.value
              ? 'bg-primary text-white'
              : 'text-gray-600 hover:bg-gray-200'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
