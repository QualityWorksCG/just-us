import "@just-us/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	typedRoutes: true,
	reactCompiler: true,
	// Ship libvips with the route that uses `sharp`.
	//
	// Tracing follows `require()`, and that is enough to find `sharp` itself and
	// its platform binary — but the binary reaches libvips through `dlopen`, which
	// no static trace can see. So `@img/sharp-linux-x64/sharp.node` lands in the
	// bundle and the `libvips-cpp.so` it links against does not, and the route
	// fails at runtime with ERR_DLOPEN_FAILED the first time it touches an image.
	// The failure only appears once deployed: locally the file is simply there.
	//
	// Three things about this glob are load-bearing:
	//
	//   - It points into Bun's store rather than at `node_modules/@img`, whose
	//     entries are symlinks, because the *real* files have to be copied.
	//   - It stops at `lib/`. Matching a package root would include the symlinked
	//     directory itself, and Vercel rejects the deployment outright for that
	//     ("invalid deployment package… files in symlinked directories").
	//   - It names `sharp-libvips-*` specifically. The sibling `sharp-<platform>`
	//     packages are already traced through `require()`; libvips is the only gap.
	//
	// Paths are relative to this app, not to the tracing root Next infers for the
	// workspace. Platform packages absent from the build machine match nothing, so
	// this is correct on Linux CI and on a developer's Mac alike.
	outputFileTracingIncludes: {
		"/settings": [
			"../../node_modules/.bun/@img+sharp-libvips-*/node_modules/@img/*/lib/**/*",
		],
	},
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
