import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Etapa 15: el logo se sube por server action (máximo 512 KB, validado en cliente y
  // servidor); el margen evita la pantalla de error genérica si alguien elige un archivo grande.
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  // El tablero «dinero en riesgo» de la v1 ahora es el Tablero de gestión.
  async redirects() {
    return [{ source: "/riesgo/:indicador", destination: "/gestion/:indicador", permanent: true }];
  },
};

export default nextConfig;
