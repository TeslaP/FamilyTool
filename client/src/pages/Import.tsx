import { useState } from "react";
import { Link } from "react-router-dom";
import { FileDropZone } from "../components/FileDropZone";
import { api } from "../api/client";
import { Check, AlertCircle } from "lucide-react";
import type { ImportPreview, ImportResult } from "../types";

type Step = "upload" | "preview" | "done";

export function Import() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (f: File) => {
    setFile(f);
    setError(null);
    setLoading(true);
    try {
      const p = await api.importPreview(f);
      setPreview(p);
      setStep("preview");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview || !file) return;
    setLoading(true);
    setError(null);
    try {
      const r = await api.importConfirm(file.name, preview.transactions);
      setResult(r);
      setStep("done");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  };

  const steps = [
    { key: "upload", label: "Upload" },
    { key: "preview", label: "Preview" },
    { key: "done", label: "Done" },
  ];
  const currentIndex = steps.findIndex(s => s.key === step);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold text-stone-900 mb-6">Import</h2>

      {/* Step indicator */}
      <div className="flex items-center justify-center mb-8">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center">
            {i > 0 && <div className={`w-12 h-px ${i <= currentIndex ? "bg-stone-900" : "bg-stone-200"}`} />}
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                i < currentIndex ? "bg-stone-900 text-white" :
                i === currentIndex ? "bg-stone-900 text-white" :
                "bg-stone-200 text-stone-500"
              }`}>
                {i < currentIndex ? <Check size={14} /> : i + 1}
              </div>
              <span className={`text-xs ${i <= currentIndex ? "text-stone-900 font-medium" : "text-stone-400"}`}>{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === "upload" && (
        <FileDropZone onFile={handleFile} accept=".tab,.xls,.xlsx" disabled={loading} />
      )}

      {/* Step 2: Preview */}
      {step === "preview" && preview && (
        <div className="space-y-4">
          <div className="bg-white border border-stone-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-stone-900">{file?.name}</h3>
              <span className="text-xs text-stone-500">
                {preview.dateRange.from} — {preview.dateRange.to}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-stone-500 text-xs uppercase">Total rows</p>
                <p className="text-lg font-semibold text-stone-900">{preview.rowCount}</p>
              </div>
              <div>
                <p className="text-stone-500 text-xs uppercase">New</p>
                <p className="text-lg font-semibold text-green-600">{preview.newCount}</p>
              </div>
              <div>
                <p className="text-stone-500 text-xs uppercase">Duplicates</p>
                <p className="text-lg font-semibold text-amber-600">{preview.duplicateCount}</p>
              </div>
            </div>
            {/* Rule match stats */}
            <div className="mt-3 pt-3 border-t border-stone-100 text-xs text-stone-500">
              {preview.transactions.filter(t => t.ruleMatch).length} of {preview.newCount} new transactions auto-categorised by rules
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm border border-stone-200 rounded-md text-stone-600 hover:bg-stone-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || preview.newCount === 0}
              className="px-4 py-2 text-sm bg-stone-900 text-white rounded-md hover:bg-stone-800 disabled:opacity-50"
            >
              {loading ? "Importing..." : `Import ${preview.newCount} transactions`}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Done */}
      {step === "done" && result && (
        <div className="bg-white border border-stone-200 rounded-lg p-6 text-center">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Check className="text-green-600" size={20} />
          </div>
          <h3 className="font-medium text-stone-900 mb-2">Import complete</h3>
          <div className="text-sm text-stone-600 space-y-1">
            <p>{result.imported} transactions imported</p>
            {result.duplicatesSkipped > 0 && <p>{result.duplicatesSkipped} duplicates skipped</p>}
            <p>{result.aiCategorised} categorised by AI, {result.aiFailed} sent to review</p>
          </div>
          <div className="mt-4 flex gap-3 justify-center">
            <button onClick={handleReset} className="px-4 py-2 text-sm border border-stone-200 rounded-md text-stone-600 hover:bg-stone-50">
              Import another
            </button>
            {result.aiFailed > 0 && (
              <Link to="/review" className="px-4 py-2 text-sm bg-stone-900 text-white rounded-md hover:bg-stone-800">
                Review transactions
              </Link>
            )}
          </div>
        </div>
      )}

      {loading && step === "upload" && (
        <p className="text-center text-sm text-stone-500 mt-4">Parsing file...</p>
      )}
    </div>
  );
}
