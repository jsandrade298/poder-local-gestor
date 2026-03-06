import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Eye, FileText, Image as ImageIcon, Video, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// ─── Tipos ──────────────────────────────────────────────────────────────────────

interface AnexoPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Anexo do banco (já salvo no storage) */
  anexo?: { nome_arquivo: string; url_arquivo: string; tipo_arquivo?: string; tamanho_arquivo?: number } | null;
  /** Arquivo local (File do input, ainda não salvo) */
  localFile?: File | null;
  /** Para navegação entre anexos */
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function getFileType(nomeArquivo: string, tipoArquivo?: string): "image" | "pdf" | "video" | "other" {
  const ext = nomeArquivo?.toLowerCase().split(".").pop() || "";
  if (tipoArquivo?.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext)) return "image";
  if (tipoArquivo === "application/pdf" || ext === "pdf") return "pdf";
  if (tipoArquivo?.startsWith("video/") || ["mp4", "webm", "ogg", "mov", "avi", "mkv", "m4v"].includes(ext)) return "video";
  return "other";
}

export function getFileTypeIcon(nomeArquivo: string, tipoArquivo?: string) {
  const tipo = getFileType(nomeArquivo, tipoArquivo);
  if (tipo === "image") return <ImageIcon className="h-4 w-4 text-blue-500" />;
  if (tipo === "pdf") return <FileText className="h-4 w-4 text-red-500" />;
  if (tipo === "video") return <Video className="h-4 w-4 text-purple-500" />;
  return <FileText className="h-4 w-4 text-muted-foreground" />;
}

export function isPreviewable(nomeArquivo: string, tipoArquivo?: string): boolean {
  const t = getFileType(nomeArquivo, tipoArquivo);
  return t === "image" || t === "pdf" || t === "video";
}

// ─── Thumbnail para arquivos locais (File) ──────────────────────────────────────

interface LocalFileThumbnailProps {
  file: File;
  onClick?: () => void;
  className?: string;
}

