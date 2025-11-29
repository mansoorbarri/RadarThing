export default function Loading() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 flex flex-col items-center justify-center space-y-3">
      <div className="flex items-center space-x-2">
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"></div>
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:0.15s]"></div>
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:0.3s]"></div>
      </div>
      <p className="text-sm tracking-wider font-light uppercase">
        Loading
      </p>
    </div>
  );
}