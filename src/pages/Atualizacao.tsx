import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/PageLayout";
import { HubAtmosphere } from "@/components/home/HubAtmosphere";
import { DataUploadManagement } from "@/components/DataUploadManagement";
import { ArrowLeft } from "lucide-react";

export default function Atualizacao() {
  const navigate = useNavigate();

  return (
    <PageLayout className="relative overflow-hidden bg-transparent font-ui text-[#F4F1E8] selection:bg-euro-gold/30">
      <HubAtmosphere />
      <div className="relative z-10 flex min-h-[calc(100vh-4rem)] w-full flex-col px-5 py-6 sm:px-8 lg:px-10 xl:px-12">
        <header className="mb-6 shrink-0">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mb-5 inline-flex items-center gap-2 text-sm text-white/45 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Início
          </button>
          <h1 className="text-[2rem] font-semibold tracking-tight text-white sm:text-4xl">Atualizações</h1>
          <p className="mt-2 text-sm text-white/45">Cargas das bases e freshness do BI.</p>
        </header>
        <DataUploadManagement />
      </div>
    </PageLayout>
  );
}
