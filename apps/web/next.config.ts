import "@just-us/env/web";
import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	typedRoutes: true,
	reactCompiler: true,
	// Trace from the workspace root, not apps/web. Bun installs into a single
	// store at the repo root (`node_modules/.bun/...`) and links packages from
	// there, so a tracing root inside the app cannot see the files it needs.
	outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
	// Ship libvips with the routes that use `sharp`.
	//
	// Tracing follows `require()`, and that is enough to find `sharp` itself and
	// its platform binary — but the binary reaches libvips through `dlopen`, which
	// no static trace can see. So `@img/sharp-linux-x64/sharp.node` lands in the
	// bundle and the `libvips-cpp.so` it links against does not, and the route
	// fails at runtime with ERR_DLOPEN_FAILED the first time it touches an image.
	// The failure only appears once deployed: locally the file is simply there.
	//
	// The glob points into Bun's store rather than at `node_modules/@img`, because
	// the latter is a directory of symlinks and it is the real files that have to
	// be copied. Platform packages that do not exist on the build machine match
	// nothing, so this stays correct on Linux CI and on a developer's Mac alike.
	//
	// Relative to *this app*, not to `outputFileTracingRoot` above — hence the
	// `../..`. The two are independent: the root decides where traced paths are
	// anchored, these globs are resolved from the project directory.
	outputFileTracingIncludes: {
		"/settings": ["../../node_modules/.bun/@img+*/node_modules/@img/**/*"],
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
