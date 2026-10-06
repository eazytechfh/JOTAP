interface CustomDateRangePickerProps {
  start: string;
  end: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}

export function CustomDateRangePicker({
  start,
  end,
  onStartChange,
  onEndChange,
}: CustomDateRangePickerProps) {
  function handleStartChange(value: string) {
    if (!value) return;
    onStartChange(value);
    if (end && value > end) onEndChange(value);
  }

  function handleEndChange(value: string) {
    if (!value) return;
    onEndChange(value);
    if (start && value < start) onStartChange(value);
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2">
      <label className="text-xs font-medium text-gray-600">
        <span className="mb-1 block">Data inicial</span>
        <input
          type="date"
          value={start}
          max={end || undefined}
          onChange={(event) => handleStartChange(event.target.value)}
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700"
        />
      </label>
      <span className="pb-2 text-xs text-gray-400">até</span>
      <label className="text-xs font-medium text-gray-600">
        <span className="mb-1 block">Data final</span>
        <input
          type="date"
          value={end}
          min={start || undefined}
          onChange={(event) => handleEndChange(event.target.value)}
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700"
        />
      </label>
    </div>
  );
}
