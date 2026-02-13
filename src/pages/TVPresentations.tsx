import { useState, useEffect } from "react";
import { PageLayout } from "@/components/PageLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Plus, 
  Tv, 
  Trash2, 
  Play, 
  Settings, 
  ArrowLeft, 
  Clock, 
  Layout,
  ChevronRight,
  GripVertical
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from "@/components/ui/dialog";
import { 
  tvPresentationService, 
  TVPresentation, 
  TVPresentationSlide 
} from "@/services/tvPresentationService";
import { 
  getAllReports, 
  getReportPages, 
  Report, 
  ReportPage 
} from "@/services/powerBiApiService";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Switch } from "@/components/ui/switch";

export default function TVPresentations() {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  
  const [presentations, setPresentations] = useState<TVPresentation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [presentationToDelete, setPresentationToDelete] = useState<string | null>(null);
  const [newPresentationName, setNewPresentationName] = useState("");
  const [newPresentationActive, setNewPresentationActive] = useState(true);
  
  // States for Editing
  const [editingPresentation, setEditingPresentation] = useState<(TVPresentation & { tv_presentation_slides: TVPresentationSlide[] }) | null>(null);
  const [editPresentationName, setEditPresentationName] = useState("");
  const [editPresentationActive, setEditPresentationActive] = useState(true);
  const [availableReports, setAvailableReports] = useState<Report[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string>("");
  const [availablePages, setAvailablePages] = useState<ReportPage[]>([]);
  const [selectedPageName, setSelectedPageName] = useState<string>("");
  const [slideDuration, setSlideDuration] = useState<number>(30);
  const [isAddingSlide, setIsAddingSlide] = useState(false);

  useEffect(() => {
    loadPresentations();
    loadReports();
  }, []);

  const loadPresentations = async () => {
    try {
      setLoading(true);
      const data = await tvPresentationService.listPresentations();
      setPresentations(data);
    } catch (error) {
      console.error("Erro ao carregar apresentações:", error);
      toast.error("Erro ao carregar apresentações");
    } finally {
      setLoading(false);
    }
  };

  const loadReports = async () => {
    try {
      const reports = await getAllReports();
      setAvailableReports(reports);
    } catch (error) {
      console.error("Erro ao carregar relatórios:", error);
    }
  };

  const handleCreatePresentation = async () => {
    if (!newPresentationName.trim() || !user) return;
    
    try {
      await tvPresentationService.createPresentation(newPresentationName, user.id, newPresentationActive);
      toast.success("Apresentação criada com sucesso");
      setNewPresentationName("");
      setNewPresentationActive(true);
      setIsCreateDialogOpen(false);
      loadPresentations();
    } catch (error) {
      toast.error("Erro ao criar apresentação");
    }
  };

  const handleEditPresentation = async (id: string) => {
    try {
      const presentation = await tvPresentationService.getPresentation(id);
      setEditingPresentation(presentation);
      setEditPresentationName(presentation.name);
      setEditPresentationActive(presentation.is_active);
      setIsEditDialogOpen(true);
    } catch (error) {
      toast.error("Erro ao carregar detalhes da apresentação");
    }
  };

  const handleUpdatePresentationInfo = async () => {
    if (!editingPresentation || !editPresentationName.trim()) return;
    
    try {
      await tvPresentationService.updatePresentation(editingPresentation.id, editPresentationName, editPresentationActive);
      toast.success("Apresentação atualizada");
      loadPresentations();
      const updated = await tvPresentationService.getPresentation(editingPresentation.id);
      setEditingPresentation(updated);
    } catch (error) {
      toast.error("Erro ao atualizar apresentação");
    }
  };

  const handleDeletePresentation = async () => {
    if (!presentationToDelete) return;
    try {
      await tvPresentationService.deletePresentation(presentationToDelete);
      toast.success("Apresentação excluída");
      setIsDeleteDialogOpen(false);
      setPresentationToDelete(null);
      loadPresentations();
    } catch (error) {
      toast.error("Erro ao excluir apresentação");
    }
  };

  const handleReportChange = async (reportId: string) => {
    setSelectedReportId(reportId);
    setSelectedPageName("");
    setAvailablePages([]);
    
    const report = availableReports.find(r => r.id === reportId);
    if (report) {
      try {
        const pages = await getReportPages(report.workspaceId, reportId);
        setAvailablePages(pages);
      } catch (error) {
        toast.error("Erro ao carregar páginas do relatório");
      }
    }
  };

  const handleAddSlide = async () => {
    if (!editingPresentation || !selectedReportId || !selectedPageName) return;
    
    const report = availableReports.find(r => r.id === selectedReportId);
    const page = availablePages.find(p => p.name === selectedPageName);
    
    if (!report || !page) return;

    try {
      setIsAddingSlide(true);
      await tvPresentationService.addSlide({
        presentation_id: editingPresentation.id,
        workspace_id: report.workspaceId,
        report_id: report.id,
        report_name: report.name,
        embed_url: report.embedUrl,
        page_name: page.name,
        page_display_name: page.displayName,
        duration: slideDuration,
        order_index: editingPresentation.tv_presentation_slides.length
      });
      
      // Refresh editing presentation
      const updated = await tvPresentationService.getPresentation(editingPresentation.id);
      setEditingPresentation(updated);
      
      // Reset form
      setSelectedPageName("");
      toast.success("Slide adicionado");
    } catch (error) {
      toast.error("Erro ao adicionar slide");
    } finally {
      setIsAddingSlide(false);
    }
  };

  const handleDeleteSlide = async (slideId: string) => {
    try {
      await tvPresentationService.deleteSlide(slideId);
      if (editingPresentation) {
        const updated = await tvPresentationService.getPresentation(editingPresentation.id);
        setEditingPresentation(updated);
      }
      toast.success("Slide removido");
    } catch (error) {
      toast.error("Erro ao remover slide");
    }
  };

  return (
    <PageLayout title="Apresentações para TV">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gradient-cyan flex items-center gap-2">
              <Tv className="w-8 h-8" />
              Apresentações para TV
            </h1>
            <p className="text-muted-foreground mt-2">
              Crie e gerencie apresentações em slides de dashboards para exibir em TVs.
            </p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nova Apresentação
          </Button>
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
                <h3 className="text-lg font-medium">Nenhuma apresentação encontrada</h3>
                <p className="text-muted-foreground max-w-xs mx-auto">
                  Crie sua primeira apresentação para começar a exibir seus dashboards na TV.
                </p>
              </Card>
            ) : (
              presentations.map((p) => (
                <Card key={p.id} className="glass-card hover:border-primary/50 transition-all">
                  <CardHeader className="relative">
                    <div className="flex justify-between items-start">
                      <CardTitle>{p.name}</CardTitle>
                      <Badge variant={p.is_active ? "default" : "secondary"} className={p.is_active ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : ""}>
                        {p.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <CardDescription>
                      Criada em {new Date(p.created_at).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="flex-1 gap-2"
                      onClick={() => window.open(`/tv-viewer/${p.id}`, '_blank')}
                    >
                      <Play className="w-4 h-4" />
                      Assistir
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => handleEditPresentation(p.id)}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setPresentationToDelete(p.id);
                        setIsDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Create Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="glass-card">
            <DialogHeader>
              <DialogTitle>Nova Apresentação</DialogTitle>
              <DialogDescription>
                Dê um nome para a sua apresentação de TV.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Apresentação</Label>
                <Input 
                  id="name" 
                  value={newPresentationName} 
                  onChange={(e) => setNewPresentationName(e.target.value)}
                  placeholder="Ex: Dashboards Diretoria"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="active">Apresentação Ativa</Label>
                <Switch 
                  id="active" 
                  checked={newPresentationActive} 
                  onCheckedChange={setNewPresentationActive}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreatePresentation}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog (Slides) */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="glass-card max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Configurar Apresentação: {editingPresentation?.name}</DialogTitle>
              <DialogDescription>
                Adicione páginas de dashboards e configure o tempo de cada uma.
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
              {/* Presentation Info & Add Slide Form */}
              <div className="space-y-6 border-r pr-6">
                <div className="space-y-4 pb-6 border-b">
                  <h3 className="font-semibold text-sm uppercase text-muted-foreground">Configurações Gerais</h3>
                  <div className="space-y-2">
                    <Label>Nome da Apresentação</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={editPresentationName} 
                        onChange={(e) => setEditPresentationName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Ativa</Label>
                    <Switch 
                      checked={editPresentationActive} 
                      onCheckedChange={setEditPresentationActive}
                    />
                  </div>
                  <Button variant="outline" className="w-full text-xs h-8" onClick={handleUpdatePresentationInfo}>
                    Salvar Alterações
                  </Button>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-sm uppercase text-muted-foreground">Adicionar Slide</h3>
                  
                  <div className="space-y-2">
                    <Label>Relatório</Label>
                    <Select value={selectedReportId} onValueChange={handleReportChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um relatório" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableReports.map(r => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Página</Label>
                    <Select 
                      value={selectedPageName} 
                      onValueChange={setSelectedPageName}
                      disabled={!selectedReportId || availablePages.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={availablePages.length === 0 ? "Nenhuma página disponível" : "Selecione a página"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePages.map(p => (
                          <SelectItem key={p.name} value={p.name}>{p.displayName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Duração (segundos)</Label>
                    <Input 
                      type="number" 
                      value={slideDuration} 
                      onChange={(e) => setSlideDuration(parseInt(e.target.value))}
                      min={5}
                    />
                  </div>

                  <Button 
                    className="w-full gap-2" 
                    onClick={handleAddSlide}
                    disabled={!selectedPageName || isAddingSlide}
                  >
                    {isAddingSlide ? "Adicionando..." : <Plus className="w-4 h-4" />}
                    Adicionar Slide
                  </Button>
                </div>
              </div>

              {/* Slides List */}
              <div className="md:col-span-2">
                <h3 className="font-semibold text-sm uppercase text-muted-foreground mb-4">Slides da Apresentação</h3>
                
                <div className="space-y-3">
                  {editingPresentation?.tv_presentation_slides.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border-dashed border-2">
                      Nenhum slide adicionado ainda.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40px]"></TableHead>
                          <TableHead>Relatório / Página</TableHead>
                          <TableHead className="w-[100px]">Tempo</TableHead>
                          <TableHead className="w-[60px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {editingPresentation?.tv_presentation_slides.map((slide, index) => (
                          <TableRow key={slide.id}>
                            <TableCell className="font-medium text-muted-foreground">
                              {index + 1}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{slide.report_name}</div>
                              <div className="text-xs text-muted-foreground">{slide.page_display_name}</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Clock className="w-3 h-3 text-muted-foreground" />
                                {slide.duration}s
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-destructive h-8 w-8"
                                onClick={() => handleDeleteSlide(slide.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setIsEditDialogOpen(false)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="glass-card max-w-sm">
            <DialogHeader>
              <DialogTitle>Excluir Apresentação</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir esta apresentação? Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setPresentationToDelete(null);
                }}
              >
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDeletePresentation}
              >
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageLayout>
  );
}
