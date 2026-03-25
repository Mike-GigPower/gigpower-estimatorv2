import { NextResponse } from "next/server";
import { quoteInputSchema } from "../../../lib/schema";
import { estimateQuote } from "../../../lib/calc";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = quoteInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { isValid: false, validationErrors: parsed.error.issues.map(i => i.message) },
      { status: 400 }
    );
  }

  const normalized = {
  quoteNumber: parsed.data.quoteNumber ?? "",
  quoteDate: parsed.data.quoteDate ?? "",
  validUntil: parsed.data.validUntil ?? "",
  companyName: parsed.data.companyName ?? "",
  contactName: parsed.data.contactName ?? "",
  contactEmail: parsed.data.contactEmail ?? "",
  contactPhone: parsed.data.contactPhone ?? "",
  venue: parsed.data.venue ?? "",
  notes: parsed.data.notes ?? "",
  labour: parsed.data.labour,
  nonLabour: parsed.data.nonLabour,
};

const result = estimateQuote(normalized);
  return NextResponse.json(result);
}
