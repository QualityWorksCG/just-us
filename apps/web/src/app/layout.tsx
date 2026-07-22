import type { Metadata } from "next";
import { Libre_Franklin, Spline_Sans_Mono } from "next/font/google";

import "../index.css";
import Header from "@/components/header";
import Providers from "@/components/providers";

const libreFranklin = Libre_Franklin({
	variable: "--font-libre-franklin",
	subsets: ["latin"],
	weight: ["400", "500", "600", "700", "800"],
});

const splineSansMono = Spline_Sans_Mono({
	variable: "--font-spline-sans-mono",
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
	title: {
		default: "JustUs — Justice, funded by the many",
		template: "%s · JustUs",
	},
	description:
		"JustUs connects wronged people with attorneys and funds their legal fees through public donations. Money goes directly to the attorney — donations are gifts, not investments.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body
				className={`${libreFranklin.variable} ${splineSansMono.variable} antialiased`}
			>
				<Providers>
					<div className="grid h-svh grid-rows-[auto_1fr]">
						<Header />
						{children}
					</div>
				</Providers>
			</body>
		</html>
	);
}
