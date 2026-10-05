import { redirect } from "next/navigation";

/// Invite codes are no longer part of sign-in. Old links return to the LINE button.
export default function LinkAccountPage() {
  redirect("/signin");
}
