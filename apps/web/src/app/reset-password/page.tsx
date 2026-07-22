import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
	searchParams,
}: {
	searchParams: Promise<{ token?: string; error?: string }>;
}) {
	const { token, error } = await searchParams;
	return <ResetPasswordForm token={token} error={error} />;
}
