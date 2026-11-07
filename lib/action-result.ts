import "server-only";
import { unstable_rethrow } from "next/navigation";
import { HttpError } from "./auth";
import type { ActionResult } from "./types";

// Expected failures cross the Server Function boundary as data; framework
// redirects and unexpected database details stay on the server.
export async function actionResult<T>(
  work: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof HttpError)
      return { ok: false, error: error.message, code: error.status };
    if (error instanceof Error && error.name === "ZodError")
      return {
        ok: false,
        error: "Check the submitted fields and try again.",
        code: 400,
      };
    console.error(
      "Server Function failed:",
      error instanceof Error ? error.message : "Database operation failed",
    );
    return {
      ok: false,
      error: "We couldn't complete that request. Please try again.",
      code: 500,
    };
  }
}
