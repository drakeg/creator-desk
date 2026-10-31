import { z } from "zod";
export function publisherClient(raw) {
  if (!raw?.trim()) return null;
  try {
    const client = z
      .object({
        installed: z.object({
          client_id: z
            .string()
            .max(250)
            .regex(/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/),
          client_secret: z.string().min(1).max(250),
        }),
      })
      .strict()
      .parse(JSON.parse(raw));
    return client.installed;
  } catch {
    throw new Error(
      "CREATOR_DESK_GOOGLE_DESKTOP_CLIENT_JSON must contain a Google Desktop app credentials JSON.",
    );
  }
}
