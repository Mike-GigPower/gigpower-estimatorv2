type DraftOption = {
  id: string;
  name: string;
  companyName?: string;
  quoteNumber?: string;
  status?: string;
};

type DraftToolbarProps = {
  draftName: string;
  setDraftName: (value: string) => void;
  quoteSearch: string;
  setQuoteSearch: (value: string) => void;
  selectedDraftId: string;
  setSelectedDraftId: (value: string) => void;
  filteredDrafts: DraftOption[];
  statusFilter: string;
  status: string;
setStatus: (value: "Draft" | "Sent" | "Approved") => void;
currentVersion?: number;
lastSavedAt?: string | null;
  setStatusFilter: (value: string) => void;
  onSaveNew: () => void;
  onUpdateSaved: () => void;
  onLoadSelected: () => void;
  onDeleteSelected: () => void;
  onClearAll: () => void;
  onPrint: () => void;
  onDownloadPdf?: () => void;
  onRecalculate: () => void;
  busy: boolean;
};

export default function DraftToolbar({
  draftName,
  setDraftName,
  quoteSearch,
  setQuoteSearch,
  statusFilter,
  setStatusFilter,
  status,
setStatus,
currentVersion,
lastSavedAt,
  selectedDraftId,
  setSelectedDraftId,
  filteredDrafts,
  onSaveNew,
  onUpdateSaved,
  onLoadSelected,
  onDeleteSelected,
  onClearAll,
  onPrint,
  onDownloadPdf,
  onRecalculate,
  busy,
}: DraftToolbarProps) {
return (
  <div className="no-print" style={{ display: "grid", gap: 20 }}>
    <div className="card" style={{ display: "grid", gap: 16 }}>
      <div>
        <h2 style={{ margin: 0 }}>Find Estimate</h2>
        <p style={{ margin: "4px 0 0", color: "#666", fontSize: 14 }}>
          Search and load saved estimates.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 220px 1.2fr",
          gap: 20,
          alignItems: "end",
        }}
      >
        {/* Search */}
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
            Search estimates
          </label>
          <input
            type="text"
            value={quoteSearch}
            onChange={(e) => setQuoteSearch(e.target.value)}
            placeholder="Search by quote #, company, contact..."
            style={{ width: "100%", height: 42 }}
          />
        </div>

        {/* Status filter */}
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: "100%", height: 42 }}
          >
            <option value="">All statuses</option>
            <option value="Draft">Draft</option>
            <option value="Sent">Sent</option>
            <option value="Accepted">Accepted</option>
            <option value="Declined">Declined</option>
            <option value="Expired">Expired</option>
          </select>
        </div>

        {/* Saved estimates */}
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
            Saved estimates
          </label>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <select
              value={selectedDraftId}
              onChange={(e) => setSelectedDraftId(e.target.value)}
              style={{ flex: 1, height: 42 }}
            >
              <option value="">Select saved estimate…</option>
              {filteredDrafts.map((d) => (
                <option key={d.id} value={d.id}>
                  {(d.quoteNumber || "—")} | {d.name} | {d.companyName || "—"}
                </option>
              ))}
            </select>

            <button
              className="btn-secondary"
              onClick={onLoadSelected}
              disabled={!selectedDraftId}
              style={{
                height: 42,
                width: 140,
                padding: "0 16px",
                whiteSpace: "nowrap",
              }}
            >
              Load Selected
            </button>
          </div>
        </div>
      </div>
    </div>

    <div className="card" style={{ display: "grid", gap: 18 }}>
      <div>
        <h2 style={{ margin: 0 }}>Estimate Details</h2>
        <p style={{ margin: "4px 0 0", color: "#666", fontSize: 14 }}>
          Edit, save and manage the current estimate.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        

        <button
          className="btn-secondary"
          onClick={onUpdateSaved}
          disabled={!selectedDraftId}
          title={
            selectedDraftId
              ? "Overwrite selected estimate"
              : "Select an estimate first"
          }
        >
          Save Changes
        </button>

        <button className="btn-secondary" onClick={onSaveNew}>
          Save As New Estimate
        </button>

        

        <button className="btn-print" onClick={onPrint}>
          Print
        </button>

        {onDownloadPdf && (
          <button type="button" onClick={onDownloadPdf}>
            Download PDF
          </button>
        )}

        <button className="primary" disabled={busy} onClick={onRecalculate}>
          {busy ? "Calculating…" : "Recalculate"}
        </button>
        
        <button
  onClick={onClearAll}
  style={{
    background: "#16a34a",
    color: "#fff",
    borderColor: "#22c55e",
  }}
>
  Start New Estimate
</button>
      
      <button
  className="btn-danger"
  disabled={!selectedDraftId}
  style={{
    background: "#b91c1c",
    color: "#fff",
    borderColor: "#ef4444",
  }}
  onClick={() => {
    if (!selectedDraftId) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this estimate?\n\nThis action cannot be undone."
    );

    if (confirmed) {
      onDeleteSelected();
    }
  }}
>
  Delete Estimate
</button>
      </div>
      
      

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 220px",
          gap: 16,
          alignItems: "end",
          maxWidth: 720,
        }}
      >
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>
            Estimate name
          </label>
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Estimate name"
            style={{ width: "100%" }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>
            Status
          </label>
          <select
            value={status || "Draft"}
            onChange={(e) =>
  setStatus(e.target.value as "Draft" | "Sent" | "Approved")
}
            style={{ width: "100%", height: 42 }}
          >
            <option value="Draft">Draft</option>
            <option value="Sent">Sent</option>
            <option value="Accepted">Accepted</option>
            <option value="Declined">Declined</option>
            <option value="Expired">Expired</option>
          </select>
        </div>
      </div>

      <div
        style={{
          fontSize: "12px",
          color: "rgba(255,255,255,0.6)",
          marginTop: 4,
        }}
      >
        {lastSavedAt
          ? `Version ${currentVersion ?? 1} · Last saved ${lastSavedAt}`
          : "New unsaved estimate"}
      </div>
    </div>
  </div>
);
}