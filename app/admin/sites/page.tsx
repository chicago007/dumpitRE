import { redirect } from "next/navigation";

/** 레거시 전체 공정율 → 관리자 공정율 현황 */
export default function AdminSitesRedirect() {
  redirect("/admin/progress");
}
