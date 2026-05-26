import { createClient } from "@supabase/supabase-js";

// Service role client — bypasses RLS, server-side only
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export async function POST(request: Request) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return Response.json({ success: false, error: "Email and code are required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("verification_codes")
      .select("*")
      .eq("email", email.toLowerCase())
      .eq("code", code.trim())
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return Response.json({ success: false, error: "Invalid or expired code" }, { status: 400 });
    }

    // Mark code as used
    await supabase
      .from("verification_codes")
      .update({ used: true })
      .eq("id", data.id);

    return Response.json({ success: true });
  } catch (err) {
    console.error("verify-code error:", err);
    return Response.json({ success: false, error: "Unexpected error" }, { status: 500 });
  }
}
