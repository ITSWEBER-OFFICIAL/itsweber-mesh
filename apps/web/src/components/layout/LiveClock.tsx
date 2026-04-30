"use client";

import { useEffect, useState } from "react";

const DE_DAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const DE_MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

function format(n: Date) {
  const p = (v: number) => String(v).padStart(2, "0");
  const time = `${p(n.getHours())}:${p(n.getMinutes())}`;
  const date = `${DE_DAYS[n.getDay()]} · ${n.getDate()}. ${DE_MONTHS[n.getMonth()]}`;
  return { time, date };
}

export function LiveClock() {
  const [tick, setTick] = useState<{ time: string; date: string } | null>(null);

  useEffect(() => {
    setTick(format(new Date()));
    const id = setInterval(() => setTick(format(new Date())), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="live-clock" aria-label="Aktuelle Zeit">
      <div className="live-clock-time">
        {tick?.time ?? "--:--"}
      </div>
      <div className="live-clock-date">
        {tick?.date ?? "…"}
      </div>
    </div>
  );
}
