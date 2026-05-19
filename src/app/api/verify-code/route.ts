import { supabaseData } from "@/src/lib/supabase";

export async function POST(request: Request) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return Response.json({ success: false, error: "Email and code are required" }, { status: 400 });
    }

    const { data, error } = await supabaseData
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
    await supabaseData
      .from("verification_codes")
      .update({ used: true })
      .eq("id", data.id);

    return Response.json({ success: true });
  } catch (err) {
    console.error("verify-code error:", err);
    return Response.json({ success: false, error: "Unexpected error" }, { status: 500 });
  }
}
