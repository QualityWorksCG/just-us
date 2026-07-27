import "@just-us/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
  // Prisma v7's rust-free client is generated into the source tree and is meant
  // to be bundled. Next ships "@prisma/client" in its default serverExternalPackages
  // list, so Turbopack externalizes it — which, in this Bun monorepo, produces a
  // hashed specifier (@prisma/client-<hash>/runtime/client) that fails to resolve at
  // runtime. Listing it here forces Turbopack to bundle it instead.
  transpilePackages: ["@prisma/client"],
};

export default nextConfig;
