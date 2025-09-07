import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

interface LoadingDialogProps {
  open: boolean;
  message?: string;
}

export function LoadingDialog({ open, message = 'Carregando...' }: LoadingDialogProps) {
  return (
    <Dialog open={open}>
      <DialogContent className="max-w-sm">
        <div className="flex flex-col items-center justify-center p-6 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-center text-muted-foreground">{message}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}