import { useState, useRef, useCallback } from "react";

const AZURE_FUNCTION_URL = "https://shah-shipping-classifier.azurewebsites.net/api/classify";
const FUNCTION_API_KEY = "shah-trading-2026";

const DOC_COLORS = {
  INVOICE:  { bg: "#1a2f4e", accent: "#3b82f6", label: "Invoice" },
  BOL:      { bg: "#1a3a2a", accent: "#22c55e", label: "Bill of Lading" },
  SHIPPING: { bg: "#2d2010", accent: "#f59e0b", label: "Packing List" },
  QA:       { bg: "#2a1a3a", accent: "#a855f7", label: "QA / Certificate" },
  UNKNOWN:  { bg: "#1e1e1e", accent: "#6b7280", label: "Unknown" },
};

function CategoryBadge({ category }) {
  const c = DOC_COLORS[category] || DOC_COLORS.UNKNOWN;
  return (
    <span style={{
      background: c.bg,
      color: c.accent,
      border: `1px solid ${c.accent}40`,
      borderRadius: "4px",
      padding: "2px 10px",
      fontSize: "11px",
      fontWeight: 700,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      fontFamily: "'DM Mono', monospace",
    }}>
      {c.label}
    </span>
  );
}

function ConfidenceDot({ confidence }) {
  const colors = { high: "#22c55e", medium: "#f59e0b", low: "#ef4444" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#9ca3af" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: colors[confidence] || "#6b7280", display: "inline-block" }} />
      {confidence}
    </span>
  );
}

