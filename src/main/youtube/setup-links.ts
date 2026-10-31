import { z } from "zod";
import {
  googleSetupPageIds,
  googleSetupPages,
} from "../../shared/google-setup";
export const openGoogleSetupInput = z
  .object({ page: z.enum(googleSetupPageIds) })
  .strict();
export function googleSetupURL(input: unknown) {
  return googleSetupPages[openGoogleSetupInput.parse(input).page].url;
}
