import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function redirect(path: string) {
  return new NextResponse(null, { status: 303, headers: { location: path } })
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  cookieStore.set({
    name: "refreshToken",
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(0)
  });

  return redirect("/login");
}
