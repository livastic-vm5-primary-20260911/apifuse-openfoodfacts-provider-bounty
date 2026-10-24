import { startDevServer } from "@apifuse/provider-sdk";

import provider from "./index";

startDevServer(provider, { port: Number(process.env.PORT) || 3900 });
