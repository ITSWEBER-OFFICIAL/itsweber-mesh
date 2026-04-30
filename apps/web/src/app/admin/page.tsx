"use client";

import { trpc } from "@/lib/trpc-client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

const MetaSchema = z.object({
  name: z.string().min(1),
  locale: z.enum(["de", "en"]),
  subtitle: z.string().optional(),
});

type MetaForm = z.infer<typeof MetaSchema>;

export default function AdminSettingsPage() {
  const { data: settings } = trpc.settings.get.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();
  const updateMeta = trpc.settings.updateMeta.useMutation({
    onSuccess: () => { utils.settings.get.invalidate(); toast.success("Einstellungen gespeichert"); },
    onError: (e) => toast.error("Speichern fehlgeschlagen", e.message),
  });

  const { register, handleSubmit, formState: { errors } } = useForm<MetaForm>({
    resolver: zodResolver(MetaSchema),
    ...(settings?.meta ? { values: settings.meta } : {}),
  });

  return (
    <div className="admin-card" style={{ maxWidth: 560 }}>
      <div className="admin-card-title">Einstellungen</div>
      <div className="admin-card-sub">Allgemeine Dashboard-Konfiguration</div>

      <form onSubmit={handleSubmit((data) => updateMeta.mutate(data))} className="flex flex-col gap-[20px]">
        <AdminField label="Dashboard-Name" error={errors.name?.message}>
          <input
            {...register("name")}
            className="admin-input"
            placeholder="ITSWEBER Mesh"
          />
        </AdminField>

        <AdminField label="Untertitel (Logo)" error={errors.subtitle?.message}>
          <input
            {...register("subtitle")}
            className="admin-input"
            placeholder="Home Infrastructure"
          />
        </AdminField>

        <AdminField label="Sprache" error={errors.locale?.message}>
          <select {...register("locale")} className="admin-input">
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </select>
        </AdminField>

        <div className="admin-divider" />

        <div>
          <button type="submit" disabled={updateMeta.isPending} className="btn-primary">
            <Save size={14} />
            {updateMeta.isPending ? "Speichern…" : "Speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}

function AdminField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="admin-field">
      <label className="admin-label">{label}</label>
      {children}
      {error && <span className="text-[11px] text-[var(--status-error)]">{error}</span>}
    </div>
  );
}
