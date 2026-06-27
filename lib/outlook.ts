// Microsoft Graph (Outlook) helpers — app-only / client-credentials flow.
// Used to (a) send the daily-update email FROM the monitored mailbox so replies
// come back to it, and (b) read reply messages the webhook is notified about.
//
// Required env:
//   MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET   (Azure AD app registration)
//   OUTLOOK_MAILBOX            -> the mailbox user id or UPN, e.g. updates@yourco.com
//   OUTLOOK_WEBHOOK_SECRET     -> arbitrary string echoed as Graph subscription clientState
//   NEXT_PUBLIC_APP_URL        -> public https base for the webhook notificationUrl

const GRAPH = "https://graph.microsoft.com/v1.0";

export function outlookConfigured() {
  return !!(process.env.MS_TENANT_ID && process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET && process.env.OUTLOOK_MAILBOX);
}

export async function getGraphToken(): Promise<string> {
  const tenant = process.env.MS_TENANT_ID!;
  const body = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID!,
    client_secret: process.env.MS_CLIENT_SECRET!,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Graph token failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.access_token as string;
}

async function graphFetch(path: string, init: RequestInit = {}, token?: string) {
  const t = token ?? (await getGraphToken());
  return fetch(`${GRAPH}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

// Send mail from the monitored mailbox. Replies will land in that mailbox's Inbox.
// Accepts one or many recipients and an optional Reply-To.
export async function sendOutlookMail(
  to: string | string[],
  subject: string,
  html: string,
  opts?: { replyTo?: string | null; from?: string | null },
) {
  // Send AS `from` (the actor's mailbox) when given, else the default monitored mailbox.
  const mailbox = (opts?.from || process.env.OUTLOOK_MAILBOX || "").trim();
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  const message: Record<string, unknown> = {
    subject,
    body: { contentType: "HTML", content: html },
    toRecipients: recipients.map((address) => ({ emailAddress: { address } })),
  };
  if (opts?.replyTo) message.replyTo = [{ emailAddress: { address: opts.replyTo } }];
  const res = await graphFetch(`/users/${encodeURIComponent(mailbox)}/sendMail`, {
    method: "POST",
    body: JSON.stringify({ message, saveToSentItems: true }),
  });
  if (!res.ok) throw new Error(`sendMail failed: ${res.status} ${await res.text()}`);
}

export type GraphMessage = {
  id: string;
  receivedDateTime: string;
  subject: string | null;
  bodyPreview: string | null;
  body: { contentType: string; content: string } | null;
  from: { emailAddress: { address: string; name?: string } } | null;
};

export async function getOutlookMessage(messageId: string): Promise<GraphMessage> {
  const mailbox = process.env.OUTLOOK_MAILBOX!;
  const res = await graphFetch(
    `/users/${encodeURIComponent(mailbox)}/messages/${messageId}?$select=id,receivedDateTime,subject,bodyPreview,body,from`,
    { method: "GET" }
  );
  if (!res.ok) throw new Error(`getMessage failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// Create a change-notification subscription on the mailbox Inbox.
// Graph mail subscriptions max out near ~3 days, so renew on a cron.
export async function createOutlookSubscription() {
  const mailbox = process.env.OUTLOOK_MAILBOX!;
  const notificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/outlook`;
  const expiration = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(); // ~2 days
  const res = await graphFetch(`/subscriptions`, {
    method: "POST",
    body: JSON.stringify({
      changeType: "created",
      notificationUrl,
      resource: `/users/${mailbox}/mailFolders('Inbox')/messages`,
      expirationDateTime: expiration,
      clientState: process.env.OUTLOOK_WEBHOOK_SECRET || "recruit-tracker",
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`createSubscription failed: ${res.status} ${JSON.stringify(json)}`);
  return json;
}

export async function listOutlookSubscriptions() {
  const res = await graphFetch(`/subscriptions`, { method: "GET" });
  const json = await res.json();
  return json.value ?? [];
}

export async function renewOutlookSubscription(id: string) {
  const expiration = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const res = await graphFetch(`/subscriptions/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ expirationDateTime: expiration }),
  });
  if (!res.ok) throw new Error(`renew failed: ${res.status} ${await res.text()}`);
  return res.json();
}