function DocCard({ doc, index }) {
  const c = DOC_COLORS[doc.category] || DOC_COLORS.UNKNOWN;
  return (
    <div style={{
      background: "#111827",
      border: `1px solid #1f2937`,
      borderLeft: `3px solid ${c.accent}`,
      borderRadius: "8px",
      padding: "16px 20px",
      display: "flex",
      alignItems: "center",
      gap: 16,
      animation: `fadeSlideIn 0.3s ease ${index * 0.07}s both`,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: "8px",
        background: c.bg, display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, fontSize: 18,
      }}>
        {doc.category === "INVOICE" ? "🧾" :
         doc.category === "BOL" ? "🚢" :
         doc.category === "SHIPPING" ? "📦" :
         doc.category === "QA" ? "✅" : "📄"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
          <CategoryBadge category={doc.category} />
          <ConfidenceDot confidence={doc.confidence} />
          <span style={{ fontSize: 12, color: "#6b7280", marginLeft: "auto" }}>
            pp. {doc.startPage}–{doc.endPage}
          </span>
        </div>
        {doc.notes && (
          <p style={{ margin: 0, fontSize: 13, color: "#9ca3af", lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {doc.notes}
          </p>
        )}
      </div>
      {doc.sharePointUrl && (
        <a href={doc.sharePointUrl} target="_blank" rel="noopener noreferrer"
          style={{ color: "#3b82f6", fontSize: 12, textDecoration: "none", flexShrink: 0, padding: "6px 12px", border: "1px solid #3b82f640", borderRadius: 6 }}>
          Open ↗
        </a>
      )}
    </div>
  );
}

function SummaryChips({ summary }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
      {Object.entries(summary).map(([cat, info]) => {
        const c = DOC_COLORS[cat] || DOC_COLORS.UNKNOWN;
        return (
          <div key={cat} style={{
            background: c.bg, border: `1px solid ${c.accent}40`,
            borderRadius: 20, padding: "4px 14px",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.accent }} />
            <span style={{ fontSize: 12, color: c.accent, fontFamily: "'DM Mono', monospace" }}>
              {info.count}× {c.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function ShippingClassifier() {
  const [file, setFile] = useState(null);
  const [containerNo, setContainerNo] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef();

  const handleFile = useCallback((f) => {
    if (f && f.type === "application/pdf") {
      setFile(f);
      setStatus("idle");
      setResult(null);
    }
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const classify = async () => {
    if (!file) return;
    setStatus("loading");
    setResult(null);
    setErrorMsg("");

    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });

      const resp = await fetch(AZURE_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": FUNCTION_API_KEY,
        },
        body: JSON.stringify({
          containerNo: containerNo || file.name.replace(".pdf", ""),
          pdfBase64: base64,
        }),
      });

      if (!resp.ok) throw new Error(`Function returned ${resp.status}`);
      const data = await resp.json();
      setResult(data);
      setStatus("done");
    } catch (err) {
      setErrorMsg(err.message);
      setStatus("error");
    }
  };

  const reset = () => {
    setFile(null);
    setContainerNo("");
    setStatus("idle");
    setResult(null);
    setErrorMsg("");
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0e1a",
      color: "#f9fafb",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      padding: "32px 24px",
      maxWidth: 720,
      margin: "0 auto",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500;700&display=swap');
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        input[type=text] { outline: none; }
        input[type=text]:focus { border-color: #3b82f6 !important; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 32, animation: "fadeSlideIn 0.4s ease both" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: "linear-gradient(135deg, #1d4ed8, #7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
          }}>🗂</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em" }}>
              Shipping Doc Classifier
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: "#6b7280", fontFamily: "'DM Mono', monospace" }}>
              Shah Trading Co. · Powered by Claude AI
            </p>
          </div>
        </div>
      </div>

      {status !== "done" && (
        <>
          {/* Container No input */}
          <div style={{ marginBottom: 16, animation: "fadeSlideIn 0.4s ease 0.05s both" }}>
            <label style={{ display: "block", fontSize: 12, color: "#9ca3af", marginBottom: 6, fontFamily: "'DM Mono', monospace", letterSpacing: "0.05em" }}>
              REFERENCE NO. (optional)
            </label>
            <input
              type="text"
              value={containerNo}
              onChange={e => setContainerNo(e.target.value)}
              placeholder="e.g. SC-00123"
              style={{
                width: "100%", background: "#111827", border: "1px solid #1f2937",
                borderRadius: 8, padding: "10px 14px", color: "#f9fafb",
                fontSize: 14, fontFamily: "'DM Mono', monospace",
                transition: "border-color 0.2s",
              }}
            />
          </div>

          {/* Drop zone */}
          <div
            onClick={() => fileInputRef.current.click()}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            style={{
              border: `2px dashed ${isDragging ? "#3b82f6" : file ? "#22c55e" : "#1f2937"}`,
              borderRadius: 12,
              padding: "40px 24px",
              textAlign: "center",
              cursor: "pointer",
              background: isDragging ? "#0f1a2e" : file ? "#0f1e15" : "#0d1117",
              transition: "all 0.2s",
              marginBottom: 20,
              animation: "fadeSlideIn 0.4s ease 0.1s both",
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              style={{ display: "none" }}
              onChange={e => handleFile(e.target.files[0])}
            />
            {file ? (
              <>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                <p style={{ margin: "0 0 4px", fontWeight: 600, color: "#22c55e" }}>{file.name}</p>
                <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
                  {(file.size / 1024).toFixed(0)} KB · Click to change
                </p>
              </>
            ) : (
              <>
                <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.4 }}>⬆</div>
                <p style={{ margin: "0 0 4px", fontWeight: 500, color: "#d1d5db" }}>
                  Drop shipping PDF here
                </p>
                <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>or click to browse</p>
              </>
            )}
          </div>

          {/* Classify button */}
          <button
            onClick={classify}
            disabled={!file || status === "loading"}
            style={{
              width: "100%",
              padding: "12px",
              background: file && status !== "loading"
                ? "linear-gradient(135deg, #1d4ed8, #7c3aed)"
                : "#1f2937",
              color: file && status !== "loading" ? "#fff" : "#6b7280",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: file && status !== "loading" ? "pointer" : "not-allowed",
              letterSpacing: "0.02em",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              animation: "fadeSlideIn 0.4s ease 0.15s both",
            }}
          >
            {status === "loading" ? (
              <>
                <span style={{ width: 16, height: 16, border: "2px solid #ffffff40", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                Classifying with Claude…
              </>
            ) : "Classify Document"}
          </button>

          {status === "error" && (
            <div style={{ marginTop: 16, padding: "12px 16px", background: "#1a0a0a", border: "1px solid #ef444440", borderRadius: 8, color: "#ef4444", fontSize: 13 }}>
              ⚠ {errorMsg}
            </div>
          )}
        </>
      )}

      {/* Results */}
      {status === "done" && result && (
        <div style={{ animation: "fadeSlideIn 0.4s ease both" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: "0 0 2px", fontSize: 16, fontWeight: 600 }}>
                {result.containerNo}
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: "#6b7280", fontFamily: "'DM Mono', monospace" }}>
                {result.totalPages} pages · {result.documents?.length} documents identified
              </p>
            </div>
            <button onClick={reset} style={{
              background: "transparent", border: "1px solid #1f2937",
              color: "#9ca3af", borderRadius: 6, padding: "6px 14px",
              fontSize: 12, cursor: "pointer",
            }}>
              ← New
            </button>
          </div>

          {result.summary && <SummaryChips summary={result.summary} />}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {result.documents?.map((doc, i) => (
              <DocCard key={i} doc={doc} index={i} />
            ))}
          </div>

          {result.sharePointFolder && (
            <div style={{ marginTop: 20, padding: "12px 16px", background: "#0f1a2e", border: "1px solid #1d4ed840", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: "#9ca3af" }}>📁 SharePoint folder created</span>
              <a href={result.sharePointFolder} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 12, color: "#3b82f6", textDecoration: "none" }}>
                Open folder ↗
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
