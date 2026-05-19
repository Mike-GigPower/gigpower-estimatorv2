import { supabaseData } from "@/src/lib/supabase";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return Response.json({ success: false, error: "Invalid email" }, { status: 400 });
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Invalidate any existing unused codes for this email
    await supabaseData
      .from("verification_codes")
      .update({ used: true })
      .eq("email", email.toLowerCase())
      .eq("used", false);

    // Insert new code
    const { error } = await supabaseData.from("verification_codes").insert({
      email: email.toLowerCase(),
      code,
      expires_at: expiresAt,
      used: false,
    });

    if (error) {
      console.error("Failed to store verification code:", error);
      return Response.json({ success: false, error: "Failed to generate code" }, { status: 500 });
    }

    // Send email
    await resend.emails.send({
      from: "Gig Power <info@gigpower.com>",
      replyTo: "info@gigpower.com",
      to: [email],
      subject: "Your GigPower verification code",
      html: `
        <div style="font-family: Arial, sans-serif; background:#f5f5f5; padding:20px;">
          <div style="background:#111; padding:24px; text-align:center;">
            <div style="background:#fff; display:inline-block; padding:10px 14px; border-radius:6px;">
              <img
                src="https://gigpower-estimatorv2.vercel.app/brand/gigpower-logo.png"
                alt="GigPower"
                style="height:45px;"
              />
            </div>
          </div>
          <div style="background:#fff; padding:32px; max-width:480px; margin:0 auto;">
            <h2 style="margin-top:0;">Verify your email</h2>
            <p>Use the code below to verify your email address and complete your estimate request.</p>
            <p style="
              font-size: 36px;
              font-weight: bold;
              letter-spacing: 8px;
              background: #111;
              color: #fcb900;
              display: inline-block;
              padding: 12px 20px;
              border-radius: 6px;
              margin: 16px 0;
            ">${code}</p>
            <p style="color:#666; font-size:13px;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
          </div>
          <div style="text-align:center; font-size:12px; color:#555; margin-top:16px;">
            <p>Gig Power - The Entertainment Labour Specialists</p>
            <p>info@gigpower.com | +613 9376 5600</p>
          </div>
        </div>
      `,
    });

    return Response.json({ success: true });
  } catch (err) {
    console.error("send-verification error:", err);
    return Response.json({ success: false, error: "Unexpected error" }, { status: 500 });
  }
}
