import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, User as UserIcon, ArrowLeft, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { PageLayout } from "@/components/PageLayout";

interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: string | null;
  profile_image_url: string | null;
}

export default function Users() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    role: "user",
    profileImageUrl: "",
  });

  useEffect(() => {
    checkAdminStatus();
    loadUsers();
  }, []);

  const checkAdminStatus = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("projects_user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    setIsAdmin(!!data);
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
    setFormData({ ...formData, phone: formatted });
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedUserId) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione apenas arquivos de imagem');
      return;
    }

    // Validar tamanho (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    setIsUploading(true);

    try {
      // Criar nome único para o arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedUserId}-${Date.now()}.${fileExt}`;
      const filePath = `fotos-assessores/normal/${fileName}`;

      // Upload para o bucket fotos
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('fotos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('fotos')
        .getPublicUrl(filePath);

      // Atualizar preview
      setPreviewImage(publicUrl);
      setFormData({ ...formData, profileImageUrl: publicUrl });

      toast.success('Imagem carregada com sucesso');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Erro ao carregar imagem');
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = () => {
    setPreviewImage(null);
    setFormData({ ...formData, profileImageUrl: "" });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const loadUsers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("projects_profiles")
        .select("id, first_name, last_name, phone, profile_image_url");

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
      .from("projects_user_roles")
      .select("user_id, role");

      if (rolesError) throw rolesError;

      const usersWithData: UserProfile[] = (profiles ?? []).map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.id);
        return {
          id: profile.id,
          first_name: profile.first_name ?? null,
          last_name: profile.last_name ?? null,
          phone: profile.phone ?? null,
          role: userRole?.role ?? null,
          profile_image_url: profile.profile_image_url ?? null,
        };
      });

      setUsers(usersWithData);
    } catch (error) {
      console.error("Error loading users:", error);
      toast.error("Erro ao carregar usuários");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!isAdmin || !selectedUserId) {
      toast.error("Apenas administradores podem atualizar perfis");
      return;
    }

    try {
      const { error: profileError } = await supabase
        .from("projects_profiles")
        .update({
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone: formData.phone,
          profile_image_url: formData.profileImageUrl || null,
        })
        .eq("id", selectedUserId);

      if (profileError) throw profileError;

      // Primeiro, verificar se já existe um role para este usuário
      const { data: existingRole } = await supabase
        .from("projects_user_roles")
        .select("id, role")
        .eq("user_id", selectedUserId)
        .maybeSingle();

      let roleError;
      
      if (existingRole) {
        // Se já existe um role, atualizar
        const { error } = await supabase
          .from("projects_user_roles")
          .update({ role: formData.role as "admin" | "user" })
          .eq("user_id", selectedUserId);
        roleError = error;
      } else {
        // Se não existe, inserir novo
        const { error } = await supabase
          .from("projects_user_roles")
          .insert({
            user_id: selectedUserId,
            role: formData.role as "admin" | "user",
          });
        roleError = error;
      }

      if (roleError) throw roleError;

      toast.success("Perfil atualizado com sucesso");
      setOpen(false);
      setSelectedUserId(null);
      setPreviewImage(null);
      loadUsers();
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Erro ao atualizar perfil");
    }
  };

  const getRoleBadge = (role: string | null) => {
    if (role === "admin") {
      return (
        <Badge className="bg-primary/20 text-primary border-primary/30">
          <Shield className="w-3 h-3 mr-1" />
          Admin
        </Badge>
      );
    }
    return (
      <Badge variant="outline">
        <UserIcon className="w-3 h-3 mr-1" />
        Usuário
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-8 animate-fade-in">
          <div>
            <Button
              variant="outline"
              onClick={() => navigate(-1)}
              className="mb-4 flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>
            <h1 className="text-4xl font-bold mb-2 text-gradient-cyan">
              Gerenciamento de Usuários
            </h1>
            <p className="text-muted-foreground">
              Visualize e gerencie os usuários do sistema
            </p>
          </div>
        </div>

        <Card className="glass-card p-6 animate-slide-up">
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>UUID</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Sobrenome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Tipo de Acesso</TableHead>
                  {isAdmin && <TableHead>Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((userItem) => (
                  <TableRow key={userItem.id}>
                    <TableCell className="font-mono text-xs">
                      {userItem.id.substring(0, 8)}...
                    </TableCell>
                    <TableCell>{userItem.first_name || "-"}</TableCell>
                    <TableCell>{userItem.last_name || "-"}</TableCell>
                    <TableCell>{userItem.phone || "-"}</TableCell>
                    <TableCell>{getRoleBadge(userItem.role)}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUserId(userItem.id);
                            setFormData({
                              firstName: userItem.first_name || "",
                              lastName: userItem.last_name || "",
                              phone: userItem.phone || "",
                              role: userItem.role || "user",
                              profileImageUrl: userItem.profile_image_url || "",
                            });
                            setPreviewImage(userItem.profile_image_url);
                            setOpen(true);
                          }}
                        >
                          Editar
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile list */}
          <div className="md:hidden grid gap-3">
            {users.map((userItem) => (
              <div key={userItem.id} className="glass-card rounded-lg p-4 flex items-start justify-between">
                <div className="space-y-1">
                  <div className="text-xs font-mono text-muted-foreground">
                    UUID: {userItem.id.substring(0, 8)}...
                  </div>
                  <div className="text-sm font-medium">
                    {([userItem.first_name, userItem.last_name].filter(Boolean).join(" ") || "-")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {userItem.phone || "-"}
                  </div>
                  <div>
                    {getRoleBadge(userItem.role)}
                  </div>
                </div>
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedUserId(userItem.id);
                      setFormData({
                        firstName: userItem.first_name || "",
                        lastName: userItem.last_name || "",
                        phone: userItem.phone || "",
                        role: userItem.role || "user",
                        profileImageUrl: userItem.profile_image_url || "",
                      });
                      setPreviewImage(userItem.profile_image_url);
                      setOpen(true);
                    }}
                  >
                    Editar
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="glass-card max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Usuário</DialogTitle>
              <DialogDescription>
                Atualize as informações do usuário
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Foto de Perfil */}
              <div className="grid gap-2">
                <Label>Foto de Perfil</Label>
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-muted flex items-center justify-center">
                      {previewImage ? (
                        <img
                          src={previewImage}
                          alt="Preview"
                          className="w-full h-full object-cover object-top"
                        />
                      ) : (
                        <UserIcon className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                    {previewImage && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full p-0"
                        onClick={removeImage}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      {isUploading ? "Carregando..." : "Escolher Foto"}
                    </Button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="firstName">Nome</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">Sobrenome</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  placeholder="(XX) X XXXX-XXXX"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  maxLength={16}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">Tipo de Acesso</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) =>
                    setFormData({ ...formData, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleUpdateProfile}
                className="bg-primary hover:bg-primary/90"
                disabled={isUploading}
              >
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageLayout>
  );
}
