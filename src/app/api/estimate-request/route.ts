import { supabaseData } from "@/src/lib/supabase";
import {
  sendCustomerEstimateEmail,
  sendInternalEstimateNotification,
} from "@/src/lib/email";
import { estimateQuote } from "@/src/lib/calc";
import { parseDurationHours } from "@/src/lib/estimator/calc";
import type { QuoteInput } from "@/src/lib/estimator";
import { publicRequestToQuoteInput } from "@/src/lib/estimator/publicRequest";


function generateEstimateNumber() {
  const now = new Date();

  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  const random = Math.floor(100 + Math.random() * 900); // 3 digits

  return `GP-${yy}${mm}${dd}-${random}`;
}


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const estimateNumber = generateEstimateNumber();
    const quoteInput = publicRequestToQuoteInput(body);
const result = estimateQuote(quoteInput);

    const { error } = await supabaseData.from("estimate_requests").insert([
      {
        status: "New",
        estimate_number: estimateNumber,

        customer_name: body.customerName,
        company_name: body.companyName,
        email: body.email,
        phone: body.phone,

        event_name: body.eventName,
        event_location: body.eventLocation,
        event_date: body.eventDate || null,

        payload: {
  ...body,
  estimateNumber,
  estimate: {
    totalIncGst: result.totals?.grandTotalIncGst,
    labourExGst: result.totals?.labourExGst,
    nonLabourExGst: result.totals?.nonLabourExGst,
    gst: result.totals?.gst,
    subTotalExGst: result.totals?.subTotalExGst,
  },
},
      },
    ]);

    if (error) {
      console.error("Estimate request insert error:", error);

      return Response.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    await sendCustomerEstimateEmail({
  customerName: body.customerName,
  customerEmail: body.email,
  companyName: body.companyName,
  eventName: body.eventName,
  eventDate: body.eventDate,
  eventLocation: body.eventLocation,
  grandTotalIncGst: result.totals?.grandTotalIncGst,
  crewLines: body.crewLines,
  estimateNumber,
});

await sendInternalEstimateNotification({
  customerName: body.customerName,
  customerEmail: body.email,
  companyName: body.companyName,
  eventName: body.eventName,
  eventDate: body.eventDate,
  eventLocation: body.eventLocation,
  grandTotalIncGst: result.totals?.grandTotalIncGst,
  crewLines: body.crewLines,
  estimateNumber,
});

    return Response.json({ success: true });
  } catch (err) {
    console.error("Estimate request API error:", err);

    return Response.json(
      { success: false, error: "Unexpected server error" },
      { status: 500 }
    );
  }
}