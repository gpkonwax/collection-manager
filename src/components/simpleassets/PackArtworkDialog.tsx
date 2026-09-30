import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArtworkModeControls, DRAW_COLORS, ImageWithModes } from './InteractiveArtwork';
import type { ViewMode } from './InteractiveArtwork';

interface PackArtworkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  image?: string;
}

export function PackArtworkDialog({ open, onOpenChange, name, image }: PackArtworkDialogProps) {
  const [mode, setMode] = useState<ViewMode>('tilt');
  const [color, setColor] = useState(DRAW_COLORS[0].value);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (open) {
      setMode('tilt');
      setColor(DRAW_COLORS[0].value);
    }
  }, [open, image]);

  useEffect(() => {
    if (canvasRef.current) (canvasRef.current as HTMLCanvasElement & { __setColor?: (value: string) => void }).__setColor?.(color);
  }, [color, mode]);

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(94vw,520px)] max-w-none max-h-[94dvh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="text-cheese pr-6">{name}</DialogTitle>
          <DialogDescription className="sr-only">Enlarged pack artwork</DialogDescription>
        </DialogHeader>
        <div className="w-full max-w-[min(100%,400px,calc((94dvh-150px)*0.75))] mx-auto">
          {image && image !== '/placeholder.svg' ? (
            <ImageWithModes key={image + String(open)} url={image} alt={name} isLandscape={false} mode={mode} drawColor={color}
              canvasRegister={canvas => {
                canvasRef.current = canvas;
                if (canvas) (canvas as HTMLCanvasElement & { __setColor?: (value: string) => void }).__setColor?.(color);
              }} />
          ) : <div className="aspect-[3/4] bg-muted/30 flex items-center justify-center text-muted-foreground">Artwork unavailable</div>}
        </div>
        <ArtworkModeControls mode={mode} onModeChange={setMode} color={color} onColorChange={setColor} onClear={clear} subject="pack" />
      </DialogContent>
    </Dialog>
  );
}
