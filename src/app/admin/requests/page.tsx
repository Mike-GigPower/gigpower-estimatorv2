"use client";

import { Suspense, useEffect, useState } from "react";
import { createClient } from "@/src/lib/supabase/client";
import { useSearchParams } from "next/navigation";

type EstimateRequest = {
  id: string;
  created_at: string;
  status: string;
  estimate_number: string | null;
  quote_number: string | null;
  customer_name: string | null;
  company_name: string | null;
  email: string | null;
  event_name: string | null;
  event_location: string | null;
  event_date: string | null;
  payload: any;
};

function AdminRequestsContent() {
  const [requests, setRequests] = useState<EstimateRequest[]>([]);
  const [selected, setSelected] = useState<EstimateRequest | null>(null);
  const [loading, setLoading] = useState(true);

  const [supabase] = useState(() => createClient());
  const searchParams = useSearchParams();
const requestIdFromUrl = searchParams.get("id");

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    setLoading(true);

   const { data, error } = await supabase
  .from("estimate_requests")
  .select("*")
  .order("created_at", { ascending: false }) as {
    data: EstimateRequest[] | null;
    error: any;
  };

    if (error) {
      console.error("Error loading estimate requests:", error);
      alert("Could not load estimate requests.");
      setLoading(false);
      return;
    }

    setRequests(data || []);
    if (requestIdFromUrl) {
  const match = data?.find((r: EstimateRequest) => r.id === requestIdFromUrl);
  setSelected(match || data?.[0] || null);
} else {
  setSelected(data?.[0] || null);
}
    setLoading(false);
  }
  
  async function updateStatus(id: string, status: string) {
  const { error } = await supabase
    .from("estimate_requests")
    .update({ status })
    .eq("id", id);

  if (error) {
    console.error(error);
    alert("Failed to update status");
    return;
  }

  loadRequests();
}

  function money(value?: number) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "To be confirmed";
    }

    return value.toLocaleString("en-AU", {
      style: "currency",
      currency: "AUD",
    });
  }
  
  async function loadIntoEstimator(request: EstimateRequest) {
  localStorage.removeItem("loadedEstimateRequest");
  localStorage.removeItem("convertedEstimateRequestId");

  const { error } = await supabase
    .from("estimate_requests")
    .update({ status: "Reviewed" })
    .eq("id", request.id);

  if (error) {
    console.error("Failed to update request status:", error);
    alert("Failed to update request status: " + error.message);
    return;
  }

  localStorage.setItem(
    "loadedEstimateRequest",
    JSON.stringify({
      requestId: request.id,
      requestNumber: request.estimate_number,
      payload: request.payload,
    })
  );

  window.location.href = "/";
}

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>Estimate Requests</h1>
          <p className="muted">
            Review public estimate requests submitted through the customer form.
          </p>
        </div>

        <button type="button" className="btn-secondary" onClick={loadRequests}>
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="card">Loading requests...</div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "380px 1fr",
            gap: 16,
            alignItems: "start",
          }}
        >
          <div className="card">
            <h2 style={{ fontSize: 16 }}>Requests</h2>

            {requests.length === 0 ? (
              <p className="muted">No estimate requests found.</p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {requests.map((request) => (
                  <button
                    key={request.id}
                    type="button"
                    className="btn-secondary"
                    onClick={() => setSelected(request)}
                    style={{
                      textAlign: "left",
                      border:
                        selected?.id === request.id
                          ? "2px solid var(--gp-gold)"
                          : undefined,
                    }}
                  >
                    <strong>
  {request.estimate_number || "No reference"}
</strong>

{request.payload?.needsCrewAdvice && (
  <span
  style={{
    display: "inline-block",
    marginTop: 8,
    padding: "4px 8px",
    borderRadius: 999,
    background: "#fff3cd",
    color: "#7a5a00",
    fontSize: 12,
    fontWeight: 700,
  }}
>
  Advice requested
</span>
)}

<br />
{request.event_name || "Untitled event"}
                    <br />
                    <small>
                      {request.event_date || "No date"} ·{" "}
                      {request.company_name || request.customer_name || "Unknown"}
                    </small>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            {!selected ? (
              <p className="muted">Select a request to view details.</p>
            ) : (
              <>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div>
                    <h2 style={{ marginBottom: 4 }}>
                      {selected.estimate_number || "No reference"}
                    </h2>
                    <div style={{ marginTop: 8 }}>
  <select
    value={selected.status}
    onChange={(e) => updateStatus(selected.id, e.target.value)}
  >
    <option value="New">New</option>
    <option value="Reviewed">Reviewed</option>
    <option value="Quoted">Quoted</option>
  </select>
  {selected.quote_number && (
  <p className="muted" style={{ marginTop: 6 }}>
    Quote number: <strong>{selected.quote_number}</strong>
  </p>
)}
{selected.payload?.needsCrewAdvice && (
  <p
    style={{
      marginTop: 8,
      padding: "8px 10px",
      borderRadius: 6,
      background: "#fff3cd",
      color: "#7a5a00",
      fontWeight: 700,
    }}
  >
    Customer requested a call to discuss crew requirements.
  </p>
)}
</div>
                  </div>
                </div>

                <hr />

                <h3>Customer</h3>
<p>
  <strong>Name:</strong> {selected.payload?.customerName || "-"}
  <br />
  <strong>Company:</strong> {selected.payload?.companyName || "-"}
  <br />
  <strong>Email:</strong> {selected.payload?.email || "-"}
  <br />
  <strong>Phone:</strong> {selected.payload?.phone || "Not supplied"}
</p>
{selected.payload?.phone && (
  <>
    <br />
    <a
      href={`tel:${selected.payload.phone}`}
      className="btn-secondary"
      style={{ display: "inline-block", marginTop: 8 }}
    >
      Call customer
    </a>
  </>
)}

<h3>Event</h3>
<p>
  <strong>Event:</strong> {selected.payload?.eventName || "-"}
  <br />
  <strong>Date:</strong> {selected.payload?.eventDate || "-"}
  <br />
  <strong>Venue:</strong> {selected.payload?.eventLocation || "-"}
</p>

                <h3>Crew requirements</h3>

                <table className="entry-table">
                  <thead>
                    <tr>
                      <th>Crew type</th>
                      <th>Qty</th>
                      <th>Date</th>
                      <th>Start</th>
                      <th>Duration</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selected.payload?.crewLines || []).map(
                      (line: any, index: number) => (
                        <tr key={line.id || index}>
                          <td>{line.crewType}</td>
                          <td>{line.qty}</td>
                          <td>{line.shiftDate}</td>
                          <td>{line.startTime}</td>
                          <td>{line.duration}</td>
                          <td>{line.notes}</td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>

                <h3 style={{ marginTop: 20 }}>Estimate</h3>
<p>
  <strong>Total inc GST:</strong>{" "}
  {money(selected.payload?.estimate?.totalIncGst)}
</p>

<button
  type="button"
  className="btn-secondary"
  style={{ marginTop: 12 }}
  onClick={() => loadIntoEstimator(selected)}
>
  Convert to Quote
</button>

{selected.payload?.notes && (
  <>
    <h3>Customer Notes</h3>
    <p>{selected.payload.notes}</p>
  </>
)}
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}



export default function AdminRequestsPage() {
  return (
    <Suspense fallback={<main className="max-w-7xl mx-auto px-6 py-8">Loading...</main>}>
      <AdminRequestsContent />
    </Suspense>
  );
}