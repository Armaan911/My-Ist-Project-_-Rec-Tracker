"use client";
import { useState } from "react";
import { MessageSquare, X } from "lucide-react";
import { Card } from "@/components/ui";
import MessagesInbox from "@/components/MessagesInbox";

type Msg = { id: string; subject: string | null; body: string; is_read: boolean; created_at: string; sender?: { full_name: string } | null };

// Bottom-right floating message button + panel. Reuses MessagesInbox so the
// delete / select / delete-all / pagination features come along for free.
export default function FloatingMessages({ messages }: { messages: Msg[] }) {
  const [open, setOpen] = useState(false);
  const unread = messages.filter((m) => !m.is_read).length;

  return (
    <>
      <button onClick={() => setOpen((o) => !o)} aria-label="Messages"
        className="fixed bottom-5 right-5 z-50 grid h-14 w-14 place-items-center rounded-full bg-brand-600 text-white shadow-lg transition hover:bg-brand-700 active:translate-y-px">
        <MessageSquare size={22} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-danger-600 px-1 text-xs font-bold text-white ring-2 ring-surface">{unread}</span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="fixed bottom-24 right-5 z-50 flex max-h-[78vh] w-[min(92vw,440px)] flex-col">
            <div className="mb-2 flex justify-end">
              <button onClick={() => setOpen(false)} aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-full bg-surface text-muted shadow-md hover:text-ink">
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto">
              {messages.length ? <MessagesInbox messages={messages} /> : <Card><p className="py-6 text-center text-sm text-muted">No messages yet.</p></Card>}
            </div>
          </div>
        </>
      )}
    </>
  );
}
