import { paginationSchema } from "@metallo/validation";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function parsePage(searchParams: SearchParams) {
  const raw = await searchParams;
  return paginationSchema.parse({
    page: Array.isArray(raw.page) ? raw.page[0] : raw.page,
    pageSize: Array.isArray(raw.pageSize) ? raw.pageSize[0] : raw.pageSize,
    q: Array.isArray(raw.q) ? raw.q[0] : raw.q,
  });
}
