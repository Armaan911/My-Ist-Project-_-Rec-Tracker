"use client";
import MyAvatar from "@/components/MyAvatar";

// A coloured ring around the avatar in the recruiter's current MEDAL colour
// (bronze / silver / gold …) — a medal frame, not a badge banner.
export default function AvatarWithBadge({
  userId, name, initialUrl, medalColor, medalName,
}: { userId: string; name: string; initialUrl: string | null; medalColor: string | null; medalName?: string | null }) {
  if (!medalColor) return <MyAvatar userId={userId} name={name} initialUrl={initialUrl} />;
  return (
    <div className="relative inline-block rounded-2xl p-[3px] shadow-sm" style={{ background: medalColor }} title={medalName ? `${medalName} medal` : "Medal"}>
      <div className="rounded-[15px] bg-surface p-[2px]">
        <MyAvatar userId={userId} name={name} initialUrl={initialUrl} />
      </div>
    </div>
  );
}
