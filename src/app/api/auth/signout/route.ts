import { signOut } from "@/lib/auth";

export async function POST() {
  await signOut({ redirectTo: "/login" });
}

export async function GET() {
  await signOut({ redirectTo: "/login" });
}
