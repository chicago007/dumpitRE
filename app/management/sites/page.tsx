import { Suspense } from "react";
import ManagementSitesPage from "./sites-client";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted">불러오는 중…</div>}>
      <ManagementSitesPage />
    </Suspense>
  );
}
