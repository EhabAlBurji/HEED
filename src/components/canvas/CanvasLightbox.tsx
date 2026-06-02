import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

export type LightboxContent =
  | { kind: "image"; src: string }
  | { kind: "video-embed"; src: string }
  | { kind: "video"; src: string };

// Fullscreen viewer for image/video nodes (opened on double-click).
export function CanvasLightbox({
  content,
  onClose,
}: {
  content: LightboxContent | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!content) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [content, onClose]);

  if (!content) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute end-5 top-5 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        title={t("canvas.close")}
      >
        <X className="h-5 w-5" />
      </button>

      <div className="max-h-[92vh] max-w-[92vw]" onClick={(e) => e.stopPropagation()}>
        {content.kind === "image" && (
          <img
            src={content.src}
            alt=""
            className="max-h-[92vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
          />
        )}
        {content.kind === "video-embed" && (
          <iframe
            src={content.src}
            title="video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
            className="h-[80vh] w-[80vw] rounded-lg bg-black shadow-2xl"
          />
        )}
        {content.kind === "video" && (
          <video
            src={content.src}
            controls
            autoPlay
            className="max-h-[92vh] max-w-[92vw] rounded-lg bg-black shadow-2xl"
          />
        )}
      </div>
    </div>
  );
}
