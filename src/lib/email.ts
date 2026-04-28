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
    from: "GigPower <onboarding@resend.dev>",
    to: [input.customerEmail],
    subject: `GigPower estimate request received - ${input.eventName}  Estimate Number - ${input.estimateNumber}` ,
    html: `
      <h2>Estimate request received</h2>
      <p>Hi ${input.customerName || "there"},</p>
      <p>Thanks for your request. Based on the details provided, your indicative estimate is:</p>

<h1>${money(input.grandTotalIncGst)} inc GST</h1>

<p>
  This estimate does not represent a confirmed booking. it is based on the details 
  provided and assumes standard working conditions. If you would like to proceed with 
  this booking, please contact us via email or phone quoting this estimate number ${input.estimateNumber}. 
  Final pricing will be confirmed following review of scope, access, availability, 
  and site requirements.
</p>

${crewBreakdownHtml(input.crewLines)}
      <p><strong>Event:</strong> ${input.eventName}</p>
      <p><strong>Date:</strong> ${input.eventDate || "To be confirmed"}</p>
      <p><strong>Venue:</strong> ${input.eventLocation || "To be confirmed"}</p>
    `,
  });
}

export async function sendInternalEstimateNotification(input: EstimateEmailInput) {
  const notifyEmail = process.env.GIGPOWER_NOTIFICATION_EMAIL || "mike@gigpower.com";

  return resend.emails.send({
    from: "GigPower Estimator <onboarding@resend.dev>",
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