"use client";

import { US_STATES } from "@just-us/auth/jurisdiction";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@just-us/ui/components/select";
import { cn } from "@just-us/ui/lib/utils";
import { Plus, X } from "lucide-react";

/**
 * The states an attorney says they are admitted in — chips plus an add control.
 *
 * A single Select cannot express this. A licence is per state and an attorney can
 * hold several, and the platform now reads that list to decide which cases they
 * may take, so the control has to let them say "New York *and* New Jersey"
 * rather than making them trade one for the other.
 *
 * Deliberately plain about what it is *not*: adding a state here is a claim, and
 * the label says so. The bar check is what turns a claim into permission, and it
 * runs per state — see the admissions panel on the directory profile.
 */
export function AdmittedStatesField({
	value,
	onChange,
	disabled = false,
	invalid = false,
	addId,
	hideChips = false,
}: {
	value: string[];
	onChange: (next: string[]) => void;
	disabled?: boolean;
	invalid?: boolean;
	/** For the label that names the add control. */
	addId?: string;
	/** Set where the caller already lists the chosen states with more to say about
	 *  them than this control can — the admissions panel shows each one's bar
	 *  standing, and a second, statusless copy of the same list would only mislead. */
	hideChips?: boolean;
}) {
	const remaining = US_STATES.filter((state) => !value.includes(state));

	return (
		<div className="flex flex-col gap-2.5">
			{value.length > 0 && !hideChips && (
				<ul className="flex flex-wrap gap-2">
					{value.map((state, index) => (
						<li key={state}>
							<span
								className={cn(
									"inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] py-1 pr-1 pl-3 font-semibold text-[13px]",
									// The first is the one the directory leads with, so it reads
									// differently rather than being silently special.
									index === 0
										? "bg-brass-deep text-white"
										: "bg-brass-wash text-brass-deep",
								)}
							>
								{state}
								{index === 0 && value.length > 1 && (
									<span className="font-normal text-[11px] opacity-80">
										primary
									</span>
								)}
								<button
									type="button"
									disabled={disabled}
									onClick={() =>
										onChange(value.filter((other) => other !== state))
									}
									aria-label={`Remove ${state}`}
									className="inline-flex size-5 items-center justify-center rounded-full transition-colors hover:bg-black/15 disabled:opacity-50"
								>
									<X className="size-3.5" aria-hidden="true" />
								</button>
							</span>
						</li>
					))}
				</ul>
			)}

			<Select
				// Never holds a value: picking a state adds a chip and the control goes
				// back to being an invitation to add another.
				value=""
				onValueChange={(next: string | null) => {
					if (next && !value.includes(next)) onChange([...value, next]);
				}}
				disabled={disabled || remaining.length === 0}
			>
				<SelectTrigger
					id={addId}
					className="h-11 max-w-[340px] bg-surface text-[14px]"
					aria-invalid={invalid}
				>
					<span className="flex items-center gap-2 text-muted-foreground">
						<Plus className="size-4" aria-hidden="true" />
						<SelectValue
							placeholder={
								value.length === 0 ? "Select a state…" : "Add another state…"
							}
						/>
					</span>
				</SelectTrigger>
				<SelectContent className="max-h-[300px]">
					{remaining.map((state) => (
						<SelectItem key={state} value={state} className="text-[14px]">
							{state}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
