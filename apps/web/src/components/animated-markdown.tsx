import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type AnimatedMarkdownProps = {
	markdown: string;
	loading?: boolean;
	emptyText?: string;
	className?: string;
	animate?: boolean;
};

function useAnimatedMarkdown(markdown: string, animate: boolean): string {
	const [displayed, setDisplayed] = useState(markdown);

	useEffect(() => {
		if (!animate || !markdown || markdown.startsWith("Error:")) {
			setDisplayed(markdown);
			return;
		}

		setDisplayed("");
		let frame = 0;
		let cancelled = false;
		const total = markdown.length;
		const step = Math.max(4, Math.ceil(total / 140));

		const reveal = (index: number) => {
			if (cancelled) return;
			const nextIndex = Math.min(total, index + step);
			setDisplayed(markdown.slice(0, nextIndex));
			if (nextIndex >= total) return;
			frame = window.setTimeout(() => reveal(nextIndex), 14);
		};

		reveal(0);

		return () => {
			cancelled = true;
			window.clearTimeout(frame);
		};
	}, [animate, markdown]);

	return displayed;
}

export function AnimatedMarkdown({
	markdown,
	loading = false,
	emptyText = "No content yet.",
	className = "",
	animate = true,
}: AnimatedMarkdownProps) {
	const displayed = useAnimatedMarkdown(markdown, animate);
	const content = useMemo(() => displayed.trim(), [displayed]);

	if (loading && !markdown) {
		return (
			<div className={`space-y-2 ${className}`}>
				<div className="h-3 w-24 animate-pulse rounded bg-[var(--b1)]" />
				<div className="h-3 w-full animate-pulse rounded bg-[var(--b0)]" />
				<div className="h-3 w-[92%] animate-pulse rounded bg-[var(--b0)]" />
				<div className="h-3 w-[76%] animate-pulse rounded bg-[var(--b0)]" />
			</div>
		);
	}

	if (!content) {
		return <div className={`text-[var(--t3)] ${className}`}>{emptyText}</div>;
	}

	return (
		<div className={`text-[11px] leading-5 text-[var(--t1)] ${className}`}>
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				components={{
					h1: ({ ...props }) => (
						<h1 className="mb-2 text-[13px] font-semibold text-[var(--t0)]" {...props} />
					),
					h2: ({ ...props }) => (
						<h2 className="mb-2 text-[12px] font-semibold text-[var(--t0)]" {...props} />
					),
					h3: ({ ...props }) => (
						<h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--t0)]" {...props} />
					),
					p: ({ ...props }) => <p className="mb-2 last:mb-0" {...props} />,
					ul: ({ ...props }) => <ul className="mb-2 ml-4 list-disc space-y-1" {...props} />,
					ol: ({ ...props }) => <ol className="mb-2 ml-4 list-decimal space-y-1" {...props} />,
					li: ({ ...props }) => <li className="pl-1" {...props} />,
					strong: ({ ...props }) => <strong className="font-semibold text-[var(--t0)]" {...props} />,
					em: ({ ...props }) => <em className="italic text-[var(--t0)]" {...props} />,
					code: ({ className: codeClassName, children, ...props }) => {
						const inline = !String(codeClassName ?? "").includes("language-");
						if (inline) {
							return (
								<code
									className="rounded bg-[var(--s2)] px-1 py-0.5 font-mono text-[10px] text-[var(--t0)]"
									{...props}
								>
									{children}
								</code>
							);
						}

						return (
							<code className="font-mono text-[10px] text-[var(--t0)]" {...props}>
								{children}
							</code>
						);
					},
					pre: ({ ...props }) => (
						<pre
							className="mb-2 overflow-x-auto rounded-[6px] border border-[var(--b1)] bg-[var(--s2)] p-2 font-mono text-[10px]"
							{...props}
						/>
					),
					blockquote: ({ ...props }) => (
						<blockquote
							className="mb-2 border-l-2 border-[var(--blue)] pl-3 italic text-[var(--t2)]"
							{...props}
						/>
					),
				}}
			>
				{content}
			</ReactMarkdown>
		</div>
	);
}
