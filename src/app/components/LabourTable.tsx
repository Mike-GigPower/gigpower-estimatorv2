import LabourRow from "./LabourRow";
type LabourLine = {
  id: string;
  role: string;
  qty: number;
  shiftDate: string;
  startTime: string;
  durationHours: number;
};

type LabourResultLine = {
  id: string;
  costExGst: number;
  totalIncGst: number;
};

type LabourResult = {
  isValid: boolean;
  validationErrors: string[];
  labourLines: LabourResultLine[];
};

type LabourTableProps = {
  labour: LabourLine[];
  result?: LabourResult | null;
  roleOptions: string[];
  startTimeText: Record<string, string>;
  setStartTimeText: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  durationText: Record<string, string>;
  setDurationText: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  updateLabour: (id: string, patch: Partial<LabourLine>) => void;
  addLabour: () => void;
  duplicateLabour: (id: string) => void;
  removeLabour: (id: string) => void;
  sortLabourByDate: () => void;
  formatDateDDMMYYYY: (date: Date) => string;
  normaliseHHMM: (value: string) => string | null;
  hoursToHHMM: (hours: number) => string;
  autoColonHHMM: (value: string) => string;
  money: (value: number) => string;
  minBillableHours: number;
};



export default function LabourTable({
  labour,
  result,
  roleOptions,
  startTimeText,
  setStartTimeText,
  durationText,
  setDurationText,
  updateLabour,
  addLabour,
  duplicateLabour,
  removeLabour,
  sortLabourByDate,
  formatDateDDMMYYYY,
  normaliseHHMM,
  hoursToHHMM,
  autoColonHHMM,
  money,
  minBillableHours,
}: LabourTableProps) {
  
  const labourResultById = Object.fromEntries(
  (result?.labourLines ?? []).map((line) => [line.id, line])
);
  
  return (
    <div className="card">
      <div className="row labour-header-row">
        <h2 style={{ margin: 0, fontSize: 16 }}>Labour</h2>
        <div className="no-print labour-actions">
          <button type="button" className="btn-secondary" onClick={sortLabourByDate}>
            Sort by date
          </button>
          <button type="button" onClick={addLabour}>
            + Add labour line
          </button>
        </div>
      </div>

      <div className="labour-table-wrap">
        <table className="entry-table labour-table">
          <thead>
            <tr>
              <th style={{ minWidth: 160 }}>Role</th>
              <th>Qty</th>
              <th style={{ minWidth: 120 }}>Shift date</th>
              <th>Start (24h)</th>
              <th>Duration (HH:MM)</th>
              <th className="text-right" style={{ minWidth: 140 }}>Cost (ex GST)</th>
			  <th className="text-right" style={{ minWidth: 160 }}>Total (inc GST)</th>
              <th className="no-print"> </th>
            </tr>
          </thead>

          <tbody>
            {labour.map((line) => (
  <LabourRow
    key={line.id}
    line={line}
    resultLine={labourResultById[line.id]}
    roleOptions={roleOptions}
    startTimeText={startTimeText}
    setStartTimeText={setStartTimeText}
    durationText={durationText}
    setDurationText={setDurationText}
    updateLabour={updateLabour}
    duplicateLabour={duplicateLabour}
    removeLabour={removeLabour}
    formatDateDDMMYYYY={formatDateDDMMYYYY}
    normaliseHHMM={normaliseHHMM}
    hoursToHHMM={hoursToHHMM}
    autoColonHHMM={autoColonHHMM}
    money={money}
  />
))}
          </tbody>
        </table>
      </div>

      {result && !result.isValid && (
        <div style={{ marginTop: 12 }}>
          <div className="badge bad">Fix inputs</div>
          <ul>
            {result.validationErrors.slice(0, 12).map((e, idx) => (
              <li key={idx}>
                <small className="muted">{e}</small>
              </li>
            ))}
          </ul>
          <small className="muted">
            If any labour line is invalid (e.g., duration below {minBillableHours}h), the quote is
            marked blocked.
          </small>
        </div>
      )}
    </div>
  );
}