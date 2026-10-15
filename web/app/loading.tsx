export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10" aria-busy="true">
      <div className="h-8 w-2/3 animate-pulse rounded bg-pitch-800" />
      <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-pitch-800" />
      <div className="mt-8 space-y-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="border-b border-pitch-700 pb-5">
            <div className="h-6 w-3/4 animate-pulse rounded bg-pitch-800" />
            <div className="mt-3 h-12 animate-pulse rounded bg-pitch-800" />
          </div>
        ))}
      </div>
    </main>
  );
}
