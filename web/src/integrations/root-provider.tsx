import type { PropsWithChildren } from "react";

import { ThemeProvider } from "@/integrations/theme-provider";

export const RootProviders = ({ children }: PropsWithChildren) => {
	return <ThemeProvider>{children}</ThemeProvider>;
};
