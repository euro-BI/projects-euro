import { PageLayout } from "@/components/PageLayout";
import { SmartChat } from "@/components/SmartChat";

const Chat = () => {
  return (
    <PageLayout className="p-4 md:p-8 flex flex-col">
      <div className="flex flex-col gap-4 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gradient-cyan">
          Converse com seus Dados
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Use a inteligência artificial para consultar informações sobre seus projetos, 
          atividades e dados financeiros de forma rápida e intuitiva.
        </p>
      </div>
      
      <div className="flex-1 min-h-0">
        <SmartChat />
      </div>
    </PageLayout>
  );
};

export default Chat;
