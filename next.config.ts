import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Compatibilidad del logo de Pizza Hut.
   *
   * El archivo era un AVIF con extensión `.jpg`; se renombró a `.avif`, pero las
   * filas de `restaurants.logo` en producción todavía guardan la ruta antigua.
   * Esta redirección conserva esas imágenes sin tocar datos de producción.
   */
  async redirects() {
    return [
      {
        source: "/brands/pizza-hut.jpg",
        destination: "/brands/pizza-hut.avif",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
