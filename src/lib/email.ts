import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type EstimateEmailInput = {
  customerName: string;
  customerEmail: string;
  companyName?: string;
  eventName: string;
  eventDate?: string;
  eventLocation?: string;
  grandTotalIncGst?: number;
  estimateNumber?: string;
  requestLink?: string;
  crewLines?: {
    crewType: string;
    qty: string;
    shiftDate: string;
    startTime: string;
    duration: string;
    notes?: string;
  }[];
};

function money(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "To be confirmed";

  return value.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
  });
}

function crewBreakdownHtml(lines?: EstimateEmailInput["crewLines"]) {
  if (!lines?.length) return "";

  return `
    <h3>Crew requirements</h3>
    <table cellpadding="6" cellspacing="0" border="1" style="border-collapse: collapse;">
      <thead>
        <tr>
          <th align="left">Crew type</th>
          <th align="left">Qty</th>
          <th align="left">Date</th>
          <th align="left">Start</th>
          <th align="left">Duration</th>
        </tr>
      </thead>
      <tbody>
        ${lines
          .map(
            (line) => `
              <tr>
                <td>${line.crewType}</td>
                <td>${line.qty}</td>
                <td>${line.shiftDate}</td>
                <td>${line.startTime}</td>
                <td>${line.duration}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

export async function sendCustomerEstimateEmail(input: EstimateEmailInput) {
  return resend.emails.send({
  from: "GigPower <info@gigpower.com>",
  reply_to: "info@gigpower.com",
  to: [input.customerEmail],
    subject: `GigPower estimate request received - ${input.eventName}  Estimate Number - ${input.estimateNumber}` ,
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

      <!-- BODY -->
      <div style="padding:24px; color:#333;">
        <h2 style="margin-top:0;">Estimate request received</h2>

        <p>Hi ${input.customerName || "there"},</p>

        <p>
          Thanks for your request. Based on the details provided, your indicative estimate is:
        </p>

        <!-- ESTIMATE NUMBER -->
        <p style="margin-top:20px; font-size:12px; color:#777;">
          Estimate Number
        </p>
        <p style="
  font-size:20px;
  font-weight:bold;
  margin-top:4px;
  background:#111;
  color:#fcb900;
  display:inline-block;
  padding:6px 10px;
  border-radius:4px;
">
  ${input.estimateNumber}
</p>

        <!-- TOTAL -->
        <h1 style="margin-top:16px; font-size:28px; color:#111;">
  ${money(input.grandTotalIncGst)}
</h1>
<p style="margin-top:-8px; color:#666;">
  inc GST
</p>
<hr style="margin:20px 0; border:none; border-top:1px solid #eee;" />

        <!-- EXPLANATION -->
        <p style="margin-top:20px; line-height:1.5;">
          This estimate does not represent a confirmed booking. It is based on the details 
          provided and assumes standard working conditions.
        </p>

        <p style="line-height:1.5;">
          If you would like to proceed, please contact us via email or phone quoting reference 
          <strong>${input.estimateNumber}</strong>.
        </p>

        <!-- CREW BREAKDOWN -->
        ${crewBreakdownHtml(input.crewLines)}

        <!-- EVENT DETAILS -->
        <p style="margin-top:20px;">
          <strong>Event:</strong> ${input.eventName}<br/>
          <strong>Date:</strong> ${input.eventDate || "To be confirmed"}<br/>
          <strong>Venue:</strong> ${input.eventLocation || "To be confirmed"}
        </p>
      </div>
      
      <div style="text-align:center; margin:24px 0;">
  <a href="mailto:info@gigpower.com"
     style="
       background:#fcb900;
       color:#111;
       padding:12px 20px;
       text-decoration:none;
       font-weight:bold;
       border-radius:6px;
       display:inline-block;
     ">
    Proceed with Booking
  </a>
</div>

      <!-- FOOTER -->
      <div style="background:#f0f0f0; padding:20px; text-align:center; font-size:12px; color:#555;">
        <p style="margin:0;">
          GigPower – The Entertainment Labour Specialists
        </p>
        <p style="margin:6px 0;">
          info@gigpower.com | +613 9376 5600
        </p>
        <p style="margin:0;">
          © ${new Date().getFullYear()} GigPower
        </p>
      </div>

    </div>
  </div>
`,
  });
}

export async function sendInternalEstimateNotification(input: EstimateEmailInput) {
  const notifyEmail = process.env.GIGPOWER_NOTIFICATION_EMAIL || "mike@gigpower.com";

  return resend.emails.send({
  from: "GigPower Estimator <info@gigpower.com>",
  _to: "info@gigpower.com",
  to: [notifyEmail],
    subject: `New estimate request - ${input.eventName} Estimate Number - ${input.estimateNumber}`,
    html: `
      <h2>New estimate request received</h2>
      <p>
  <strong>View request:</strong><br/>
  <a href="${input.requestLink}">
    Open in admin
  </a>
</p>
      <p><strong>Customer:</strong> ${input.customerName}</p>
      <p><strong>Company:</strong> ${input.companyName || "Not supplied"}</p>
      <p><strong>Email:</strong> ${input.customerEmail}</p>
      <p><strong>Event:</strong> ${input.eventName}</p>
      <p><strong>Date:</strong> ${input.eventDate || "Not supplied"}</p>
      <p><strong>Venue:</strong> ${input.eventLocation || "Not supplied"}</p>
      ${crewBreakdownHtml(input.crewLines)}
      <p><strong>Indicative total:</strong> ${money(input.grandTotalIncGst)} inc GST</p>
    `,
  });
}