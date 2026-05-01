type DraftOption = {
  id: string;
  name: string;
  companyName?: string;
  quoteNumber?: string;
};

type DraftToolbarProps = {
  draftName: string;
  setDraftName: (value: string) => void;
  quoteSearch: string;
  setQuoteSearch: (value: string) => void;
  selectedDraftId: string;
  setSelectedDraftId: (value: string) => void;
  filteredDrafts: DraftOption[];
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
    <div
      className="no-print"
      style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}
    >
      <input
        type="text"
        value={draftName}
        onChange={(e) => setDraftName(e.target.value)}
        placeholder="Estimate name"
        style={{ width: 220 }}
      />

      <button className="btn-secondary" onClick={onSaveNew}>
        Save New
      </button>

      <button
        className="btn-secondary"
        onClick={onUpdateSaved}
        disabled={!selectedDraftId}
        title={selectedDraftId ? "Overwrite selected estimate" : "Select an estimate first"}
      >
        Update Saved
      </button>

      <input
        type="text"
        value={quoteSearch}
        onChange={(e) => setQuoteSearch(e.target.value)}
        placeholder="Search by quote #, company, contact..."
        style={{ minWidth: 280 }}
      />

      <select
        value={selectedDraftId}
        onChange={(e) => setSelectedDraftId(e.target.value)}
        style={{ minWidth: 360 }}
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
      >
        Load Selected
      </button>

      <button
        className="btn-danger"
        onClick={onDeleteSelected}
        disabled={!selectedDraftId}
      >
        Delete Selected
      </button>

      <button className="btn-danger" onClick={onClearAll}>
        Start New
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
    </div>
  );
}