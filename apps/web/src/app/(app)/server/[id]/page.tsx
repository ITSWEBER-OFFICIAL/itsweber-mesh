import { ServerDetailView } from "@/components/shell/ServerDetail";

export const metadata = { title: "Server · Mesh" };

export default async function ServerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ServerDetailView nodeId={id} />;
}
