import { supabaseData } from "@/src/lib/supabase";
import {
  sendCustomerEstimateEmail,
  sendInternalEstimateNotification,
} from "@/src/lib/email";
import { estimateQuote } from "@/src/lib/calc";
import { parseDurationHours } from "@/src/lib/estimator/calc";





export async function POST(request: Request) {
  try {
    const body = await request.json();
    const quoteInput = {
  labour: body.crewLines.map((line: any) => ({
    id: line.id,
    role: line.crewType,
    qty: Number(line.qty),
    shiftDate: line.shiftDate,
    startTime: line.startTime,
    durationHours: parseDurationHours(line.duration) ?? 0,
    notes: line.notes,
  })),
  nonLabour: [],
};
const result = estimateQuote(quoteInput);

    const { error } = await supabaseData.from("estimate_requests").insert([
      {
        status: "New",

        customer_name: body.customerName,
        company_name: body.companyName,
        email: body.email,
        phone: body.phone,

        event_name: body.eventName,
        event_location: body.eventLocation,
        event_date: body.eventDate || null,

        payload: {
        ...body,
        estimateTotal: result.totals?.grandTotalIncGst,
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
});

await sendInternalEstimateNotification({
  customerName: body.customerName,
  customerEmail: body.email,
  companyName: body.companyName,
  eventName: body.eventName,
  eventDate: body.eventDate,
  eventLocation: body.eventLocation,
  grandTotalIncGst: result.totals?.grandTotalIncGst,
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