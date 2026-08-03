"use client";

import { cn } from "@just-us/ui/lib/utils";
import {
	createContext,
	type ReactNode,
	useContext,
	useTransition,
} from "react";

/**
 * Shares one transition between a filter control and the server-rendered results
 * it reloads.
 *
 * Filtering is a URL change, so the new list is rendered on the server and the
 * page has no client state to flip into a loading state. Routing the
 * `router.push` through a transition here gives both halves the same pending
 * flag: the control can show a spinner, and `FilterPending` can hold the
 * previous results on screen — dimmed — until the new ones arrive.
 *
 * Holding the old rows beats swapping in a skeleton: the administrator keeps
 * their place in a list they were already reading, and a fast filter change
 * doesn't flash empty scaffolding on the way through.
 */
type FilterTransition = {
	pending: boolean;
	start: (navigate: () => void) => void;
};

const Ctx = createContext<FilterTransition>({
	pending: false,
	start: (navigate) => navigate(),
});

export function FilterTransition({ children }: { children: ReactNode }) {
	const [pending, startTransition] = useTransition();
	return (
		<Ctx.Provider value={{ pending, start: startTransition }}>
			{children}
		</Ctx.Provider>
	);
}

export function useFilterTransition() {
	return useContext(Ctx);
}

/**
 * Dims and freezes its children while a filter change is in flight. Freezing
 * matters as much as dimming: without it the stale rows below are still
 * clickable, so a mistimed click opens the account that used to be in that spot.
 */
export function FilterPending({
	className,
	children,
}: {
	/** Layout classes for the wrapper, so wrapping content can't collapse the
	 *  spacing the caller had without it. */
	className?: string;
	children: ReactNode;
}) {
	const { pending } = useFilterTransition();
	return (
		<div
			aria-busy={pending}
			className={cn(
				"transition-opacity duration-150",
				pending && "pointer-events-none opacity-45",
				className,
			)}
		>
			{children}
		</div>
	);
}
