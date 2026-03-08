export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startInboxWatcher } = await import("./lib/inbox-watcher");
    await startInboxWatcher();
  }
}
