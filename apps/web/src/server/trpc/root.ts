import { router } from "./init";
import { servicesRouter } from "./routers/services";
import { statusRouter } from "./routers/status";
import { settingsRouter } from "./routers/settings";
import { integrationsRouter } from "./routers/integrations";
import { widgetsRouter } from "./routers/widgets";
import { infraNodesRouter } from "./routers/infraNodes";
import { networkDevicesRouter } from "./routers/networkDevices";
import { quickLinksRouter } from "./routers/quickLinks";
import { camerasRouter } from "./routers/cameras";
import { boardsRouter } from "./routers/boards";
import { usersRouter } from "./routers/users";
import { searchRouter } from "./routers/search";
import { helpItemsRouter } from "./routers/helpItems";

export const appRouter = router({
  services: servicesRouter,
  status: statusRouter,
  settings: settingsRouter,
  integrations: integrationsRouter,
  widgets: widgetsRouter,
  infraNodes: infraNodesRouter,
  networkDevices: networkDevicesRouter,
  quickLinks: quickLinksRouter,
  cameras: camerasRouter,
  boards: boardsRouter,
  users: usersRouter,
  search: searchRouter,
  helpItems: helpItemsRouter,
});

export type AppRouter = typeof appRouter;
