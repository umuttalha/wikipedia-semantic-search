import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { ModelOption } from "./types";

type QuerySearchParam = {
  query: string;
  rightQuery?: string;
  leftModel: ModelOption;
  rightModel: ModelOption;
};

export const useQuerySearchParam = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const query = searchParams.get("query") ?? "";
  const rightQuery = searchParams.get("rightQuery") ?? query;
  const leftModel = (searchParams.get("leftModel") ?? "") as ModelOption;
  const rightModel = (searchParams.get("rightModel") ?? "") as ModelOption;

  const setState = useCallback(
    (params: Partial<QuerySearchParam>) => {
      const newParams = new URLSearchParams({
        query,
        rightQuery,
        leftModel,
        rightModel,
        ...params,
      });
      router.push(`${pathname}?${newParams}`);
    },
    [pathname, query, rightQuery, leftModel, rightModel, router]
  );

  const params: QuerySearchParam = {
    query,
    rightQuery,
    leftModel,
    rightModel,
  };
  return [params, setState] as const;
};
