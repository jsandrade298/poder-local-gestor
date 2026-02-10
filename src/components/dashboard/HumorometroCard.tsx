import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface HumorometroCardProps {
  emoji: string;
  media: number;
  mediaSlug: string;
  total: number;
  distribuicao: Array<{
    slug: string;
    emoji: string;
    count: number;
  }>;
}

const humorLabels: Record<string, string> = {
  muito_insatisfeito: "Muito Insatisfeito",
  insatisfeito: "Insatisfeito",
  neutro: "Neutro",
  satisfeito: "Satisfeito",
  muito_satisfeito: "Muito Satisfeito",
};

const humorColors: Record<string, string> = {
  muito_insatisfeito: "bg-red-500",
  insatisfeito: "bg-orange-400",
  neutro: "bg-yellow-400",
  satisfeito: "bg-lime-400",
  muito_satisfeito: "bg-emerald-500",
};

const humorTextColors: Record<string, string> = {
  muito_insatisfeito: "text-red-600 dark:text-red-400",
  insatisfeito: "text-orange-600 dark:text-orange-400",
  neutro: "text-yellow-600 dark:text-yellow-400",
  satisfeito: "text-lime-600 dark:text-lime-400",
  muito_satisfeito: "text-emerald-600 dark:text-emerald-400",
};

export function HumorometroCard({
  emoji,
  media,
  mediaSlug,
  total,
  distribuicao,
}: HumorometroCardProps) {
  const maxCount = Math.max(...distribuicao.map((d) => d.count), 1);

  return (
    <Card className="border border-border/50 shadow-sm h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <span className="text-lg">🎭</span>
          Humorômetro
          <span className="text-xs font-normal text-muted-foreground ml-auto">
            {total} {total === 1 ? "avaliação" : "avaliações"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {total === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
            <span className="text-4xl mb-2 opacity-40">😶</span>
            <p className="text-sm text-muted-foreground">
              Nenhuma avaliação de humor registrada
            </p>
          </div>
        ) : (
          <>
            {/* Big emoji + label */}
            <div className="text-center py-3">
              <div className="text-6xl mb-1 leading-none">{emoji}</div>
              <div
                className={`text-sm font-semibold mt-2 ${
                  humorTextColors[mediaSlug] || "text-foreground"
                }`}
              >
                {humorLabels[mediaSlug] || "Neutro"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Nota média: {media.toFixed(1)} / 5.0
              </div>
            </div>

            {/* Distribution bars */}
            <div className="space-y-2 mt-auto pt-3 border-t border-border/40">
              {distribuicao.map((item) => (
                <div key={item.slug} className="flex items-center gap-2">
                  <span className="text-base w-6 text-center flex-shrink-0">
                    {item.emoji}
                  </span>
                  <div className="flex-1 h-5 bg-muted/60 rounded-full overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        humorColors[item.slug] || "bg-gray-400"
                      }`}
                      style={{
                        width: `${
                          maxCount > 0
                            ? Math.max((item.count / maxCount) * 100, item.count > 0 ? 8 : 0)
                            : 0
                        }%`,
                      }}
                    />
                    {item.count > 0 && (
                      <span className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-medium text-foreground/70">
                        {item.count}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
