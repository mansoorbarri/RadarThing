/** Content-only placeholder: the guides layout already shows the header. */
export default function Loading() {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        Loading guides…
      </p>
      <div className="animate-pulse space-y-5 motion-reduce:animate-none">
        <div className="h-4 w-40 rounded bg-white/[0.06]" />
        <div className="h-12 w-3/4 max-w-xl rounded-lg bg-white/[0.06]" />
        <div className="h-5 w-full max-w-2xl rounded bg-white/[0.04]" />
        <div className="h-5 w-5/6 max-w-2xl rounded bg-white/[0.04]" />
        <div className="h-40 w-full max-w-3xl rounded-2xl bg-white/[0.03]" />
      </div>
    </div>
  );
}
