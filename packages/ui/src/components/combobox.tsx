"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { cn } from "@just-us/ui/lib/utils";
import { CheckIcon, ChevronDownIcon } from "lucide-react";

/**
 * A select you can type into.
 *
 * Built on the same base-ui family as `Select`, so triggers, popups, and
 * highlight states match. Pass the options as `items` on the root and base-ui
 * filters them against what's typed; render each one through
 * `ComboboxList`'s function child.
 */

function Combobox(props: ComboboxPrimitive.Root.Props<string>) {
	return <ComboboxPrimitive.Root data-slot="combobox" {...props} />;
}

/** The typing surface. Doubles as the closed-state display, so it shows the
 *  current selection when the popup isn't open. */
function ComboboxInput({ className, ...props }: ComboboxPrimitive.Input.Props) {
	return (
		<div className="relative">
			<ComboboxPrimitive.Input
				data-slot="combobox-input"
				className={cn(
					"flex h-9 w-full items-center rounded-[var(--radius-control)] border border-input bg-surface py-1 pr-8 pl-3 text-ink text-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20",
					className,
				)}
				{...props}
			/>
			{/* The chevron opens the list, so someone who'd rather browse than type
			    doesn't have to guess that the field is a menu. */}
			<ComboboxPrimitive.Trigger
				data-slot="combobox-trigger"
				aria-label="Show options"
				className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-muted-foreground outline-none"
			>
				<ComboboxPrimitive.Icon>
					<ChevronDownIcon className="size-4" />
				</ComboboxPrimitive.Icon>
			</ComboboxPrimitive.Trigger>
		</div>
	);
}

function ComboboxContent({
	className,
	children,
	sideOffset = 4,
	align,
	side,
	...props
}: ComboboxPrimitive.Popup.Props &
	Pick<ComboboxPrimitive.Positioner.Props, "sideOffset" | "align" | "side">) {
	return (
		<ComboboxPrimitive.Portal>
			<ComboboxPrimitive.Positioner
				className="isolate z-50 outline-none"
				sideOffset={sideOffset}
				align={align}
				side={side}
			>
				<ComboboxPrimitive.Popup
					data-slot="combobox-content"
					className={cn(
						"data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 z-50 max-h-(--available-height) w-(--anchor-width) origin-(--transform-origin) overflow-y-auto rounded-(--radius-card-sm) bg-popover p-1 text-popover-foreground shadow-md outline-none ring-1 ring-foreground/10 data-closed:animate-out data-open:animate-in",
						className,
					)}
					{...props}
				>
					{children}
				</ComboboxPrimitive.Popup>
			</ComboboxPrimitive.Positioner>
		</ComboboxPrimitive.Portal>
	);
}

function ComboboxList(props: ComboboxPrimitive.List.Props) {
	return <ComboboxPrimitive.List data-slot="combobox-list" {...props} />;
}

/** Shown when the typed text matches nothing — without it the popup just
 *  collapses to an empty box and reads as broken. */
function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
	return (
		<ComboboxPrimitive.Empty
			data-slot="combobox-empty"
			className={cn(
				"px-2 py-3 text-center text-muted-foreground text-xs",
				className,
			)}
			{...props}
		/>
	);
}

function ComboboxItem({
	className,
	children,
	...props
}: ComboboxPrimitive.Item.Props) {
	return (
		<ComboboxPrimitive.Item
			data-slot="combobox-item"
			className={cn(
				// Matches SelectItem: options are role="option", so the base pointer rule
				// in globals.css doesn't reach them.
				"relative flex w-full cursor-pointer select-none items-center gap-2 rounded-(--radius-chip) py-2 pr-8 pl-2 text-xs outline-none data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				className,
			)}
			{...props}
		>
			<span className="pointer-events-none absolute right-2 flex items-center justify-center">
				<ComboboxPrimitive.ItemIndicator>
					<CheckIcon className="size-4" />
				</ComboboxPrimitive.ItemIndicator>
			</span>
			{children}
		</ComboboxPrimitive.Item>
	);
}

export {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
};
