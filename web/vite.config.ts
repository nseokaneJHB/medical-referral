import { defineConfig, loadEnv } from "vite";

import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";

const config = defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "VITE_");

	console.log("CLIENT API URL:", env.VITE_API_URL);
	console.log("SERVER API URL:", process.env.SERVER_API_URL);

	return {
		build: { chunkSizeWarningLimit: 1000 },
		optimizeDeps: {
			include: ["@referral-tracking/shared"],
		},
		server: {
			port: 3000,
			watch: {
				ignored: ["!**/node_modules/@referral-tracking/shared/**"],
			},
		},
		resolve: { tsconfigPaths: true },
		plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
	};
});

export default config;
