import type { CoreService } from "../core";

import { AppealManager } from "./appeal";
import { SessionManager } from "./session";
import { TransferManager } from "./transfer";
import { ModerationManager } from "./moderation";

/**
 * Domain workflows that span more than one `core/*.ts` repository —
 * "decide this appeal" touches `timeline` + `user`/`facility`, "change this
 * entity's status" touches `user`/`facility` + `timeline`, etc. `core/*.ts`
 * stays table-generic (one class per table, no business meaning attached);
 * this layer is where that meaning lives. Composes `core.*` repo calls
 * only — no direct Drizzle access, that stays exclusive to `core/*.ts`.
 *
 * Registered on the Fastify instance as `request.server.management`,
 * immediately after `core` (see `middleware/index.ts`) — same shape as
 * `CoreService`, just one layer up.
 */
export class ManagementService {
	public appeal: AppealManager;
	public session: SessionManager;
	public transfer: TransferManager;
	public moderation: ModerationManager;

	constructor(core: CoreService) {
		this.appeal = new AppealManager(core);
		this.session = new SessionManager();
		this.transfer = new TransferManager(core);
		this.moderation = new ModerationManager(core);
	}
}
