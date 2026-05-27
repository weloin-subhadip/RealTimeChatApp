interface AvatarProps {
  name: string;
  online?: boolean;
}

/** Initials circle with an optional presence dot (presence wired in Phase 3). */
export default function Avatar({ name, online }: AvatarProps) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-300 text-sm font-semibold text-slate-700">
        {initials || "?"}
      </div>
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
            online ? "bg-green-500" : "bg-slate-400"
          }`}
        />
      )}
    </div>
  );
}
