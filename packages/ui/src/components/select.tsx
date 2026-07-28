"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { cn } from "@just-us/ui/lib/utils";
import { CheckIcon, ChevronDownIcon } from "lucide-react";

function Select(props: SelectPrimitive.Root.Props<string>) {
	return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectGroup(props: SelectPrimitive.Group.Props) {
	return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
	return (
		<SelectPrimitive.Value
			data-slot="select-value"
			className={cn(
				"truncate data-[placeholder]:text-muted-foreground",
				className,
			)}
			{...props}
		/>
	);
}

function SelectTrigger({
	className,
	children,
	...props
}: SelectPrimitive.Trigger.Props) {
	return (
		<SelectPrimitive.Trigger
			data-slot="select-trigger"
			className={cn(
				// Opaque fill: the trigger sits on tinted surfaces (paper, the onboarding
				// action bar) where a transparent control reads as part of the background.
				"flex h-9 w-full items-center justify-between gap-2 whitespace-nowrap rounded-[var(--radius-control)] border border-input bg-surface px-3 py-1 text-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				className,
			)}
			{...props}
		>
			{children}
			<SelectPrimitive.Icon className="flex text-muted-foreground">
				<ChevronDownIcon className="size-4" />
			</SelectPrimitive.Icon>
		</SelectPrimitive.Trigger>
	);
}

function SelectContent({
	className,
	children,
	sideOffset = 4,
	align,
	side,
	...props
}: SelectPrimitive.Popup.Props &
	Pick<SelectPrimitive.Positioner.Props, "sideOffset" | "align" | "side">) {
	return (
		<SelectPrimitive.Portal>
			<SelectPrimitive.Positioner
				className="isolate z-50 outline-none"
				sideOffset={sideOffset}
				align={align}
				side={side}
				alignItemWithTrigger={false}
			>
				<SelectPrimitive.Popup
					data-slot="select-content"
					className={cn(
						// Panel radius sits one step above the control radius so the popup reads
						// as a card over the trigger rather than a square cut-out.
						"data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 z-50 max-h-(--available-height) min-w-(--anchor-width) origin-(--transform-origin) overflow-y-auto rounded-(--radius-card-sm) bg-popover p-1 text-popover-foreground shadow-md outline-none ring-1 ring-foreground/10 data-closed:animate-out data-open:animate-in",
						className,
					)}
					{...props}
				>
					{children}
				</SelectPrimitive.Popup>
			</SelectPrimitive.Positioner>
		</SelectPrimitive.Portal>
	);
}

function SelectItem({
	className,
	children,
	...props
}: SelectPrimitive.Item.Props) {
	return (
		<SelectPrimitive.Item
			data-slot="select-item"
			className={cn(
				// Options are role="option", not buttons, so the base-layer pointer rule in
				// globals.css doesn't reach them — set it here. Radius keeps the highlight
				// inset within the panel's rounded corners instead of squaring them off.
				"relative flex w-full cursor-pointer select-none items-center gap-2 rounded-(--radius-chip) py-2 pr-8 pl-2 text-xs outline-none data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				className,
			)}
			{...props}
		>
			<span className="pointer-events-none absolute right-2 flex items-center justify-center">
				<SelectPrimitive.ItemIndicator>
					<CheckIcon className="size-4" />
				</SelectPrimitive.ItemIndicator>
			</span>
			<SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
		</SelectPrimitive.Item>
	);
}

function SelectGroupLabel({
	className,
	...props
}: SelectPrimitive.GroupLabel.Props) {
	return (
		<SelectPrimitive.GroupLabel
			data-slot="select-group-label"
			className={cn("px-2 py-2 text-muted-foreground text-xs", className)}
			{...props}
		/>
	);
}

export {
	Select,
	SelectContent,
	SelectGroup,
	SelectGroupLabel,
	SelectItem,
	SelectTrigger,
	SelectValue,
};
