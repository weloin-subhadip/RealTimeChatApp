interface AvatarProps {
  name: string;
  online?: boolean;
  /** px diameter; defaults to 40 (sidebar/header size). */
  size?: number;
}

/** Palette of soft gradients; a name hashes to a stable one. */
const GRADIENTS = [
  "from-violet-500 to-indigo-500",
  "from-fuchsia-500 to-pink-500",
  "from-sky-500 to-blue-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-red-500",
  "from-cyan-500 to-sky-500",
  "from-purple-500 to-violet-600",
];

function gradientFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

/** Initials circle with a stable gradient + optional presence dot. */
export default function Avatar({ name, online, size = 40 }: AvatarProps) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const dot = Math.max(9, Math.round(size * 0.28));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className={`flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br ${gradientFor(
          name
        )} font-semibold text-white`}
        style={{ fontSize: Math.round(size * 0.36) }}
      >
        {initials || "?"}
      </div>
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-2 border-white ${
            online ? "bg-emerald-500" : "bg-slate-300"
          }`}
          style={{ width: dot, height: dot }}
        />
      )}
    </div>
  );
}
