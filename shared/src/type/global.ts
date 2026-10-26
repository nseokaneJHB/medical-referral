import { z } from "zod";

import { globalResponseSchema, paginationQuerySchema } from "../schema/global";

export type GlobalResponse = z.infer<typeof globalResponseSchema>;

/** Raw `?page=&limit=` query params, still unparsed strings — the shape every plain-pagination Fastify route's `Querystring` takes. */
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
