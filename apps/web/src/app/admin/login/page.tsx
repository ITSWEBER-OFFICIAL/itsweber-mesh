"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

// /admin/login is kept for backward compatibility.
// The actual login UI lives at /login (outside the admin layout, no sidebar).
function Redirect() {
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    const next = params.get("next");
    router.replace(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export default function AdminLoginRedirectPage() {
  return (
    <Suspense fallback={null}>
      <Redirect />
    </Suspense>
  );
}
