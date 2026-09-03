"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import type { Backup } from "@/lib/undo-backup";
import { restoreBackup } from "@/lib/undo-restore";

/**
 * Puts back the rows a delete removed.
 *
 * The one way into `restoreBackup` from the browser, and it gates itself like
 * every other action here: actions are routed independently of layouts, so the
 * admin layout's session check protects pages and nothing else. The rows
 * arriving are a suggestion, not a guarantee — `src/lib/undo-backup.ts` is
 * where they are made safe.
 *
 * It revalidates, unlike the wall's autosaves. This creates rows, so the rule
 * by `refresh` in portfolio-actions.ts applies: a surface has to be told the
 * arrangement changed under it. Undo is a keypress rather than a keystroke, so
 * the whole-site render that costs is one the artist asks for by name.
 */
export async function restoreDeleted(backup: Backup): Promise<void> {
  await requireSession();
  await restoreBackup(backup);
  revalidatePath("/", "layout");
}
