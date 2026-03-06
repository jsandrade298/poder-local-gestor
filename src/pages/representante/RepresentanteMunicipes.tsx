import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NovoMunicipeDialog } from "@/components/forms/NovoMunicipeDialog";
import { EditMunicipeDialog } from "@/components/forms/EditMunicipeDialog";
import { MunicipeDetailsDialog } from "@/components/forms/MunicipeDetailsDialog";
import { NovaDemandaDialog } from "@/components/forms/NovaDemandaDialog";
import { Search, MapPin, Phone, FileText, Users, Eye, Edit, SlidersHorizontal, X, Inbox } from "lucide-react";

export default function RepresentanteMunicipes() {
  const { user } = useAuth();
  const uid = user?.id;

  const [searchTerm, setSearchTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [bairroFilter, setBairroFilter] = useState("todos");
  const [cidadeFilter, setCidadeFilter] = useState("todos");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedMunicipe, setSelectedMunicipe] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [municipeToEdit, setMunicipeToEdit] = useState<any>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // ═══════════════════════════════════════════════════════════
  // FIX: Filtrar por representante_id = uid (profile.id do representante)
  // ═══════════════════════════════════════════════════════════
  const { data: municipes = [], isLoading } = useQuery({
    queryKey: ["rep-municipes", uid, debounced, bairroFilter, cidadeFilter],
    enabled: !!uid,
    queryFn: async () => {
      let query = supabase
        .from("municipes")
        .select("id, nome, telefone, email, bairro, cidade, estado, created_at, categoria_id")
        .eq("representante_id", uid!)
        .order("nome");

      if (debounced) {
        query = query.or(`nome.ilike.%${debounced}%,telefone.ilike.%${debounced}%,email.ilike.%${debounced}%`);
      }
      if (bairroFilter !== "todos") query = query.eq("bairro", bairroFilter);
      if (cidadeFilter !== "todos") query = query.eq("cidade", cidadeFilter);

      const { data } = await query;
      return data || [];
    },
  });

  const bairros = [...new Set(municipes.map((m: any) => m.bairro).filter(Boolean))].sort();
  const cidades = [...new Set(municipes.map((m: any) => m.cidade).filter(Boolean))].sort();
  const activeFilters = [bairroFilter !== "todos", cidadeFilter !== "todos"].filter(Boolean).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Meus Munícipes
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {municipes.length} munícipe{municipes.length !== 1 ? "s" : ""} vinculado{municipes.length !== 1 ? "s" : ""} a você
          </p>
        </div>
        <NovoMunicipeDialog />
      </div>

      {/* Busca + filtros */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nome, telefone ou email..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <Button variant="outline" size="icon" onClick={() => setShowFilters(!showFilters)}
          className="relative flex-shrink-0">
          <SlidersHorizontal className="h-4 w-4" />
          {activeFilters > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">
              {activeFilters}
            </span>
          )}
        </Button>
      </div>

      {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-muted/40 rounded-lg border">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Bairro</label>
            <Select value={bairroFilter} onValueChange={setBairroFilter}>
              <SelectTrigger><SelectValue placeholder="Todos os bairros" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os bairros</SelectItem>
                {bairros.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Cidade</label>
            <Select value={cidadeFilter} onValueChange={setCidadeFilter}>
              <SelectTrigger><SelectValue placeholder="Todas as cidades" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as cidades</SelectItem>
                {cidades.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {activeFilters > 0 && (
            <div className="sm:col-span-2 flex justify-end">
              <Button variant="ghost" size="sm" className="gap-1 text-xs"
                onClick={() => { setBairroFilter("todos"); setCidadeFilter("todos"); }}>
                <X className="h-3 w-3" /> Limpar filtros
              </Button>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : municipes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <h3 className="text-base font-medium mb-1">
              {debounced || activeFilters > 0 ? "Nenhum resultado para esta busca" : "Nenhum munícipe cadastrado ainda"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {debounced || activeFilters > 0
                ? "Tente ajustar os filtros ou a busca"
                : "Comece cadastrando seu primeiro munícipe"}
            </p>
            {!debounced && activeFilters === 0 && <NovoMunicipeDialog />}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {municipes.map((m: any) => (
            <Card key={m.id} className="hover:shadow-md transition-all">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-primary">
                      {m.nome?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{m.nome}</p>
                    <div className="flex flex-wrap gap-x-3 mt-1">
                      {m.bairro && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />{m.bairro}{m.cidade ? `, ${m.cidade}` : ""}
                        </span>
                      )}
                      {m.telefone && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />{m.telefone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" className="flex-1 gap-1"
                    onClick={() => { setSelectedMunicipe(m); setShowDetails(true); }}>
                    <Eye className="h-3.5 w-3.5" />Ver
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 gap-1"
                    onClick={() => { setMunicipeToEdit(m); setShowEdit(true); }}>
                    <Edit className="h-3.5 w-3.5" />Editar
                  </Button>
                  <NovaDemandaDialog />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedMunicipe && (
        <MunicipeDetailsDialog municipe={selectedMunicipe} open={showDetails} onOpenChange={setShowDetails} />
      )}
      {municipeToEdit && (
        <EditMunicipeDialog municipe={municipeToEdit} open={showEdit} onOpenChange={setShowEdit} />
      )}
    </div>
  );
}
