"use client";
import MyAvatar from "@/components/MyAvatar";

// A circular medal frame around the recruiter's avatar in the medal colour
// (bronze / silver / gold / diamond …) with a ribbon below naming the medal.
export default function AvatarWithBadge({
  userId, name, initialUrl, medalColor, medalName,
}: { userId: string; name: string; initialUrl: string | null; medalColor: string | null; medalName?: string | null }) {
  if (!medalColor) return <MyAvatar userId={userId} name={name} initialUrl={initialUrl} />;
  return (
    <div className="relative inline-block pb-3" title={medalName ? `${medalName} medal` : "Medal"}>
      {/* circular coloured medal frame */}
      <div className="rounded-full p-[3px] shadow-sm" style={{ background: medalColor }}>
        <div className="rounded-full bg-surface p-[2px]">
          <MyAvatar userId={userId} name={name} initialUrl={initialUrl} />
        </div>
      </div>
      {/* ribbon / brooch below the avatar */}
      {medalName && (
        <div
          className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white shadow ring-2 ring-surface"
          style={{ background: medalColor, textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}
        >
          {medalName}
        </div>
      )}
    </div>
  );
}
