import "@just-us/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	typedRoutes: true,
	reactCompiler: true,
	// Avatar files are normalized server-side before they reach private storage.
	// The product limit is 2 MB; leave a small margin for multipart form data.
	experimental: {
		serverActions: {
			bodySizeLimit: "3mb",
		},
	},
	// The app's screens used to sit under /dashboard and now live at the top level.
	// Anything already pointing at the old URLs — a bookmark, a link in a sent
	// email, an open tab — is forwarded rather than 404'd. Permanent, because the
	// move is not going to be reversed.
	async redirects() {
		return [
			{ source: "/dashboard", destination: "/home", permanent: true },
			{ source: "/dashboard/cases", destination: "/my-cases", permanent: true },
			{
				source: "/dashboard/cases/:path*",
				destination: "/my-cases/:path*",
				permanent: true,
			},
			{
				source: "/dashboard/attorneys",
				destination: "/find-attorney",
				permanent: true,
			},
			// Everything else kept its name and only lost the prefix.
			{ source: "/dashboard/:path*", destination: "/:path*", permanent: true },
		];
	},
	// Prisma v7's rust-free client is generated into the source tree and is meant
	// to be bundled. Next ships "@prisma/client" in its default serverExternalPackages
	// list, so Turbopack externalizes it — which, in this Bun monorepo, produces a
	// hashed specifier (@prisma/client-<hash>/runtime/client) that fails to resolve at
	// runtime. Listing it here forces Turbopack to bundle it instead.
	transpilePackages: ["@prisma/client"],
};

export default nextConfig;
