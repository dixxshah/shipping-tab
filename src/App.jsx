import { useState, useRef, useCallback } from "react";

const AZURE_FUNCTION_URL = "https://shah-shipping-classifier.azurewebsites.net/api/classify";
const FUNCTION_API_KEY = "shah-trading-2026";

const CATEGORIES = {
  INVOICE:   { label: "Commercial Invoice",     color: "#1a56db", bg: "#eff6ff", border: "#bfdbfe" },
  BOL:       { label: "Bill of Lading",          color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc" },
  COA:       { label: "Certificate of Analysis", color: "#059669", bg: "#f0fdf4", border: "#a7f3d0" },
  QA:        { label: "Other QA Docs",           color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  LOGISTICS: { label: "Other Logistics Docs",    color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  MISC:      { label: "Misc",                    color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
};

function downloadPdf(base64, filename) {
  const byteChars = atob(base64);
  const byteNums = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
  const blob = new Blob([new Uint8Array(byteNums)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function Badge({ category }) {
  const c = CATEGORIES[category] || CATEGORIES.MISC;
  return (
    <span style={{
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      borderRadius: 20, padding: "3px 12px", fontSize: 11, fontWeight: 600,
      letterSpacing: "0.04em", fontFamily: "'Syne', sans-serif", whiteSpace: "nowrap",
    }}>{c.label}</span>
  );
}

function ConfidencePill({ confidence }) {
  const map = { high: ["#dcfce7","#16a34a"], medium: ["#fef9c3","#ca8a04"], low: ["#fee2e2","#dc2626"] };
  const [bg, fg] = map[confidence] || map.low;
  return <span style={{ background: bg, color: fg, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 500 }}>{confidence}</span>;
}

function DocRow({ doc, index }) {
  const c = CATEGORIES[doc.category] || CATEGORIES.MISC;
  const [hovered, setHovered] = useState(false);
  const [dlHovered, setDlHovered] = useState(false);
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr auto auto auto",
      alignItems: "center", gap: 16, padding: "14px 20px",
      borderBottom: "1px solid #f3f4f6",
      background: hovered ? "#fafafa" : "transparent",
      transition: "background 0.15s",
      animation: `fadeIn 0.25s ease ${index * 0.06}s both`,
    }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <Badge category={doc.category} />
          <span style={{ fontSize: 12, color: "#9ca3af" }}>pp. {doc.startPage}–{doc.endPage}</span>
        </div>
        {doc.notes && <p style={{ margin: 0, fontSize: 13, color: "#6b7280", lineHeight: 1.4 }}>{doc.notes}</p>}
      </div>
      <ConfidencePill confidence={doc.confidence} />
      <span style={{ fontSize: 12, color: "#9ca3af", whiteSpace: "nowrap" }}>{doc.endPage - doc.startPage + 1}p</span>
      {doc.pdfBase64 ? (
        <button
          onClick={() => downloadPdf(doc.pdfBase64, doc.filename)}
          onMouseEnter={() => setDlHovered(true)}
          onMouseLeave={() => setDlHovered(false)}
          style={{
            background: dlHovered ? c.color : c.bg,
            color: dlHovered ? "#fff" : c.color,
            border: `1px solid ${c.border}`,
            borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600,
            cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s",
            fontFamily: "'Syne', sans-serif",
          }}
        >↓ Download</button>
      ) : <span style={{ width: 90 }} />}
    </div>
  );
}

function SummaryBar({ summary }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "14px 20px", borderBottom: "1px solid #f3f4f6" }}>
      {Object.entries(summary).map(([cat, info]) => {
        const c = CATEGORIES[cat] || CATEGORIES.MISC;
        return (
          <div key={cat} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 20, padding: "4px 14px", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.color, display: "inline-block" }} />
            <span style={{ fontSize: 12, color: c.color, fontWeight: 600, fontFamily: "'Syne', sans-serif" }}>{info.count}× {c.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function ShippingClassifier() {
  const [file, setFile] = useState(null);
  const [refNo, setRefNo] = useState("");
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef();

  const handleFile = useCallback((f) => {
    if (f?.type === "application/pdf") { setFile(f); setStatus("idle"); setResult(null); }
  }, []);

  const classify = async () => {
    if (!file) return;
    setStatus("loading"); setResult(null); setErrorMsg("");
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const resp = await fetch(AZURE_FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": FUNCTION_API_KEY },
        body: JSON.stringify({ containerNo: refNo || file.name.replace(".pdf",""), pdfBase64: base64 }),
      });
      if (!resp.ok) throw new Error(`Function returned ${resp.status}`);
      setResult(await resp.json());
      setStatus("done");
    } catch (err) {
      setErrorMsg(err.message);
      setStatus("error");
    }
  };

  const reset = () => { setStatus("idle"); setResult(null); setFile(null); setRefNo(""); setErrorMsg(""); };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Plus Jakarta Sans', 'Segoe UI', sans-serif", padding: "40px 24px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap');
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        input[type=text]:focus { border-color: #1a56db !important; box-shadow: 0 0 0 3px #eff6ff !important; outline: none; }
      `}</style>

      <div style={{ maxWidth: 680, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 28, animation: "fadeIn 0.3s ease both" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #1a56db, #0891b2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🗂</div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827", fontFamily: "'Syne', sans-serif", letterSpacing: "-0.02em" }}>Shipping Doc Classifier</h1>
              <p style={{ margin: 0, fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>Shah Trading Co. · Powered by Claude AI</p>
            </div>
          </div>
        </div>

        {/* Upload card */}
        {status !== "done" && (
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", animation: "fadeIn 0.3s ease 0.05s both" }}>
            {/* Ref No */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Reference No. <span style={{ color: "#9ca3af", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
              </label>
              <input type="text" value={refNo} onChange={e => setRefNo(e.target.value)} placeholder="e.g. SC-00123"
                style={{ width: "100%", background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "10px 14px", color: "#111827", fontSize: 14, fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.2s" }} />
            </div>

            {/* Dropzone */}
            <div
              onClick={() => fileInputRef.current.click()}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files[0]); }}
              style={{
                border: `2px dashed ${isDragging ? "#1a56db" : file ? "#0891b2" : "#d1d5db"}`,
                borderRadius: 12, padding: "36px 24px", textAlign: "center", cursor: "pointer",
                background: isDragging ? "#eff6ff" : file ? "#ecfeff" : "#fafafa",
                transition: "all 0.2s", marginBottom: 20,
              }}
            >
              <input ref={fileInputRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
              {file ? (
                <>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                  <p style={{ margin: "0 0 4px", fontWeight: 600, color: "#0891b2", fontSize: 14 }}>{file.name}</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>{(file.size / 1024).toFixed(0)} KB · Click to change</p>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 32, marginBottom: 10, color: "#d1d5db" }}>↑</div>
                  <p style={{ margin: "0 0 4px", fontWeight: 600, color: "#374151", fontSize: 14 }}>Drop shipping PDF here</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>or click to browse</p>
                </>
              )}
            </div>

            {/* Classify button */}
            <button onClick={classify} disabled={!file || status === "loading"}
              style={{
                width: "100%", padding: "12px",
                background: file && status !== "loading" ? "#1a56db" : "#e5e7eb",
                color: file && status !== "loading" ? "#fff" : "#9ca3af",
                border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700,
                cursor: file && status !== "loading" ? "pointer" : "not-allowed",
                fontFamily: "'Syne', sans-serif", letterSpacing: "0.02em", transition: "all 0.2s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {status === "loading" ? (
                <><span style={{ width: 16, height: 16, border: "2px solid #ffffff40", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />Classifying with Claude…</>
              ) : "Classify Document"}
            </button>

            {status === "error" && (
              <div style={{ marginTop: 14, padding: "10px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#dc2626", fontSize: 13 }}>⚠ {errorMsg}</div>
            )}
          </div>
        )}

        {/* Results */}
        {status === "done" && result && (
          <div style={{ animation: "fadeIn 0.3s ease both" }}>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h2 style={{ margin: "0 0 2px", fontSize: 16, fontWeight: 800, color: "#111827", fontFamily: "'Syne', sans-serif" }}>{result.containerNo}</h2>
                  <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>{result.totalPages} pages · {result.documents?.length} documents identified</p>
                </div>
                <button onClick={reset} style={{ background: "#f3f4f6", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, color: "#6b7280", cursor: "pointer" }}>← New</button>
              </div>
              {result.summary && <SummaryBar summary={result.summary} />}
              <div>{result.documents?.map((doc, i) => <DocRow key={i} doc={doc} index={i} />)}</div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
