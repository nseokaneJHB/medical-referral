import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import {
	TanStackDevtools,
	type TanStackDevtoolsReactPlugin,
} from "@tanstack/react-devtools";

const tanstackPlugins: Array<TanStackDevtoolsReactPlugin> = [
	{
		name: "Tanstack Query",
		render: <ReactQueryDevtoolsPanel />,
	},
	{
		name: "Tanstack Router",
		render: <TanStackRouterDevtoolsPanel />,
	},
];

export const TanStackQueryDevtools = () => {
	return (
		<TanStackDevtools
			config={{ position: "bottom-right" }}
			plugins={tanstackPlugins}
		/>
	);
};
