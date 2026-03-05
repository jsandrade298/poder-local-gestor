import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NovoMunicipeDialog } from "@/components/forms/NovoMunicipeDialog";
import { EditMunicipeDialog } from "@/components/forms/EditMunicipeDialog";
import { MunicipeDetailsDialog } from "@/components/forms/MunicipeDetailsDialog";
import { NovaDemandaDialog } from "@/components/forms/NovaDemandaDialog";
import {
  Search, MapPin, Phone, Mail, FileText, Users, Eye, Edit,
} from "lucide-react";

export default function RepresentanteMunicipes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selectedMunicipe, setSelectedMunicipe] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [municipeToEdit, setMunicipeToEdit] = useState<any>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const { data: municipes = [], isLoading } = useQuery({
    queryKey: ["rep-municipes", debounced],
    queryFn: async () => {
      let query = supabase
        .from("municipes")
        .select("id, nome, telefone, email, bairro, cidade, estado, criado_em, categoria_id, _count_demandas:demandas(count)")
        .order("nome");

      if (debounced) {
        query = query.or(`nome.ilike.%${debounced}%,telefone.ilike.%${debounced}%,bairro.ilike.%${debounced}%`);
      }

      const { data } = await query;
      return data || [];
    },
  });

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
            {municipes.length} munícipe{municipes.length !== 1 ? "s" : ""} cadastrado{municipes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <NovoMunicipeDialog />
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nome, telefone ou bairro..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : municipes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">
              {debounced ? "Nenhum resultado para esta busca" : "Nenhum munícipe cadastrado ainda"}
            </p>
            {!debounced && (
              <div className="mt-4">
                <NovoMunicipeDialog />
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {municipes.map((m: any) => {
            const totalDemandas = m._count_demandas?.[0]?.count ?? 0;
            return (
              <Card key={m.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-semibold text-primary">
                          {m.nome?.charAt(0)?.toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{m.nome}</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {m.bairro && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {m.bairro}
                            </span>
                          )}
                          {m.telefone && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {m.telefone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {totalDemandas > 0 && (
                      <Badge variant="secondary" className="flex items-center gap-1 flex-shrink-0">
                        <FileText className="h-3 w-3" />
                        {totalDemandas}
                      </Badge>
                    )}
                  </div>

                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1"
                      onClick={() => {
                        setSelectedMunicipe(m);
                        setShowDetails(true);
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Ver
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1"
                      onClick={() => {
                        setMunicipeToEdit(m);
                        setShowEdit(true);
                      }}
                    >
                      <Edit className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                    <NovaDemandaDialog />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      {selectedMunicipe && (
        <MunicipeDetailsDialog
          municipe={selectedMunicipe}
          open={showDetails}
          onOpenChange={setShowDetails}
        />
      )}
      {municipeToEdit && (
        <EditMunicipeDialog
          municipe={municipeToEdit}
          open={showEdit}
          onOpenChange={setShowEdit}
        />
      )}
    </div>
  );
}
