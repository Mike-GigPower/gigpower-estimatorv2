import { notFound } from "next/navigation";

type Quote = {
  id: string;
  name: string;
  quoteNumber?: string;
  quoteDate?: string;
  validUntil?: string;
  payload?: any;
};

async function getQuote(id: string): Promise<Quote | null> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/quotes?id=eq.${id}`,
    {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) return null;

  const data = await res.json();
  return data?.[0] || null;
}

export default async function PrintQuotePage({
  params,
}: {
  params: { id: string };
}) {
  const quote = await getQuote(params.id);

  if (!quote) return notFound();

  const payload = quote.payload || {};

  return (
    <div className="print-root">
      {/* 👇 THIS WRAPPER IS IMPORTANT */}
      <div className="print-ready">
        
        {/* HEADER */}
        <div className="print-header">
          <h1>GigPower Estimate</h1>
          <div>Quote #: {quote.quoteNumber || "—"}</div>
          <div>Date: {quote.quoteDate || "—"}</div>
          <div>Valid Until: {quote.validUntil || "—"}</div>
        </div>

        {/* BODY */}
        <div className="print-body">
          <h2>{quote.name}</h2>

          {/* 👉 Replace this with your real labour + totals rendering */}
          <pre>{JSON.stringify(payload, null, 2)}</pre>
        </div>

      </div>
    </div>
  );
}