import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import NavBar from "@/components/NavBar";
import ReferenceGuide from "@/components/ReferenceGuide";

export const dynamic = "force-dynamic";

export default async function ReferencePage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return (
    <>
      <NavBar name={profile.full_name ?? ""} role={profile.role} userId={profile.id} avatarUrl={(profile as any).avatar_url ?? null} isCoordinator={(profile as any).is_coordinator ?? false} />
      <main className="mx-auto max-w-[1100px] px-3 py-8 sm:px-5 lg:px-7">
        <ReferenceGuide />
      </main>
    </>
  );
}
