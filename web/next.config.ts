import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite probar el dev server desde el teléfono vía IP local (solo aplica en dev).
  allowedDevOrigins: ['192.168.1.*'],
};

export default nextConfig;
