// Renders compact workspace titles, supporting copy, and responsive page actions.
interface HeaderProps {
    workspacePath: string;
    workspaceTitle: string; 
    workspaceDescription: string;
    actionButton?: React.ReactNode;
    children?: React.ReactNode;
}

export function Header({ workspacePath, workspaceTitle, workspaceDescription, actionButton }: HeaderProps) {
    return (
        <header className="border-b border-paper-border bg-paper-light">
            <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-3 px-5 py-3.5 sm:px-8 sm:py-4 md:flex-row md:items-center xl:px-12">
                <div className="min-w-0">
                    <p className="break-words font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
                        {workspacePath} / {workspaceTitle}
                    </p>
                    <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                        {workspaceTitle}
                    </h1>
                    <p className="mt-1 max-w-2xl text-sm leading-5 text-ink-secondary">
                        {workspaceDescription}
                    </p>
                </div>
                {actionButton && (
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        {actionButton}
                    </div>
                )}
            </div>
        </header>
    );
}
