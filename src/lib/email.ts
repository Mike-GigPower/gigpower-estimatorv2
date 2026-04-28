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
};

function money(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "To be confirmed";

  return value.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
  });
}

export async function sendCustomerEstimateEmail(input: EstimateEmailInput) {
  return resend.emails.send({
    from: "GigPower <onboarding@resend.dev>",
    to: [input.customerEmail],
    subject: `GigPower estimate request received - ${input.eventName}`,
    html: `
      <h2>Estimate request received</h2>
      <p>Hi ${input.customerName || "there"},</p>
      <p>Thanks for your request. Based on the details provided, your indicative estimate is:</p>
      <h1>${money(input.grandTotalIncGst)} inc GST</h1>
      <p>A GigPower team member will review the request and confirm final pricing, availability, and scope.</p>
      <hr />
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
    subject: `New estimate request - ${input.eventName}`,
    html: `
      <h2>New estimate request received</h2>
      <p><strong>Customer:</strong> ${input.customerName}</p>
      <p><strong>Company:</strong> ${input.companyName || "Not supplied"}</p>
      <p><strong>Email:</strong> ${input.customerEmail}</p>
      <p><strong>Event:</strong> ${input.eventName}</p>
      <p><strong>Date:</strong> ${input.eventDate || "Not supplied"}</p>
      <p><strong>Venue:</strong> ${input.eventLocation || "Not supplied"}</p>
      <p><strong>Indicative total:</strong> ${money(input.grandTotalIncGst)} inc GST</p>
    `,
  });
}