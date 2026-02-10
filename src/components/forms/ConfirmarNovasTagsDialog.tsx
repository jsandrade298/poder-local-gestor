import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tag, Plus, Check, X } from "lucide-react";

const colorOptions = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // yellow
  "#8b5cf6", // purple
  "#ef4444", // red
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#f97316", // orange
  "#ec4899", // pink
  "#6b7280"  // gray
];

const colorNames: Record<string, string> = {
  "#3b82f6": "Azul",
  "#10b981": "Verde",
  "#f59e0b": "Amarelo",
  "#8b5cf6": "Roxo",
  "#ef4444": "Vermelho",
  "#06b6d4": "Ciano",
  "#84cc16": "Lima",
  "#f97316": "Laranja",
  "#ec4899": "Rosa",
  "#6b7280": "Cinza"
};

export interface NewTagData {
  nome: string;
  cor: string;
}

interface ConfirmarNovasTagsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newTags: string[];
  onConfirm: (tags: NewTagData[]) => void;
  onSkip: () => void;
}

export function ConfirmarNovasTagsDialog({
  open,
  onOpenChange,
  newTags,
  onConfirm,
  onSkip
}: ConfirmarNovasTagsDialogProps) {
  // Inicializar cada tag com uma cor aleatória diferente
  const [tagColors, setTagColors] = useState<Record<string, string>>({});

  // Atualizar quando newTags mudam
  useEffect(() => {
    if (newTags.length > 0) {
      const initial: Record<string, string> = {};
      newTags.forEach((tag, index) => {
        initial[tag] = colorOptions[index % colorOptions.length];
      });
      setTagColors(initial);
    }
  }, [newTags]);

  const handleColorChange = (tagName: string, color: string) => {
    setTagColors(prev => ({ ...prev, [tagName]: color }));
  };

  const handleConfirm = () => {
    const tagsData: NewTagData[] = newTags.map(nome => ({
      nome,
      cor: tagColors[nome] || colorOptions[0]
    }));
    onConfirm(tagsData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-blue-500" />
            Novas Tags Encontradas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <p className="text-sm text-muted-foreground">
            A planilha contém <strong>{newTags.length} tag{newTags.length > 1 ? 's' : ''}</strong> que 
            ainda não existe{newTags.length > 1 ? 'm' : ''} no sistema. 
            Escolha uma cor para cada tag e confirme a criação, ou pule para importar sem essas tags.
          </p>

          <ScrollArea className="flex-1 max-h-[400px] pr-4">
            <div className="space-y-4">
              {newTags.map((tagName) => (
                <div key={tagName} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge 
                      style={{ backgroundColor: tagColors[tagName], color: 'white' }}
                      className="text-sm px-3 py-1"
                    >
                      {tagName}
                    </Badge>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {colorNames[tagColors[tagName]] || 'Cor'}
                    </span>
                  </div>
                  
                  <div className="flex gap-2 flex-wrap">
                    {colorOptions.map((color) => (
                      <button
                        key={color}
                        className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${
                          tagColors[tagName] === color 
                            ? 'border-foreground scale-110 ring-2 ring-offset-2 ring-offset-background' 
                            : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => handleColorChange(tagName, color)}
                        title={colorNames[color]}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex gap-2 sm:justify-between">
          <Button variant="outline" onClick={onSkip} className="gap-2">
            <X className="h-4 w-4" />
            Pular (não criar tags)
          </Button>
          <Button onClick={handleConfirm} className="gap-2">
            <Plus className="h-4 w-4" />
            Criar {newTags.length} Tag{newTags.length > 1 ? 's' : ''} e Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
