import { redirect } from "next/navigation";

export default function MissingNotificationsRedirect() {
  redirect("/admin");
}
