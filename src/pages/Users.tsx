import { useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageLayout } from "@/components/PageLayout";
import { HubAtmosphere } from "@/components/home/HubAtmosphere";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Edit, Plus, Search, Upload, User as UserIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: string | null;
  profile_image_url: string | null;
  is_active: boolean | null;
  codigo: string | null;
}

type StatusFilter = "all" | "active" | "inactive";

const fieldClass =
  "h-11 rounded-2xl border-white/10 bg-white/[0.04] text-[#F4F1E8] placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-euro-gold/40 focus-visible:ring-offset-0";
const dialogClass =
  "gap-5 border-white/10 bg-[#12141A] text-[#F4F1E8] sm:rounded-[28px] p-6 sm:p-8";
const labelClass = "text-[13px] font-medium text-white/50";

const ROLE_OPTIONS = [
  { value: "user", label: "Assessor" },
  { value: "lider", label: "Líder" },
  { value: "consorcio", label: "Consórcio" },
  { value: "marketing", label: "Marketing" },
  { value: "produtos", label: "Produtos" },
  { value: "seguros", label: "Seguros" },
  { value: "admin", label: "Admin" },
  { value: "admin_master", label: "Master" },
] as const;

const emptyForm = {
  firstName: "",
  lastName: "",
  phone: "",
  role: "user",
  profileImageUrl: "",
  is_active: true,
  email: "",
  password: "",
  codigo: "",
};

