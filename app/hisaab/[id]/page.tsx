import { redirect } from "next/navigation";

// Navigation now lives inside the book (home). Deep links to a hisaab bounce to
// home for now; per-person view links get their own routes in a later step.
export default async function Page() {
  redirect("/");
}
