import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Bell, Clock, Info, Loader2, Plus, Save, X } from "lucide-react";
import {
  useNotificacaoAgenda,
  DIAS_SEMANA,
  MAX_HORARIOS,
  type NotificacaoAgenda,
} from "@/hooks/useNotificacaoAgenda";

const PADRAO = {
  ativo: true,
  dias_semana: [1, 2, 3, 4, 5],
  horarios: ["09:00", "14:00", "18:00"],
  timezone: "America/Sao_Paulo",
};

export function NotificacaoAgendaCard() {
  const { agenda, isLoading, salvar } = useNotificacaoAgenda();

  const [ativo, setAtivo] = useState(PADRAO.ativo);
  const [dias, setDias] = useState<number[]>(PADRAO.dias_semana);
  const [horarios, setHorarios] = useState<string[]>(PADRAO.horarios);
  const [timezone, setTimezone] = useState(PADRAO.timezone);
  const [alterado, setAlterado] = useState(false);

  useEffect(() => {
    if (!agenda) return;
    setAtivo(agenda.ativo);
    setDias(agenda.dias_semana ?? PADRAO.dias_semana);
    setHorarios(agenda.horarios?.length ? agenda.horarios : PADRAO.horarios);
    setTimezone(agenda.timezone || PADRAO.timezone);
    setAlterado(false);
  }, [agenda]);

  const alternarDia = (valor: number) => {
    setDias((prev) =>
      prev.includes(valor) ? prev.filter((d) => d !== valor) : [...prev, valor].sort((a, b) => a - b),
    );
    setAlterado(true);
  };

  const alterarHorario = (index: number, valor: string) => {
    setHorarios((prev) => prev.map((h, i) => (i === index ? valor : h)));
    setAlterado(true);
  };

  const adicionarHorario = () => {
    setHorarios((prev) => [...prev, "12:00"]);
    setAlterado(true);
  };

  const removerHorario = (index: number) => {
    setHorarios((prev) => prev.filter((_, i) => i !== index));
    setAlterado(true);
  };

  // Horários vazios ou repetidos travam o salvamento
  const horariosPreenchidos = horarios.filter(Boolean);
  const horariosUnicos = new Set(horariosPreenchidos).size === horariosPreenchidos.length;
  const podeSalvar =
    alterado &&
    dias.length > 0 &&
    horariosPreenchidos.length === horarios.length &&
    horarios.length > 0 &&
    horariosUnicos &&
    !salvar.isPending;

  const handleSalvar = () => {
    const payload: Partial<NotificacaoAgenda> = {
      ativo,
      dias_semana: dias,
      horarios: [...horarios].sort(),
      timezone,
    };
    salvar.mutate(payload, { onSuccess: () => setAlterado(false) });
  };

  if (isLoading) {
    return (
      <Card className="shadow-sm border-0 bg-card">
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border-0 bg-card">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Notificações por WhatsApp
        </CardTitle>
        <CardDescription>
          Escolha os dias e horários em que a equipe recebe o resumo das notificações. Cada usuário
          recebe uma única mensagem por horário, reunindo tudo que ficou pendente.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Liga/desliga */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Enviar resumos por WhatsApp</Label>
            <p className="text-xs text-muted-foreground">
              Desativado, as notificações continuam aparecendo no sino do sistema.
            </p>
          </div>
          <Switch
            checked={ativo}
            onCheckedChange={(v) => {
              setAtivo(v);
              setAlterado(true);
            }}
          />
        </div>

        <Separator />

        {/* Dias da semana */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Dias da semana</Label>
          <div className="flex flex-wrap gap-2">
            {DIAS_SEMANA.map((dia) => {
              const marcado = dias.includes(dia.valor);
              return (
                <button
                  key={dia.valor}
                  type="button"
                  onClick={() => alternarDia(dia.valor)}
                  disabled={!ativo}
                  aria-pressed={marcado}
                  aria-label={dia.nome}
                  className={`h-10 w-14 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 ${
                    marcado
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-accent"
                  }`}
                >
                  {dia.label}
                </button>
              );
            })}
          </div>
          {dias.length === 0 && (
            <p className="text-xs text-destructive">Selecione ao menos um dia.</p>
          )}
        </div>

        <Separator />

        {/* Horários */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Horários de envio
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={adicionarHorario}
              disabled={!ativo || horarios.length >= MAX_HORARIOS}
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {horarios.map((horario, index) => (
              <div key={index} className="flex items-center gap-1">
                <Input
                  type="time"
                  value={horario}
                  disabled={!ativo}
                  onChange={(e) => alterarHorario(index, e.target.value)}
                  aria-label={`Horário ${index + 1}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removerHorario(index)}
                  disabled={!ativo || horarios.length <= 1}
                  aria-label={`Remover horário ${index + 1}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {!horariosUnicos && (
            <p className="text-xs text-destructive">Há horários repetidos.</p>
          )}
          {horariosPreenchidos.length !== horarios.length && (
            <p className="text-xs text-destructive">Preencha todos os horários.</p>
          )}
        </div>

        <Separator />

        {/* Fuso */}
        <div className="space-y-2 max-w-xs">
          <Label htmlFor="agenda_timezone">Fuso horário dos envios</Label>
          <select
            id="agenda_timezone"
            className="w-full p-2 border border-border rounded-md bg-background text-foreground disabled:opacity-50"
            value={timezone}
            disabled={!ativo}
            onChange={(e) => {
              setTimezone(e.target.value);
              setAlterado(true);
            }}
          >
            <option value="America/Sao_Paulo">Brasília (GMT-3)</option>
            <option value="America/Manaus">Manaus (GMT-4)</option>
            <option value="America/Rio_Branco">Acre (GMT-5)</option>
            <option value="America/Belem">Belém (GMT-3)</option>
            <option value="America/Cuiaba">Cuiabá (GMT-4)</option>
          </select>
        </div>

        <div className="flex items-start gap-2 text-sm bg-blue-50 text-blue-700 rounded-lg p-3">
          <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-medium">Como funciona</p>
            <p className="mt-1">
              Notificações geradas entre um horário e outro ficam acumuladas e saem juntas no
              próximo horário marcado, em uma mensagem só, com um botão para confirmar o
              recebimento. Isso reduz o risco de o WhatsApp classificar os envios como spam.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSalvar} disabled={!podeSalvar}>
            {salvar.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar agenda
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
