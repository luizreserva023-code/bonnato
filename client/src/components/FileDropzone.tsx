import { useId, useMemo, useRef, useState } from "react";
import { FileImage, Loader2, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FileDropzoneProps = {
  value?: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
  maxBytes?: number;
  label?: string;
  helper?: string;
  uploading?: boolean;
  progress?: number | null;
  previewUrl?: string | null;
  className?: string;
};

function humanBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function FileDropzone({
  value,
  onChange,
  accept = "image/jpeg,image/png,image/webp,image/gif",
  maxBytes = 5 * 1024 * 1024,
  label = "Enviar arquivo",
  helper = "Clique ou arraste um arquivo para esta área.",
  uploading = false,
  progress,
  previewUrl,
  className,
}: FileDropzoneProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const localPreview = useMemo(() => {
    if (!value || !value.type.startsWith("image/")) return null;
    return URL.createObjectURL(value);
  }, [value]);
  const preview = localPreview ?? previewUrl ?? null;

  function select(file?: File | null) {
    if (!file) return;
    setError(null);
    if (file.size > maxBytes) {
      setError(`Arquivo maior que ${humanBytes(maxBytes)}.`);
      return;
    }
    const allowed = accept.split(",").map((x) => x.trim());
    if (allowed.length && !allowed.includes(file.type) && !allowed.includes(file.name.split(".").pop() ? `.${file.name.split(".").pop()}` : "")) {
      setError("Tipo de arquivo não permitido.");
      return;
    }
    onChange(file);
  }

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => select(event.target.files?.[0])}
      />
      <div
        role="button"
        tabIndex={0}
        aria-describedby={`${id}-help`}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onClick={() => !uploading && inputRef.current?.click()}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { event.preventDefault(); setDragging(false); }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!uploading) select(event.dataTransfer.files?.[0]);
        }}
        className={cn(
          "group relative flex min-h-36 cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed p-4 outline-none transition",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30",
          uploading && "pointer-events-none opacity-70",
        )}
      >
        {preview ? (
          <img src={preview} alt="Prévia do arquivo" className="h-24 w-24 shrink-0 rounded-lg border object-cover" />
        ) : (
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-muted">
            <UploadCloud className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{value?.name ?? label}</p>
          <p id={`${id}-help`} className="mt-1 text-xs text-muted-foreground">
            {value ? `${humanBytes(value.size)} · ${value.type || "tipo desconhecido"}` : helper}
          </p>
          {uploading && (
            <div className="mt-3 flex items-center gap-2 text-xs font-medium text-primary">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Enviando{typeof progress === "number" ? ` · ${Math.round(progress)}%` : "..."}
            </div>
          )}
        </div>
        {value && !uploading && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Remover arquivo"
            onClick={(event) => {
              event.stopPropagation();
              onChange(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        {!preview && value && <FileImage className="h-5 w-5 text-muted-foreground" />}
      </div>
      {error && <p className="text-xs font-medium text-destructive" role="alert">{error}</p>}
    </div>
  );
}
