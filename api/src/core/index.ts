import type { Database, Executor } from "./helpers";

import { User } from "./user";
import { Logins } from "./logins";
import { Patient } from "./patient";
import { Facility } from "./facility";
import { Referral } from "./referral";
import { Session } from "./session";
import { Timeline } from "./timeline";
import { Specialty } from "./specialty";
import { Verification } from "./verification";
import { BetterAuth } from "./authentication";

import { auth as betterAuth } from "../lib/auth";

/**
 * The subset of `CoreService` that makes sense to rebind to a transaction.
 * `betterAuth` is deliberately excluded — it talks to better-auth's own
 * HTTP-boundary API, which can't participate in a Drizzle transaction.
 */
type TransactableCore = Pick<
	CoreService,
	| "user"
	| "patient"
	| "facility"
	| "referral"
	| "timeline"
	| "session"
	| "logins"
	| "verification"
	| "specialty"
>;

export class CoreService {
	public user: User;
	public patient: Patient;
	public facility: Facility;
	public referral: Referral;
	public timeline: Timeline;
	public session: Session;
	public logins: Logins;
	public betterAuth: BetterAuth;
	public verification: Verification;
	public specialty: Specialty;

	constructor(db: Database, auth: typeof betterAuth) {
		this.user = new User(db);
		this.patient = new Patient(db);
		this.facility = new Facility(db);
		this.referral = new Referral(db);
		this.timeline = new Timeline(db);
		this.session = new Session(db);
		this.logins = new Logins(db);
		this.betterAuth = new BetterAuth(auth);
		this.verification = new Verification(db);
		this.specialty = new Specialty(db);
	}

	/**
	 * Returns a fresh set of repo instances, each bound to `tx` in their
	 * constructor instead of the outer singleton connection. Every call
	 * made through the returned object runs inside that transaction —
	 * there's no `tx` argument left to forget.
	 *
	 * Use ONLY inside `server.core.connection.transaction(async (tx) => {...})`.
	 * Each call to this creates new (cheap — stateless besides `db` and
	 * static configs) repo instances; it does not mutate the singleton.
	 */
	withTransaction = (tx: Executor): TransactableCore => ({
		user: new User(tx),
		patient: new Patient(tx),
		facility: new Facility(tx),
		referral: new Referral(tx),
		timeline: new Timeline(tx),
		session: new Session(tx),
		logins: new Logins(tx),
		verification: new Verification(tx),
		specialty: new Specialty(tx),
	});
}
