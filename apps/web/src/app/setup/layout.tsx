export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { readConfigForBuild } from "@/server/config/store";

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  const cfg = readConfigForBuild();

  // Block access once setup has been completed or users already exist
  if (cfg.meta.firstRunCompleted || cfg.auth.users.length > 0 || cfg.auth.mode === "oauth2") {
    redirect("/");
  }

  return <>{children}</>;
}
