import { redirect } from "next/navigation";

/**
 * `/admin` is where login and the "back to the studio" links all land, and
 * the wall — not the shop grid — is what the artist opens most, so that is
 * what she should meet first. The shop grid itself lives at `/admin/shop`.
 */
export default function AdminIndex() {
  redirect("/admin/portfolio");
}