export function LocalFileThumbnail({ file, onClick, className = "" }: LocalFileThumbnailProps) {
  const [url, setUrl] = useState<string>("");
  const tipo = getFileType(file.name, file.type);

  useEffect(() => {
    if (tipo === "image") {
      const objectUrl = URL.createObjectURL(file);
      setUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
  }, [file, tipo]);

  if (tipo === "image" && url) {
    return (
      <img
        src={url}
        alt={file.name}
        onClick={onClick}
        className={`h-10 w-10 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity ${className}`}
      />
    );
  }

  if (tipo === "pdf") {
    return (
      <div
        onClick={onClick}
        className={`h-10 w-10 rounded bg-red-50 dark:bg-red-950/30 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity ${className}`}
      >
        <FileText className="h-5 w-5 text-red-500" />
      </div>
    );
  }

  if (tipo === "video") {
    return (
      <div
        onClick={onClick}
        className={`h-10 w-10 rounded bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity ${className}`}
      >
        <Video className="h-5 w-5 text-purple-500" />
      </div>
    );
  }

  return (
    <div className={`h-10 w-10 rounded bg-muted flex items-center justify-center ${className}`}>
      <FileText className="h-5 w-5 text-muted-foreground" />
    </div>
  );
}

// ─── Thumbnail para anexos do storage ────────────────────────────────────────────

interface StorageAnexoThumbnailProps {
  anexo: { nome_arquivo: string; url_arquivo: string; tipo_arquivo?: string };
  onClick?: () => void;
  className?: string;
}

export function StorageAnexoThumbnail({ anexo, onClick, className = "" }: StorageAnexoThumbnailProps) {
  const [url, setUrl] = useState<string>("");
  const tipo = getFileType(anexo.nome_arquivo, anexo.tipo_arquivo);

  useEffect(() => {
    if (tipo === "image") {
      supabase.storage
        .from("demanda-anexos")
        .createSignedUrl(anexo.url_arquivo, 300) // 5 min
        .then(({ data }) => {
          if (data?.signedUrl) setUrl(data.signedUrl);
        });
    }
  }, [anexo.url_arquivo, tipo]);

  if (tipo === "image" && url) {
    return (
      <img
        src={url}
        alt={anexo.nome_arquivo}
        onClick={onClick}
        className={`h-10 w-10 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity ${className}`}
      />
    );
  }

  if (tipo === "pdf") {
    return (
      <div
        onClick={onClick}
        className={`h-10 w-10 rounded bg-red-50 dark:bg-red-950/30 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity ${className}`}
      >
        <FileText className="h-5 w-5 text-red-500" />
      </div>
    );
  }

  if (tipo === "video") {
    return (
      <div
        onClick={onClick}
        className={`h-10 w-10 rounded bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity ${className}`}
      >
        <Video className="h-5 w-5 text-purple-500" />
      </div>
    );
  }

  return (
    <div className={`h-10 w-10 rounded bg-muted flex items-center justify-center ${className}`}>
      <FileText className="h-5 w-5 text-muted-foreground" />
    </div>
  );
}

// ─── Preview Dialog principal ────────────────────────────────────────────────────

export function AnexoPreviewDialog({
  open,
  onOpenChange,
  anexo,
  localFile,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: AnexoPreviewDialogProps) {
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);

  const nome = localFile?.name || anexo?.nome_arquivo || "";
  const tipoArquivo = localFile?.type || anexo?.tipo_arquivo;
  const tipo = getFileType(nome, tipoArquivo);

  // Gerar URL de preview
  useEffect(() => {
    if (!open) {
      setPreviewUrl("");
      setZoom(1);
      return;
    }

    if (localFile) {
      const objectUrl = URL.createObjectURL(localFile);
      setPreviewUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }

    if (anexo) {
      setLoading(true);
      supabase.storage
        .from("demanda-anexos")
        .createSignedUrl(anexo.url_arquivo, 600) // 10 min
        .then(({ data, error }) => {
          if (data?.signedUrl) setPreviewUrl(data.signedUrl);
          else console.error("Erro ao gerar URL de preview:", error);
          setLoading(false);
        });
    }
  }, [open, anexo, localFile]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && hasPrev) onPrev?.();
      if (e.key === "ArrowRight" && hasNext) onNext?.();
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, hasPrev, hasNext, onPrev, onNext, onOpenChange]);

  const handleDownload = async () => {
    if (localFile) {
      const url = URL.createObjectURL(localFile);
      const a = document.createElement("a");
      a.href = url;
      a.download = localFile.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }
    if (anexo) {
      try {
        const { data, error } = await supabase.storage
          .from("demanda-anexos")
          .download(anexo.url_arquivo);
        if (error) throw error;
        const url = URL.createObjectURL(data);
        const a = document.createElement("a");
        a.href = url;
        a.download = anexo.nome_arquivo;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("Erro ao baixar arquivo:", err);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-[95vw] max-h-[95vh] p-0 gap-0 overflow-hidden [&>button]:hidden ${tipo === "pdf" ? "w-[95vw] sm:w-[90vw]" : "w-auto"}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur-sm">
          <div className="flex items-center gap-2 min-w-0">
            {getFileTypeIcon(nome, tipoArquivo)}
            <span className="text-sm font-medium truncate max-w-[300px]">{nome}</span>
          </div>
          <div className="flex items-center gap-1">
            {tipo === "image" && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
                <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <div className="w-px h-4 bg-border mx-1" />
              </>
            )}
            <Button variant="ghost" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="relative flex items-center justify-center bg-muted/30 min-h-[60vh] max-h-[calc(95vh-56px)] overflow-auto">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Carregando preview…</span>
            </div>
          ) : tipo === "image" && previewUrl ? (
            <div className="overflow-auto w-full h-full flex items-center justify-center p-4">
              <img
                src={previewUrl}
                alt={nome}
                style={{ transform: `scale(${zoom})`, transformOrigin: "center", transition: "transform 0.2s" }}
                className="max-w-full max-h-[calc(95vh-80px)] object-contain"
                draggable={false}
              />
            </div>
          ) : tipo === "pdf" && previewUrl ? (
            <iframe
              src={previewUrl + "#toolbar=1&navpanes=0"}
              title={nome}
              className="w-full h-[calc(95vh-56px)] border-0"
            />
          ) : tipo === "video" && previewUrl ? (
            <div className="flex items-center justify-center w-full h-full p-4">
              <video
                src={previewUrl}
                controls
                autoPlay={false}
                className="max-w-full max-h-[calc(95vh-80px)] rounded-md shadow-lg"
                style={{ maxHeight: "calc(95vh - 80px)" }}
              >
                Seu navegador não suporta reprodução de vídeo.
              </video>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-20">
              <FileText className="h-16 w-16 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Preview não disponível para este tipo de arquivo</p>
              <Button variant="outline" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Baixar arquivo
              </Button>
            </div>
          )}

          {/* Navigation arrows */}
          {hasPrev && (
            <button
              onClick={onPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm border shadow-sm flex items-center justify-center hover:bg-background transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {hasNext && (
            <button
              onClick={onNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm border shadow-sm flex items-center justify-center hover:bg-background transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
