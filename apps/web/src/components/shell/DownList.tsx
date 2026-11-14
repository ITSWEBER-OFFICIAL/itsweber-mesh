"use client";

import { trpc } from "@/lib/trpc-client";
import { useToast } from "@/components/ui/Toast";
import { CATEGORY_LABEL } from "@/lib/service-view";
import type { Service } from "@/server/config/schema";
import { Dot } from "./AppShell";

type Ping = { status: string; statusCode?: number; error?: string } | undefined;

export function downReason(ping: Ping): string {
  if (ping?.statusCode) return `Status ${ping.statusCode}`;
  return "keine Antwort";
}

/** Störungen als Meldungen, jede mit der Aktion „Prüfen“ (neuer Ping). */
export function DownList({
  services,
  pings,
  limit,
}: {
  services: Service[];
  pings: Record<string, Ping>;
  limit?: number;
}) {
  const utils = trpc.useUtils();
  const toast = useToast();
  const ping = trpc.status.ping.useMutation({
    onSuccess: (res, vars) => {
      utils.status.all.invalidate();
      const name = services.find((s) => s.id === vars.id)?.name ?? "Dienst";
      if (res.status === "online") toast.success(`${name} läuft wieder`);
      else toast.error(`${name} antwortet weiter nicht`, downReason(res));
    },
    onError: (e) => toast.error("Prüfung fehlgeschlagen", e.message),
  });

  const list = limit ? services.slice(0, limit) : services;
  return (
    <>
      {list.map((s) => (
        <div className="m-msg" key={s.id}>
          <Dot state="bad" />
          <div>
            <b>{s.name} antwortet nicht</b>
            <small>
              {CATEGORY_LABEL[s.category]} · {downReason(pings[s.id])}
            </small>
          </div>
          <button
            type="button"
            className="m-btn"
            disabled={ping.isPending && ping.variables?.id === s.id}
            onClick={() => ping.mutate({ id: s.id })}
          >
            {ping.isPending && ping.variables?.id === s.id ? "Prüft" : "Prüfen"}
          </button>
        </div>
      ))}
    </>
  );
}
