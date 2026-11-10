import { AppShell } from "@/components/shell/app-shell";
import { SetupScreen } from "@/components/shell/setup-screen";
import { getContext, getDatabaseState } from "@/server/context";
import { getLeadViewCounts } from "@/server/services/leads";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const state = await getDatabaseState();
  if (state.kind !== "ready") return <SetupScreen state={state} />;

  const ctx = await getContext();
  const counts = await getLeadViewCounts(ctx);
  return (
    <AppShell workspaceName={ctx.workspace.name} userName={ctx.user.name} attentionCount={counts.attention}>
      {children}
    </AppShell>
  );
}
