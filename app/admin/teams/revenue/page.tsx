// Admin Teams — Revenue tracker at an admin-scoped URL.
// Reuses the manager revenue page (admins are authorized there too) so there is no
// duplicate logic to maintain. Chrome (NavBar + tabs) comes from the admin layout.
export { default } from "@/app/manager/revenue/page";
export const dynamic = "force-dynamic";
