import { useState, useEffect } from "react";
import { PageLayout } from "@/components/PageLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tv, Play, Layout } from "lucide-react";
import { tvPresentationService, TVPresentation } from "@/services/tvPresentationService";
import { toast } from "sonner";

export default function TVPublished() {
  const [presentations, setPresentations] = useState<TVPresentation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPresentations();
  }, []);

  const loadPresentations = async () => {
    try {
      setLoading(true);
      // Busca apenas as apresentações ativas
      const data = await tvPresentationService.listPresentations(true);
      setPresentations(data);
    } catch (error) {
      console.error("Erro ao carregar apresentações:", error);
      toast.error("Erro ao carregar apresentações publicadas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageLayout title="Apresentações Publicadas">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gradient-cyan flex items-center gap-2">
            <Tv className="w-8 h-8" />
            Apresentações Publicadas
          </h1>
          <p className="text-muted-foreground mt-2">
            Visualize as apresentações de dashboards disponíveis para exibição.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {presentations.length === 0 ? (
              <Card className="col-span-full p-12 flex flex-col items-center justify-center text-center border-dashed">
                <Layout className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Nenhuma apresentação disponível</h3>
                <p className="text-muted-foreground max-w-xs mx-auto">
                  No momento não há apresentações de TV ativas para exibição.
                </p>
              </Card>
            ) : (
              presentations.map((p) => (
                <Card key={p.id} className="glass-card hover:border-primary/50 transition-all">
                  <CardHeader>
                    <CardTitle>{p.name}</CardTitle>
                    <CardDescription>
                      Disponível para visualização
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      variant="outline" 
                      className="w-full gap-2"
                      onClick={() => window.open(`/tv-viewer/${p.id}`, '_blank')}
                    >
                      <Play className="w-4 h-4" />
                      Assistir Apresentação
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
