"use client";
import MyAvatar from "@/components/MyAvatar";

type HeadBadge = { name: string; color: string | null; icon: string | null } | null;

// A LinkedIn "#OPEN TO WORK"-style banner across the BOTTOM of the avatar — not a frame
// around the whole photo. The photo itself is untouched; only a small badge ribbon overlaps.
export default function AvatarWithBadge({
  userId, name, initialUrl, badge,
}: { userId: string; name: string; initialUrl: string | null; badge: HeadBadge }) {
  const color = badge?.color || "#16a34a";
  return (
    <div className="relative inline-block w-fit">
      <MyAvatar userId={userId} name={name} initialUrl={initialUrl} />
      {badge && (
        <div
          className="absolute inset-x-0 -bottom-1.5 mx-auto w-[60px] truncate rounded-full border-2 border-surface px-1.5 py-[2px] text-center text-[8px] font-extrabold uppercase leading-tight tracking-wide text-white shadow"
          style={{ background: color }}
          title={`Badge unlocked: ${badge.name}`}
        >
          {badge.name}
        </div>
      )}
    </div>
  );
}
