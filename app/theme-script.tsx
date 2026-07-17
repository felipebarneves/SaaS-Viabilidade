// Aplica o tema salvo (localStorage) antes da hidratação para evitar flash de tema errado.
export function ThemeScript() {
  const script = `
    try {
      const salvo = localStorage.getItem("prumo-theme");
      if (salvo === "light" || salvo === "dark") {
        document.documentElement.setAttribute("data-theme", salvo);
      }
    } catch (e) {}
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
