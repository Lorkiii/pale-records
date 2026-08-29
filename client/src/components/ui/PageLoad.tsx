// Presents a contained, accessible loading state inside an application page.
interface PageLoadProps {
  message: string;
}

export default function PageLoad({ message }: PageLoadProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy="true"
      className="flex min-h-72 w-full items-center justify-center border border-ink bg-paper-light px-5 py-10"
    >
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <span
          aria-hidden="true"
          className="h-10 w-10 animate-spin border-2 border-paper-dark border-t-ink motion-reduce:animate-none"
        />
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
          {message}
        </p>
      </div>
    </div>
  );
}
