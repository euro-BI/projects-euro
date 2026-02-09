import { PageLayout } from "@/components/PageLayout";
import { DataUploadManagement } from "@/components/DataUploadManagement";

export default function BIDashboard() {
  return (
    <PageLayout title="Atualizações BD">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <DataUploadManagement />
      </div>
    </PageLayout>
  );
}