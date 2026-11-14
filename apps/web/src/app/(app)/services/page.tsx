import { Suspense } from "react";
import { DiensteView } from "@/components/shell/DiensteView";

export const metadata = { title: "Dienste · Mesh" };

export default function DienstePage() {
  return (
    <Suspense fallback={null}>
      <DiensteView />
    </Suspense>
  );
}
