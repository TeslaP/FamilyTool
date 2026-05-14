import { useState, useCallback, useRef } from "react";
import { Upload } from "lucide-react";
import { cn } from "../lib/utils";

interface Props {
  onFile: (file: File) => void;
  accept: string;
  disabled?: boolean;
}

export function FileDropZone({ onFile, accept, disabled }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }, [onFile, disabled]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "border-2 border-dashed rounded-2xl p-20 text-center cursor-pointer transition-colors",
        dragging ? "border-stone-900 bg-stone-100" : "border-stone-300 hover:border-stone-400",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <Upload className="mx-auto mb-4 text-stone-400" size={40} />
      <p className="text-lg text-stone-600">Drop a .TAB or .XLS file here</p>
      <p className="text-base text-stone-400 mt-1">or click to browse</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
      />
    </div>
  );
}
