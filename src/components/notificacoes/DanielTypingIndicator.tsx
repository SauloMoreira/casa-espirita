import { DanielAvatar } from "./DanielAvatar";
import { DANIEL_DIGITANDO_TEXTO } from "@/lib/danielChat";

/**
 * Conversational "typing" indicator for Daniel — three pulsing dots inside a
 * chat bubble with Daniel's avatar. Purely visual; it conveys that the IA is
 * preparing a reply without implying any stall or failure.
 */
export function DanielTypingIndicator() {
  return (
    <div className="flex items-end gap-2" aria-live="polite" role="status">
      <DanielAvatar size={28} />
      <div className="flex flex-col gap-1 items-start">
        <div className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2.5">
          <span className="flex items-center gap-1">
            <Dot delay="0ms" />
            <Dot delay="150ms" />
            <Dot delay="300ms" />
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">{DANIEL_DIGITANDO_TEXTO}</span>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60"
      style={{ animationDelay: delay, animationDuration: "1s" }}
    />
  );
}
