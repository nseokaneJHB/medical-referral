import { hash, verify, Algorithm } from "@node-rs/argon2";

/**
 * Password hashing for this app's `emailAndPassword` accounts — Argon2id via
 * `@node-rs/argon2`, wired into `better-auth`'s `emailAndPassword.password`
 * config in `auth.ts`. Deliberately not better-auth's own default hasher
 * (scrypt, `better-auth/crypto`'s `hashPassword`/`verifyPassword`): every
 * password in this system — sign-up, admin-created accounts (`signUpEmail`
 * under the hood), and admin password resets — goes through this same
 * Argon2id path, matched by `verify` below at sign-in.
 *
 * Signatures match what `better-auth`'s `context.password.hash`/`.verify`
 * expect (see `node_modules/better-auth/dist/context/create-context.mjs`).
 */
export const hashPassword = async (password: string): Promise<string> =>
	hash(password, { algorithm: Algorithm.Argon2id });

export const verifyPassword = async ({
	hash: hashed,
	password,
}: {
	hash: string;
	password: string;
}): Promise<boolean> => verify(hashed, password);
