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

export const body: React.CSSProperties = {
	backgroundColor: "#f4f4f5",
	fontFamily:
		'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

export const container: React.CSSProperties = {
	backgroundColor: "#ffffff",
	borderRadius: 12,
	margin: "40px auto",
	padding: "40px 32px",
	maxWidth: 440,
};

export const eyebrow: React.CSSProperties = {
	color: "#a1a1aa",
	fontSize: 11,
	fontWeight: 600,
	letterSpacing: 3,
	textTransform: "uppercase",
	textAlign: "center",
	margin: "0 0 4px",
};

export const brand: React.CSSProperties = {
	color: "#6d28d9",
	fontSize: 13,
	fontWeight: 700,
	letterSpacing: 0.4,
	textAlign: "center",
	margin: "0 0 16px",
};

export const heading: React.CSSProperties = {
	color: "#18181b",
	fontSize: 26,
	fontWeight: 700,
	lineHeight: "1.2",
	letterSpacing: -0.4,
	textAlign: "center",
	margin: "0 0 16px",
};

export const paragraph: React.CSSProperties = {
	color: "#3f3f46",
	fontSize: 15,
	lineHeight: "24px",
	textAlign: "center",
	margin: "0 0 24px",
};

export const buttonStyle: React.CSSProperties = {
	backgroundColor: "#6d28d9",
	color: "#ffffff",
	borderRadius: 8,
	padding: "14px 28px",
	fontSize: 15,
	fontWeight: 600,
	textDecoration: "none",
	display: "inline-block",
};

export const buttonSection: React.CSSProperties = {
	textAlign: "center",
	margin: "0 0 28px",
};

export const codeSection: React.CSSProperties = {
	backgroundColor: "#f4f4f5",
	borderRadius: 8,
	padding: "16px 0",
	textAlign: "center",
	margin: "0 0 24px",
};

export const code: React.CSSProperties = {
	color: "#18181b",
	fontSize: 32,
	fontWeight: 700,
	letterSpacing: 6,
	margin: 0,
};

export const link: React.CSSProperties = {
	color: "#6d28d9",
	fontSize: 13,
	lineHeight: "20px",
	wordBreak: "break-all",
};

export const divider: React.CSSProperties = {
	borderColor: "#e4e4e7",
	margin: "24px 0",
};

export const footer: React.CSSProperties = {
	color: "#a1a1aa",
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
					<Text style={brand}>just-us</Text>
					{children}
				</Container>
			</Body>
		</Html>
	);
}

export { Button, Heading, Hr, Section, Text };
