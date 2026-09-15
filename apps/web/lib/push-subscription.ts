type PushDeleteResponse = {
  ok: boolean;
  json: () => Promise<unknown>;
};

type PushFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<PushDeleteResponse>;

/** Remove server-side location/settings before deleting the browser subscription. */
export async function removePushSubscription(
  endpoint: string,
  unsubscribe: () => Promise<boolean>,
  request: PushFetch = fetch,
): Promise<boolean> {
  try {
    const response = await request("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    });
    if (!response.ok) return false;

    const result = (await response.json()) as { unsubscribed?: unknown };
    if (result.unsubscribed !== true) return false;

    return await unsubscribe();
  } catch {
    return false;
  }
}
