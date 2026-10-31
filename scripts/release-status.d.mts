export function releaseStatus(
  response: Response,
): Promise<"new" | "draft" | "published">;
