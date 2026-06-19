import danielAvatar from "@/assets/daniel-avatar.png";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  /** Pixel size of the square avatar. Defaults to 32. */
  size?: number;
}

/**
 * Visual identity for Daniel, the FER virtual assistant. Used on IA messages
 * and the typing indicator so users can clearly tell who is speaking.
 */
export function DanielAvatar({ className, size = 32 }: Props) {
  return (
    <img
      src={danielAvatar}
      alt="Daniel, assistente virtual da FER"
      loading="lazy"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={cn(
        "shrink-0 rounded-full border border-border/60 bg-card object-cover ring-1 ring-primary/15",
        className,
      )}
    />
  );
}
