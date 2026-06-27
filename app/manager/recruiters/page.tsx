import { createAdminClient } from "@/lib/supabase/admin";
import { getRecruiterDirectory } from "@/lib/recruiterDirectory";
import RecruitersDirectory from "@/components/RecruitersDirectory";
import { createDailyLink } from "./actions";

export const dynamic = "force-dynamic";

export default async function ManagerRecruitersPage() {
  const admin = createAdminClient();
  const recruiters = await getRecruiterDirectory(admin);
  return (
    <RecruitersDirectory
      recruiters={recruiters}
      mintLink={createDailyLink}
      subtitle="Your recruiters with their live workload. Copy a fresh single-use daily-update link (changes every click) to send any recruiter on demand."
    />
  );
}
