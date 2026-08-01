import { hc } from "hono/client";
import type { AppType } from "@phoebe/server";

export const client = hc<AppType>("/");
