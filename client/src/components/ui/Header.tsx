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
            <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-4 px-6 py-6 sm:px-8 sm:py-10 md:flex-row md:items-end xl:px-12">
                <div>
                    <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
                        {workspacePath} / {workspaceTitle}
                    </p>
                    <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.05em] text-ink sm:text-5xl">
                        {workspaceTitle}
                    </h1>
                    <p className="mt-3 max-w-2xl text-base leading-7 text-ink-secondary">
                        {workspaceDescription}
                    </p>
                </div>
                {actionButton && (
                    <div className="flex justify-end">
                        {actionButton}
                    </div>
                )}
            </div>
        </header>
    );
}