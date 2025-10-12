import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Edit, Trash2, Upload, X, User, Phone } from "lucide-react";
import { toast } from "sonner";

interface Assessor {
  id: string;
  nome_completo: string;
  nome_exibicao: string;
  telefone: string;
  foto_url?: string;
  created_at?: string;
}

export function AssessorsManagement() {
  const [assessors, setAssessors] = useState<Assessor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAssessor, setEditingAssessor] = useState<Assessor | null>(null);
  const [formData, setFormData] = useState({
    nome_completo: "",
    nome_exibicao: "",
    telefone: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAssessors();
  }, []);

  const loadAssessors = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("dados_assessores")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAssessors(data || []);
    } catch (error) {
      console.error("Erro ao carregar assessores:", error);
      toast.error("Erro ao carregar assessores");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Arquivo muito grande. Máximo 5MB.");
        return;
      }

      if (!file.type.startsWith("image/")) {
        toast.error("Apenas arquivos de imagem são permitidos.");
        return;
      }

      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const uploadPhoto = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `fotos/fotos-assessores/edit/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('fotos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('fotos')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Erro ao fazer upload da foto:', error);
      toast.error('Erro ao fazer upload da foto');
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome_completo || !formData.nome_exibicao || !formData.telefone) {
      toast.error("Todos os campos são obrigatórios");
      return;
    }

    try {
      setIsSubmitting(true);
      
      let fotoUrl = editingAssessor?.foto_url || null;
      if (selectedFile) {
        fotoUrl = await uploadPhoto(selectedFile);
        if (!fotoUrl) return;
      }

      const assessorData = {
        nome_completo: formData.nome_completo,
        nome_exibicao: formData.nome_exibicao,
        telefone: formData.telefone,
        foto_url: fotoUrl,
      };

      if (editingAssessor) {
        const { error } = await supabase
          .from('dados_assessores')
          .update(assessorData)
          .eq('id', editingAssessor.id);

        if (error) throw error;
        toast.success('Assessor atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('dados_assessores')
          .insert([assessorData]);

        if (error) throw error;
        toast.success('Assessor criado com sucesso!');
      }

      resetForm();
      setIsDialogOpen(false);
      loadAssessors();
    } catch (error) {
      console.error('Erro ao salvar assessor:', error);
      toast.error('Erro ao salvar assessor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nome_completo: "",
      nome_exibicao: "",
      telefone: "",
    });
    setSelectedFile(null);
    setPreviewUrl(null);
    setEditingAssessor(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatPhoneNumber = (value: string) => {
    // Remove todos os caracteres não numéricos
    const numbers = value.replace(/\D/g, '');
    
    // Aplica a máscara (XX) X XXXX-XXXX
    if (numbers.length <= 2) {
      return `(${numbers}`;
    } else if (numbers.length <= 3) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    } else if (numbers.length <= 7) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 3)} ${numbers.slice(3)}`;
    } else {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 3)} ${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormData({ ...formData, telefone: formatted });
  };

  const handleEdit = (assessor: Assessor) => {
    setEditingAssessor(assessor);
    setFormData({
      nome_completo: assessor.nome_completo,
      nome_exibicao: assessor.nome_exibicao,
      telefone: assessor.telefone,
    });
    setPreviewUrl(assessor.foto_url || null);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este assessor?')) return;

    try {
      const { error } = await supabase
        .from('dados_assessores')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Assessor excluído com sucesso!');
      loadAssessors();
    } catch (error) {
      console.error('Erro ao excluir assessor:', error);
      toast.error('Erro ao excluir assessor');
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gerenciar Assessores</h2>
          <p className="text-muted-foreground">
            Cadastre e gerencie os assessores do sistema BI
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <PlusCircle className="w-4 h-4 mr-2" />
          Novo Assessor
        </Button>
      </div>

      <Card className="p-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Foto</TableHead>
              <TableHead>Nome Completo</TableHead>
              <TableHead>Nome de Exibição</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Data de Cadastro</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Carregando assessores...
                </TableCell>
              </TableRow>
            ) : assessors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <User className="w-8 h-8 text-muted-foreground" />
                    <p className="text-muted-foreground">Nenhum assessor cadastrado</p>
                    <Button
                      variant="outline"
                      onClick={() => setIsDialogOpen(true)}
                      className="mt-2"
                    >
                      <PlusCircle className="w-4 h-4 mr-2" />
                      Cadastrar Primeiro Assessor
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              assessors.map((assessor) => (
                <TableRow key={assessor.id}>
                  <TableCell>
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={assessor.foto_url} alt={assessor.nome_exibicao} />
                      <AvatarFallback>
                        {assessor.nome_exibicao.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{assessor.nome_completo}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{assessor.nome_exibicao}</Badge>
                  </TableCell>
                  <TableCell>
                    {assessor.telefone ? (
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {assessor.telefone}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {assessor.created_at ? new Date(assessor.created_at).toLocaleDateString('pt-BR') : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(assessor)}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(assessor.id)}
                        className="text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (!open) resetForm();
        setIsDialogOpen(open);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingAssessor ? "Editar Assessor" : "Novo Assessor"}
            </DialogTitle>
            <DialogDescription>
              Preencha as informações do assessor abaixo.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            {/* Upload de Foto */}
            <div className="space-y-2">
              <Label>Foto do Assessor</Label>
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  <Avatar className="w-16 h-16">
                    <AvatarImage 
                      src={previewUrl || editingAssessor?.foto_url} 
                      alt="Preview" 
                    />
                    <AvatarFallback>
                      <User className="w-8 h-8" />
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-3 h-3 mr-1" />
                      Selecionar
                    </Button>
                    {(selectedFile || previewUrl) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={removeSelectedFile}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Máximo 5MB. Formatos: JPG, PNG, GIF
                  </p>
                </div>
              </div>
            </div>

            {/* Nome Completo */}
            <div className="space-y-2">
              <Label htmlFor="nome_completo">Nome Completo *</Label>
              <Input
                id="nome_completo"
                placeholder="Ex: João Silva Santos"
                value={formData.nome_completo}
                onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
                required
              />
            </div>

            {/* Nome de Exibição */}
            <div className="space-y-2">
              <Label htmlFor="nome_exibicao">Nome de Exibição *</Label>
              <Input
                id="nome_exibicao"
                placeholder="Ex: João Silva"
                value={formData.nome_exibicao}
                onChange={(e) => setFormData({ ...formData, nome_exibicao: e.target.value })}
                required
              />
            </div>

            {/* Telefone */}
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone *</Label>
              <Input
                id="telefone"
                placeholder="Ex: (11) 9 9999-9999"
                value={formData.telefone}
                onChange={handlePhoneChange}
                maxLength={16}
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !formData.nome_completo.trim() || !formData.nome_exibicao.trim() || !formData.telefone.trim()}
              >
                {isSubmitting ? "Salvando..." : editingAssessor ? "Atualizar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}