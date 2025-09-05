import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CategoriaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (categoria: string) => void;
}

const CATEGORIAS_PREDEFINIDAS = [
  'Requerimento',
  'Indicação',
  'Projeto de Lei',
  'Moção',
  'Ofício',
  'Parecer',
  'Relatório',
  'Outros'
];

export const CategoriaDialog = ({ open, onOpenChange, onConfirm }: CategoriaDialogProps) => {
  const [categoriaSelecionada, setCategoriaSelecionada] = useState('');
  const [categoriaCustom, setCategoriaCustom] = useState('');
  const [usarCustom, setUsarCustom] = useState(false);

  const handleConfirm = () => {
    const categoria = usarCustom ? categoriaCustom.trim() : categoriaSelecionada;
    if (categoria) {
      onConfirm(categoria);
      onOpenChange(false);
      // Reset form
      setCategoriaSelecionada('');
      setCategoriaCustom('');
      setUsarCustom(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    // Reset form
    setCategoriaSelecionada('');
    setCategoriaCustom('');
    setUsarCustom(false);
  };

  const isValid = usarCustom ? categoriaCustom.trim().length > 0 : categoriaSelecionada.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Selecionar Categoria do Documento</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select
              value={usarCustom ? '' : categoriaSelecionada}
              onValueChange={(value) => {
                setCategoriaSelecionada(value);
                setUsarCustom(false);
              }}
              disabled={usarCustom}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS_PREDEFINIDAS.map((categoria) => (
                  <SelectItem key={categoria} value={categoria}>
                    {categoria}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <hr className="flex-1" />
            <span className="text-xs text-muted-foreground">ou</span>
            <hr className="flex-1" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="custom"
                checked={usarCustom}
                onChange={(e) => {
                  setUsarCustom(e.target.checked);
                  if (e.target.checked) {
                    setCategoriaSelecionada('');
                  } else {
                    setCategoriaCustom('');
                  }
                }}
                className="rounded"
              />
              <Label htmlFor="custom" className="text-sm">
                Criar categoria personalizada
              </Label>
            </div>
            
            {usarCustom && (
              <Input
                value={categoriaCustom}
                onChange={(e) => setCategoriaCustom(e.target.value)}
                placeholder="Digite o nome da categoria"
                autoFocus
              />
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid}>
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};