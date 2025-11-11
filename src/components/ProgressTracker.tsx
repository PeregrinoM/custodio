import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface ProgressTrackerProps {
  status: string;
  current: number;
  total: number;
  startTime: number;
  itemName?: string; // e.g., "capítulo", "elemento"
  title: string;
  itemLabel?: string; // Current item being processed
}

export const ProgressTracker = ({ 
  status, 
  current, 
  total, 
  startTime,
  itemName = "elemento",
  title,
  itemLabel
}: ProgressTrackerProps) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  // Cálculos
  const progress = total > 0 ? Math.round((current / total) * 100) : 0;
  const speed = elapsedSeconds > 0 ? (current / elapsedSeconds) * 60 : 0;
  const remaining = total - current;
  const estimatedSeconds = speed > 0 && remaining > 0 ? (remaining / speed) * 60 : 0;

  // Formatear tiempo MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Formatear tiempo restante estimado
  const formatEstimated = (seconds: number) => {
    if (seconds <= 0 || !isFinite(seconds)) return "Calculando...";
    if (seconds < 60) return `~${Math.ceil(seconds)}s`;
    const mins = Math.ceil(seconds / 60);
    return `~${mins} min`;
  };

  return (
    <Card className="p-6 bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <h3 className="font-semibold text-blue-900 dark:text-blue-100">{title}</h3>
        </div>

        {/* Status message */}
        <p className="text-sm font-medium text-blue-800 dark:text-blue-200">{status}</p>

        {/* Time metrics */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-blue-600 dark:text-blue-400 font-medium">⏱️ Transcurrido</p>
            <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{formatTime(elapsedSeconds)}</p>
          </div>
          <div>
            <p className="text-blue-600 dark:text-blue-400 font-medium">🚀 Velocidad</p>
            <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
              {speed > 0 ? `${speed.toFixed(1)} ${itemName}s/min` : "Calculando..."}
            </p>
          </div>
          <div>
            <p className="text-blue-600 dark:text-blue-400 font-medium">⏳ Estimado</p>
            <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
              {formatEstimated(estimatedSeconds)}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium text-blue-800 dark:text-blue-200">
                {progress}% ({current} / {total} {itemName}s)
              </span>
            </div>
            <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Current item label */}
        {itemLabel && (
          <p className="text-xs text-blue-700 dark:text-blue-300 truncate">
            📝 Procesando: {itemLabel}
          </p>
        )}
      </div>
    </Card>
  );
};
