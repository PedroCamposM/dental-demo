import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El tablero «dinero en riesgo» de la v1 ahora es el Tablero de gestión.
  async redirects() {
    return [{ source: "/riesgo/:indicador", destination: "/gestion/:indicador", permanent: true }];
  },
};

export default nextConfig;
