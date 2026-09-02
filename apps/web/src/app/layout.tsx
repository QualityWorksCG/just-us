import { env as webEnv } from "@just-us/env/web";
import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";

import "../index.css";
import Header from "@/components/header";
import Providers from "@/components/providers";
import { UserbackWidget } from "@/components/userback";

const figtree = Figtree({
	variable: "--font-figtree",
	subsets: ["latin"],
	weight: ["400", "500", "600", "700", "800"],
});

const bricolage = Bricolage_Grotesque({
	variable: "--font-bricolage",
	subsets: ["latin"],
	weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
	title: {
		default: "JustUs: Justice, funded by the many",
		template: "%s · JustUs",
	},
	description:
		"JustUs connects wronged people with attorneys and funds their legal fees through public donations. Money goes directly to the attorney. Donations are gifts, not investments.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			{/* suppressHydrationWarning here too: browser extensions (ColorZilla's
			    `cz-shortcut-listen`, Grammarly, etc.) inject attributes onto <body>
			    before React hydrates, and the flag only applies to the element it's
			    on — the one on <html> doesn't cover <body>. */}
			<body
				suppressHydrationWarning
				className={`${figtree.variable} ${bricolage.variable} antialiased`}
			>
				<Providers>
					<div className="grid h-svh grid-rows-[auto_1fr]">
						<Header />
						{children}
					</div>
					{/* Feedback widget. Absent unless the environment sets a token, which
					    is how it stays on in demo/QA and off in production. */}
					{webEnv.NEXT_PUBLIC_USERBACK_TOKEN && (
						<UserbackWidget token={webEnv.NEXT_PUBLIC_USERBACK_TOKEN} />
					)}
				</Providers>
			</body>
		</html>
	);
}
