"use client";
import { useState } from "react";
import ImageUpload from "@/components/ImageUpload";
import { setMyAvatar } from "@/app/account/actions";

// Recruiter's own avatar with inline upload — shows on their dashboard header.
export default function MyAvatar({ userId, name, initialUrl }: { userId: string; name: string; initialUrl: string | null }) {
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [saving, setSaving] = useState(false);

  async function save(next: string | null) {
    setUrl(next);
    setSaving(true);
    await setMyAvatar(next);
    setSaving(false);
  }

  return (
    <div className="relative">
      <ImageUpload bucket="avatars" prefix={userId} value={url} onChange={save} size={56} label="Add your photo" variant="menu" />
      {saving && <span className="absolute -bottom-5 left-0 text-xs text-muted">saving…</span>}
    </div>
  );
}
