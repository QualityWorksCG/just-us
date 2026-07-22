"use client";

type DashboardSession = {
	user: {
		id: string;
		name: string;
		email: string;
		emailVerified: boolean;
		role?: string | null;
	};
};

export default function Dashboard(_props: { session: DashboardSession }) {
	// Placeholder — role-specific dashboards land with the case/attorney modules.
	return null;
}
