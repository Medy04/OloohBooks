import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
    const { password } = body || {};
    if (password !== "OloohBooksAdmin@2025") {
      return NextResponse.json({ ok: false, error: "Code incorrect" }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true });
    // Set a simple session cookie (HttpOnly). Valid 7 days.
    res.cookies.set("session", "ok", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide" }, { status: 400 });
  }
}
