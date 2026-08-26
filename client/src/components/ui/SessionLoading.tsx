export default function SessionLoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6 text-ink">
      <p
        role="status"
        className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
        Checking session…
      </p>
    </main>
  );
}