export default function Users() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    loadUsers();
  }, []);

  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 2) return `(${numbers}`;
    if (numbers.length <= 3) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 3)} ${numbers.slice(3)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 3)} ${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, phone: formatPhoneNumber(e.target.value) });
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedUserId) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione apenas arquivos de imagem");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB");
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${selectedUserId}-${Date.now()}.${fileExt}`;
      const filePath = `fotos/fotos-assessores/normal/${fileName}`;

      const { error: uploadError } = await supabase.storage.from("fotos").upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("fotos").getPublicUrl(filePath);
      setPreviewImage(publicUrl);
      setFormData({ ...formData, profileImageUrl: publicUrl });
      toast.success("Imagem carregada com sucesso");
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Erro ao carregar imagem");
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = () => {
    setPreviewImage(null);
    setFormData({ ...formData, profileImageUrl: "" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const loadUsers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("projects_profiles")
        .select("id, first_name, last_name, phone, profile_image_url, is_active, codigo");
      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from("projects_user_roles")
        .select("user_id, role");
      if (rolesError) throw rolesError;

      const usersWithData: UserProfile[] = ((profiles || []) as any[]).map((profile) => {
        const matchedRole = roles?.find((r) => r.user_id === profile.id);
        return {
          id: profile.id,
          first_name: profile.first_name ?? null,
          last_name: profile.last_name ?? null,
          phone: profile.phone ?? null,
          role: matchedRole?.role ?? null,
          profile_image_url: profile.profile_image_url ?? null,
          is_active: profile.is_active ?? null,
          codigo: profile.codigo ?? null,
        };
      });

      setUsers(
        usersWithData.sort((a, b) =>
          (a.first_name || "").toLowerCase().localeCompare((b.first_name || "").toLowerCase()),
        ),
      );
    } catch (error) {
      console.error("Error loading users:", error);
      toast.error("Erro ao carregar usuários");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUserClick = () => {
    setFormData(emptyForm);
    setPreviewImage(null);
    setIsCreateUserDialogOpen(true);
  };

  const openEdit = (userItem: UserProfile) => {
    setSelectedUserId(userItem.id);
    setFormData({
      firstName: userItem.first_name || "",
      lastName: userItem.last_name || "",
      phone: userItem.phone || "",
      role: userItem.role || "user",
      profileImageUrl: userItem.profile_image_url || "",
      is_active: userItem.is_active ?? true,
      codigo: userItem.codigo || "",
      email: "",
      password: "",
    });
    setPreviewImage(userItem.profile_image_url);
    setOpen(true);
  };

  const handleCreateUser = async () => {
    if (userRole !== "admin_master") {
      toast.error("Apenas administradores mestre podem criar usuários");
      return;
    }

    if (!formData.email || !formData.password || !formData.firstName || !formData.lastName) {
      toast.error("Preencha email, senha, nome e sobrenome.");
      return;
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error("Usuário não retornado após criação.");

      const newUserId = authData.user.id;

      const { error: profileError } = await supabase.from("projects_profiles").insert({
        id: newUserId,
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone: formData.phone,
        profile_image_url: formData.profileImageUrl || null,
        is_active: formData.is_active,
        codigo: formData.codigo || null,
      });
      if (profileError) throw profileError;

      const { error: roleError } = await supabase.from("projects_user_roles" as any).insert({
        user_id: newUserId,
        role: formData.role as any,
      });
      if (roleError) throw roleError;

      toast.success("Usuário criado com sucesso!");
      setIsCreateUserDialogOpen(false);
      loadUsers();
    } catch (error: any) {
      console.error("Erro ao criar usuário:", error);
      toast.error(`Erro ao criar usuário: ${error.message || "Erro desconhecido"}`);
    }
  };

  const handleUpdateProfile = async () => {
    if (userRole !== "admin_master" || !selectedUserId) {
      toast.error("Apenas administradores mestre podem atualizar perfis");
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
          is_active: formData.is_active,
          codigo: formData.codigo || null,
        })
        .eq("id", selectedUserId);
      if (profileError) throw profileError;

      const { data: existingRole } = await supabase
        .from("projects_user_roles")
        .select("id, role")
        .eq("user_id", selectedUserId)
        .maybeSingle();

      let roleError;
      if (existingRole) {
        const { error } = await supabase
          .from("projects_user_roles" as any)
          .update({ role: formData.role as any })
          .eq("user_id", selectedUserId);
        roleError = error;
      } else {
        const { error } = await supabase.from("projects_user_roles" as any).insert({
          user_id: selectedUserId,
          role: formData.role as any,
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

  const userStats = useMemo(() => ({
    total: users.length,
    active: users.filter((userItem) => userItem.is_active !== false).length,
    inactive: users.filter((userItem) => userItem.is_active === false).length,
  }), [users]);

  const filteredUsers = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    return users.filter((u) => {
      if (statusFilter === "active" && u.is_active === false) return false;
      if (statusFilter === "inactive" && u.is_active !== false) return false;
      const fullName = `${u.first_name || ""} ${u.last_name || ""}`.toLowerCase();
      const codigo = (u.codigo || "").toLowerCase();
      const role = roleLabel(u.role).toLowerCase();
      return fullName.includes(searchLower) || codigo.includes(searchLower) || role.includes(searchLower);
    });
  }, [searchTerm, statusFilter, users]);

  return (
    <PageLayout className="relative overflow-hidden bg-transparent font-ui text-[#F4F1E8] selection:bg-euro-gold/30">
      <HubAtmosphere />

      <div className="relative z-10 flex min-h-[calc(100vh-4rem)] w-full flex-col px-5 py-6 sm:px-8 lg:px-10 xl:px-12">
        <header className="mb-6 flex shrink-0 flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="mb-5 inline-flex items-center gap-2 text-sm text-white/45 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Início
            </button>
            <h1 className="text-[2rem] font-semibold tracking-tight text-white sm:text-4xl">Usuários</h1>
            <p className="mt-2 text-sm text-white/45">Acessos, perfis e permissões do Hub.</p>
            {!isLoading && (
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-white/55">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">{userStats.total} pessoas</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {userStats.active} ativos
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/35" />
                  {userStats.inactive} inativos
                </span>
              </div>
            )}
          </div>

          {userRole === "admin_master" && (
            <button
              type="button"
              onClick={handleCreateUserClick}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-euro-gold px-4 text-sm font-semibold text-euro-navy transition-colors hover:bg-euro-gold/90"
            >
              <Plus className="h-4 w-4" />
              Novo usuário
            </button>
          )}
        </header>

        <div className="mb-4 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <Input
              placeholder="Buscar por nome, código ou perfil..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn(fieldClass, "h-12 pl-11")}
            />
          </div>
          <div className="flex rounded-2xl border border-white/10 bg-white/[0.03] p-1">
            {([
              ["all", "Todos"],
              ["active", "Ativos"],
              ["inactive", "Inativos"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={cn(
                  "h-10 rounded-xl px-3.5 text-sm transition-colors",
                  statusFilter === value
                    ? "bg-euro-gold font-semibold text-euro-navy"
                    : "text-white/50 hover:text-white",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <p className="mb-3 shrink-0 text-xs text-white/35">
          {isLoading ? "Carregando..." : `${filteredUsers.length} ${filteredUsers.length === 1 ? "usuário" : "usuários"}`}
        </p>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#12141A] shadow-[0_20px_50px_-28px_rgba(0,0,0,0.85)]">
          <span className="pointer-events-none block h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          <div className="hidden min-h-0 flex-1 overflow-auto md:block">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.025] text-[11px] uppercase tracking-wide text-white/40">
                  <th className="px-5 py-3.5 font-medium">Pessoa</th>
                  <th className="px-4 py-3.5 font-medium">Código</th>
                  <th className="px-4 py-3.5 font-medium">Telefone</th>
                  <th className="px-4 py-3.5 font-medium">Acesso</th>
                  <th className="px-4 py-3.5 font-medium">Status</th>
                  {userRole === "admin_master" && <th className="px-5 py-3.5 text-right font-medium">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center text-white/40">Carregando usuários...</td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center text-white/40">Nenhum usuário encontrado</td>
                  </tr>
                ) : (
                  filteredUsers.map((userItem) => {
                    const inactive = userItem.is_active === false;
                    return (
                      <tr
                        key={userItem.id}
                        className={cn(
                          "border-b border-white/[0.06] transition-colors last:border-0 hover:bg-white/[0.035]",
                          inactive && "opacity-55",
                        )}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar name={userItem.first_name} src={userItem.profile_image_url} />
                            <div>
                              <p className="font-medium text-white">
                                {[userItem.first_name, userItem.last_name].filter(Boolean).join(" ") || "—"}
                              </p>
                              <p className="text-xs text-white/40">{roleLabel(userItem.role)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-data text-sm tabular-nums text-white/75">
                          {userItem.codigo || "—"}
                        </td>
                        <td className="px-4 py-3.5 font-data text-sm text-white/75">{userItem.phone || "—"}</td>
                        <td className="px-4 py-3.5">
                          <RoleChip role={userItem.role} />
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusChip active={!inactive} />
                        </td>
                        {userRole === "admin_master" && (
                          <td className="px-5 py-3.5 text-right">
                            <IconAction label="Editar" onClick={() => openEdit(userItem)}>
                              <Edit className="h-4 w-4" />
                            </IconAction>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-white/[0.06] md:hidden">
            {isLoading ? (
              <p className="px-5 py-16 text-center text-white/40">Carregando usuários...</p>
            ) : filteredUsers.length === 0 ? (
              <p className="px-5 py-16 text-center text-white/40">Nenhum usuário encontrado</p>
            ) : (
              filteredUsers.map((userItem) => {
                const inactive = userItem.is_active === false;
                return (
                  <div key={userItem.id} className={cn("flex items-center gap-3 px-5 py-4", inactive && "opacity-55")}>
                    <Avatar name={userItem.first_name} src={userItem.profile_image_url} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-white">
                        {[userItem.first_name, userItem.last_name].filter(Boolean).join(" ") || "—"}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <RoleChip role={userItem.role} />
                        <StatusChip active={!inactive} />
                      </div>
                    </div>
                    {userRole === "admin_master" && (
                      <IconAction label="Editar" onClick={() => openEdit(userItem)}>
                        <Edit className="h-4 w-4" />
                      </IconAction>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className={cn(dialogClass, "max-w-md")}>
            <DialogHeader>
              <DialogTitle className="text-2xl font-semibold tracking-tight">Editar usuário</DialogTitle>
            </DialogHeader>
            <UserFormFields
              formData={formData}
              setFormData={setFormData}
              previewImage={previewImage}
              onRemoveImage={removeImage}
              onPickImage={() => fileInputRef.current?.click()}
              isUploading={isUploading}
              showPhoto
              userRole={userRole}
              onPhoneChange={handlePhoneChange}
            />
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            <DialogFooter className="gap-2">
              <GhostButton onClick={() => setOpen(false)}>Cancelar</GhostButton>
              <button
                type="button"
                onClick={handleUpdateProfile}
                disabled={isUploading}
                className="inline-flex h-11 items-center rounded-2xl bg-euro-gold px-5 text-sm font-semibold text-euro-navy hover:bg-euro-gold/90 disabled:opacity-50"
              >
                Salvar
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isCreateUserDialogOpen} onOpenChange={setIsCreateUserDialogOpen}>
          <DialogContent className={cn(dialogClass, "max-w-md")}>
            <DialogHeader>
              <DialogTitle className="text-2xl font-semibold tracking-tight">Novo usuário</DialogTitle>
            </DialogHeader>
            <div className="grid max-h-[70vh] gap-4 overflow-y-auto pr-1">
              <Field label="Email">
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={fieldClass}
                />
              </Field>
              <Field label="Senha">
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={fieldClass}
                />
              </Field>
              <UserFormFields
                formData={formData}
                setFormData={setFormData}
                previewImage={previewImage}
                onRemoveImage={removeImage}
                onPickImage={() => fileInputRef.current?.click()}
                isUploading={isUploading}
                showPhoto={false}
                userRole={userRole}
                onPhoneChange={handlePhoneChange}
              />
            </div>
            <DialogFooter className="gap-2">
              <GhostButton onClick={() => setIsCreateUserDialogOpen(false)}>Cancelar</GhostButton>
              <button
                type="button"
                onClick={handleCreateUser}
                className="inline-flex h-11 items-center rounded-2xl bg-euro-gold px-5 text-sm font-semibold text-euro-navy hover:bg-euro-gold/90"
              >
                Criar usuário
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageLayout>
  );
}

function UserFormFields({
  formData,
  setFormData,
  previewImage,
  onRemoveImage,
  onPickImage,
  isUploading,
  showPhoto,
  userRole,
  onPhoneChange,
}: {
  formData: typeof emptyForm;
  setFormData: (next: typeof emptyForm) => void;
  previewImage: string | null;
  onRemoveImage: () => void;
  onPickImage: () => void;
  isUploading: boolean;
  showPhoto: boolean;
  userRole: string | null;
  onPhoneChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="grid gap-4">
      {showPhoto && (
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
              {previewImage ? (
                <img src={previewImage} alt="" className="h-full w-full object-cover object-top" />
              ) : (
                <UserIcon className="h-8 w-8 text-white/30" />
              )}
            </div>
            {previewImage && (
              <button
                type="button"
                onClick={onRemoveImage}
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <GhostButton onClick={onPickImage} disabled={isUploading} className="h-10">
            <Upload className="h-4 w-4" />
            {isUploading ? "Carregando..." : "Escolher foto"}
          </GhostButton>
        </div>
      )}

      <Field label="Nome">
        <Input value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} className={fieldClass} />
      </Field>
      <Field label="Sobrenome">
        <Input value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} className={fieldClass} />
      </Field>
      <Field label="Código">
        <Input value={formData.codigo} onChange={(e) => setFormData({ ...formData, codigo: e.target.value })} className={fieldClass} />
      </Field>
      <Field label="Telefone">
        <Input placeholder="(XX) X XXXX-XXXX" value={formData.phone} onChange={onPhoneChange} maxLength={16} className={fieldClass} />
      </Field>
      <Field label="Tipo de acesso">
        <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
          <SelectTrigger className={fieldClass}><SelectValue /></SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.filter((option) => option.value !== "admin_master" || userRole === "admin_master").map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {userRole === "admin_master" && (
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <Label className={labelClass}>Usuário ativo</Label>
          <Switch
            checked={formData.is_active ?? true}
            onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            className="data-[state=checked]:bg-euro-gold"
          />
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className={labelClass}>{label}</Label>
      {children}
    </div>
  );
}

function GhostButton({ children, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white/75 transition-colors hover:bg-white/[0.08] hover:text-white disabled:pointer-events-none disabled:opacity-35",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function Avatar({ name, src }: { name: string | null; src: string | null }) {
  if (src) {
    return <img src={src} alt="" className="h-10 w-10 rounded-xl object-cover object-top ring-1 ring-white/10" />;
  }
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-euro-gold/15 text-sm font-semibold text-euro-gold ring-1 ring-euro-gold/20">
      {(name || "U").slice(0, 1).toUpperCase()}
    </div>
  );
}

function roleLabel(role: string | null) {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label || "Usuário";
}

function RoleChip({ role }: { role: string | null }) {
  const dot =
    role === "admin_master" ? "bg-violet-400" :
    role === "admin" ? "bg-euro-gold" :
    role === "lider" ? "bg-orange-400" :
    role === "consorcio" ? "bg-sky-400" :
    role === "seguros" ? "bg-blue-400" :
    role === "produtos" ? "bg-emerald-400" :
    role === "marketing" ? "bg-pink-400" :
    "bg-white/40";

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs text-white">
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      {roleLabel(role)}
    </span>
  );
}

function StatusChip({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium",
        active
          ? "border-emerald-400/25 bg-emerald-400/15 text-emerald-300"
          : "border-white/10 bg-white/[0.04] text-white/45",
      )}
    >
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

function IconAction({ children, onClick, label }: { children: ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/55 transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
    >
      {children}
    </button>
  );
}
