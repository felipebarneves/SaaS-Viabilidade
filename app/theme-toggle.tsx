"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [tema, setTema] = useState<"light" | "dark">("light");

  useEffect(() => {
    const atual = document.documentElement.getAttribute("data-theme");
    if (atual === "dark") setTema("dark");
  }, []);

  function alternar() {
    const novo = tema === "light" ? "dark" : "light";
    setTema(novo);
    document.documentElement.setAttribute("data-theme", novo);
    localStorage.setItem("prumo-theme", novo);
  }

  return (
    <button className="btn-secondary btn" onClick={alternar} type="button">
      {tema === "light" ? "Modo escuro" : "Modo claro"}
    </button>
  );
}
