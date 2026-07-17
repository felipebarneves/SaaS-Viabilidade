"use client";

import { useActionState } from "react";
import { enviarMagicLink } from "@/app/actions/auth";

export default function LoginPage() {
  const [estado, formAction, pendente] = useActionState(enviarMagicLink, {});

  return (
    <div className="card" style={{ maxWidth: 380, margin: "4rem auto" }}>
      <h1 style={{ fontSize: 18, marginTop: 0 }}>Entrar</h1>
      {estado.enviado ? (
        <p>Link de acesso enviado — confira seu e-mail.</p>
      ) : (
        <form action={formAction}>
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" required style={{ width: "100%" }} />
          </div>
          {estado.erro && <p className="negative">{estado.erro}</p>}
          <button className="btn" type="submit" disabled={pendente}>
            {pendente ? "Enviando…" : "Enviar link de acesso"}
          </button>
        </form>
      )}
    </div>
  );
}
