import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { FiltrosAtivos } from "@/hooks/useMapaCruzado";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Usaremos checkboxes para evitar o problema do Select vazio
import { Checkbox } from "@/components/ui/checkbox";

interface FiltrosCruzadosProps {
  filtros: FiltrosAtivos;
  onChange: (filtros: FiltrosAtivos) => void;
}

export function FiltrosCruzados({ filtros, onChange }: FiltrosCruzadosProps) {
  
  // Busca opções de Tags
  const { data: tags = [] } = useQuery({
    queryKey: ['tags-filtro'],
    queryFn: async () => {
      const { data } = await supabase.from('tags').select('nome');
      return data?.map(t => t.nome) || [];
    }
  });

  // Busca opções de Áreas
  const { data: areas = [] } = useQuery({
    queryKey: ['areas-filtro'],
    queryFn: async () => {
      const { data } = await supabase.from('areas').select('nome');
      return data?.map(a => a.nome) || [];
    }
  });

  const toggleArea = (area: string) => {
    const novasAreas = filtros.areas.includes(area)
      ? filtros.areas.filter(a => a !== area)
      : [...filtros.areas, area];
    onChange({ ...filtros, areas: novasAreas });
  };

  const toggleTag = (tag: string) => {
    const novasTags = filtros.tags.includes(tag)
      ? filtros.tags.filter(t => t !== tag)
      : [...filtros.tags, tag];
    onChange({ ...filtros, tags: novasTags });
  };

  const limparFiltros = () => {
    onChange({ areas: [], tags: [] });
  };

  return (
    <div className="space-y-6">
      {(filtros.areas.length > 0 || filtros.tags.length > 0) && (
        <div className="bg-slate-50 p-3 rounded-md border border-slate-100">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Filtros Ativos</span>
            <Button variant="ghost" size="sm" onClick={limparFiltros} className="h-6 text-xs text-red-500 hover:text-red-700">
              Limpar tudo <X className="w-3 h-3 ml-1" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {filtros.areas.map(a => (
              <Badge key={a} variant="secondary" className="text-xs border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100">
                {a}
              </Badge>
            ))}
            {filtros.tags.map(t => (
              <Badge key={t} variant="secondary" className="text-xs border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                #{t}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Áreas */}
      <div>
        <Label className="text-sm font-bold text-gray-700 mb-3 block">Áreas (Demandas)</Label>
        <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
          {areas.map((area) => (
            <div key={area} className="flex items-center space-x-2">
              <Checkbox 
                id={`area-${area}`} 
                checked={filtros.areas.includes(area)}
                onCheckedChange={() => toggleArea(area)}
              />
              <label
                htmlFor={`area-${area}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {area}
              </label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Tags */}
      <div>
        <Label className="text-sm font-bold text-gray-700 mb-3 block">Tags (Munícipes)</Label>
        <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
          {tags.map((tag) => (
            <div key={tag} className="flex items-center space-x-2">
              <Checkbox 
                id={`tag-${tag}`} 
                checked={filtros.tags.includes(tag)}
                onCheckedChange={() => toggleTag(tag)}
              />
              <label
                htmlFor={`tag-${tag}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {tag}
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Pequeno helper para o separador se não tiver importado
function Separator() {
    return <div className="h-[1px] w-full bg-gray-200 my-4"></div>
}
