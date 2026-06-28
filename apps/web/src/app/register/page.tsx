import { redirect } from "next/navigation";

// El registro vive ahora en la página combinada /login con tabs.
// Mantenemos /register para no romper enlaces directos.
export default function RegisterPage() {
  redirect("/login?tab=signup");
}
