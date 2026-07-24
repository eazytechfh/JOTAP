export function AutomotiveLoading({ label = 'Carregando dados' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex min-h-32 flex-col items-center justify-center gap-3 text-gray-500">
      <svg className="automotive-loading automotive-loading-car h-12 w-24 text-primary" viewBox="0 0 96 48" fill="none" aria-hidden="true">
        <path d="M12 30h72l-7-13H35L24 26H12v4Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        <circle cx="27" cy="33" r="7" fill="white" stroke="currentColor" strokeWidth="3" />
        <circle cx="70" cy="33" r="7" fill="white" stroke="currentColor" strokeWidth="3" />
        <path d="M2 20h18M5 13h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="text-sm">{label}</span>
    </div>
  );
}
