import { redirect } from "next/navigation";

/** 일반 메뉴에서 제거하고 관리자 화면으로 이동 */
export default function SitesPage() {
  redirect("/admin/sites");
}
