export default function Loading() {
  return (
    <div
      role="status"
      className="bg-site flex min-h-screen flex-col items-center justify-center space-y-3 text-slate-200"
    >
      <div className="flex items-center space-x-2" aria-hidden="true">
        <div className="h-2 w-2 animate-bounce rounded-full bg-cyan-400"></div>
        <div className="h-2 w-2 animate-bounce rounded-full bg-cyan-400 [animation-delay:0.15s]"></div>
        <div className="h-2 w-2 animate-bounce rounded-full bg-cyan-400 [animation-delay:0.3s]"></div>
      </div>
      <p className="text-sm font-light tracking-wider uppercase">Loading</p>
    </div>
  );
}
