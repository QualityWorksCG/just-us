import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import type { ReactNode } from "react";

/*
 * JustUs email theme. Email clients don't support CSS variables or oklch(), so
 * the "civic gravitas" palette is expressed here as hex approximations of the
 * app tokens (brass accent, warm paper, ink text).
 */
const COLORS = {
	paper: "#F4F0E7", // page background — warm off-white
	card: "#FFFDF9", // card surface
	ink: "#2A251F", // primary text
	inkSoft: "#4C453B", // secondary text
	muted: "#8A8172", // captions / footer
	line: "#E7E1D5", // borders / dividers
	brass: "#A87D2E", // primary action / accent
	brassDeep: "#6E5423", // links / eyebrow on light
	brassInk: "#2A251F", // text on brass
	brassWash: "#F3EAD6", // accent tint
};

export const body: React.CSSProperties = {
	backgroundColor: COLORS.paper,
	fontFamily:
		'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
	margin: 0,
	padding: 0,
};

export const container: React.CSSProperties = {
	backgroundColor: COLORS.card,
	border: `1px solid ${COLORS.line}`,
	borderRadius: 16,
	margin: "40px auto",
	padding: "40px 36px",
	maxWidth: 460,
};

export const brandRow: React.CSSProperties = {
	textAlign: "center",
	margin: "0 0 28px",
};

export const brand: React.CSSProperties = {
	color: COLORS.ink,
	fontSize: 17,
	fontWeight: 800,
	letterSpacing: -0.3,
	margin: 0,
};

export const eyebrow: React.CSSProperties = {
	color: COLORS.muted,
	fontSize: 10,
	fontWeight: 700,
	letterSpacing: 2.4,
	textTransform: "uppercase",
	margin: "4px 0 0",
};

export const heading: React.CSSProperties = {
	color: COLORS.ink,
	fontSize: 26,
	fontWeight: 800,
	lineHeight: "1.2",
	letterSpacing: -0.5,
	textAlign: "center",
	margin: "0 0 16px",
};

export const paragraph: React.CSSProperties = {
	color: COLORS.inkSoft,
	fontSize: 15,
	lineHeight: "24px",
	textAlign: "center",
	margin: "0 0 24px",
};

export const buttonStyle: React.CSSProperties = {
	backgroundColor: COLORS.brass,
	color: COLORS.brassInk,
	borderRadius: 9,
	padding: "14px 30px",
	fontSize: 15,
	fontWeight: 700,
	textDecoration: "none",
	display: "inline-block",
};

export const buttonSection: React.CSSProperties = {
	textAlign: "center",
	margin: "0 0 28px",
};

export const codeSection: React.CSSProperties = {
	backgroundColor: COLORS.brassWash,
	borderRadius: 10,
	padding: "16px 0",
	textAlign: "center",
	margin: "0 0 24px",
};

export const code: React.CSSProperties = {
	color: COLORS.ink,
	fontSize: 32,
	fontWeight: 800,
	letterSpacing: 6,
	margin: 0,
};

export const link: React.CSSProperties = {
	color: COLORS.brassDeep,
	fontSize: 13,
	lineHeight: "20px",
	wordBreak: "break-all",
};

export const divider: React.CSSProperties = {
	borderColor: COLORS.line,
	margin: "24px 0",
};

export const footer: React.CSSProperties = {
	color: COLORS.muted,
	fontSize: 12,
	lineHeight: "18px",
	textAlign: "center",
	margin: 0,
};

export function EmailShell({
	preview,
	children,
}: {
	preview: string;
	children: ReactNode;
}) {
	return (
		<Html>
			<Head />
			<Preview>{preview}</Preview>
			<Body style={body}>
				<Container style={container}>
					<Section style={brandRow}>
						<Text style={brand}>JustUs Financial</Text>
						<Text style={eyebrow}>Justice, crowdfunded</Text>
					</Section>
					{children}
				</Container>
			</Body>
		</Html>
	);
}

export { Button, Heading, Hr, Section, Text };
