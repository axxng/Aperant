export function DevModeBanner() {
  if (import.meta.env.VITE_MOCK_SERVICES !== 'true') return null;
  return (
    <div className="fixed top-2 right-2 z-50 bg-amber-400 text-amber-900 text-xs font-bold px-2 py-1 rounded shadow">
      Dev Mode
    </div>
  );
}
