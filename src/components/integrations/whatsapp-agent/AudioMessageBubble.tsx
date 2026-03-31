import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Volume2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const TRANSCRIPTION_PREVIEW_LENGTH = 150;

interface AudioMessageBubbleProps {
  url: string;
  fromMe: boolean;
  transcription?: string | null;
}

export function AudioMessageBubble({ url, fromMe, transcription }: AudioMessageBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  };

  const formatTime = (s: number) => {
    if (!s || !isFinite(s)) return "0:00";
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  };

  const isLong = transcription && transcription.length > TRANSCRIPTION_PREVIEW_LENGTH;
  const displayText = transcription
    ? expanded || !isLong
      ? transcription
      : transcription.slice(0, TRANSCRIPTION_PREVIEW_LENGTH) + "…"
    : null;

  return (
    <div className="flex flex-col gap-1.5 min-w-[180px]">
      <div className="flex items-center gap-2">
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onTimeUpdate={(e) => {
            const ct = e.currentTarget;
            setProgress(ct.duration ? (ct.currentTime / ct.duration) * 100 : 0);
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false);
            setProgress(0);
          }}
        />

        <Button
          size="icon"
          variant="ghost"
          className={cn(
            "h-8 w-8 shrink-0",
            fromMe ? "text-primary-foreground hover:text-primary-foreground/80" : "text-foreground"
          )}
          onClick={togglePlay}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>

        <div className="flex-1 flex flex-col gap-1">
          <div className="h-1 rounded-full bg-current/20 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                fromMe ? "bg-primary-foreground/70" : "bg-primary"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] opacity-70">{formatTime(isPlaying ? (audioRef.current?.currentTime ?? 0) : duration)}</span>
            <Volume2 className="h-3 w-3 opacity-50" />
          </div>
        </div>
      </div>

      {displayText && (
        <div className={cn(
          "text-xs leading-relaxed opacity-80 border-t pt-1.5 mt-0.5",
          fromMe ? "border-primary-foreground/20" : "border-border"
        )}>
          <p className="whitespace-pre-wrap break-words italic">{displayText}</p>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className={cn(
                "flex items-center gap-0.5 text-[10px] font-medium mt-1 hover:opacity-100 transition-opacity",
                fromMe ? "text-primary-foreground/70" : "text-primary/70"
              )}
            >
              {expanded ? (
                <>Ver menos <ChevronUp className="h-3 w-3" /></>
              ) : (
                <>Ver mais <ChevronDown className="h-3 w-3" /></>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
