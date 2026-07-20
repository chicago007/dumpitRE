import { redirect } from "next/navigation";

export default function ManagementProgressRedirect() {
  redirect("/admin/progress");
}
