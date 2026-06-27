// Admin Teams — full team dashboard at an admin-scoped URL.
// Reuses the manager pages (admins are authorized there too) so there is no
// duplicate logic to maintain. Tabs come from the admin layout (AdminShell).
export { default } from "@/app/manager/page";
export const dynamic = "force-dynamic";
