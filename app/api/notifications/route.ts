import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/notifications — the signed-in user's recent notifications + unread count.
// Returns empty (200) for signed-out users or if the table isn't there yet, so the
// bell never errors the page.
export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ items: [], unread: 0 });

    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, is_read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) return NextResponse.json({ items: [], unread: 0 });
    const items = data ?? [];
    const unread = items.filter((n: { is_read: boolean }) => !n.is_read).length;
    return NextResponse.json({ items, unread });
  } catch {
    return NextResponse.json({ items: [], unread: 0 });
  }
}

// POST /api/notifications — mark notifications read or dismiss them.
//   { action: "read", ids?: string[] }    -> mark given ids (or all) as read
//   { action: "dismiss", id: string }     -> delete one
export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body?.action ?? "read";

    if (action === "dismiss" && body?.id) {
      await supabase.from("notifications").delete().eq("id", body.id).eq("user_id", user.id);
      return NextResponse.json({ ok: true });
    }

    // default: mark read
    let q = supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    if (Array.isArray(body?.ids) && body.ids.length) q = q.in("id", body.ids);
    await q;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
