import { Result, WikiMetadata } from "@/lib/types";
import { useQuerySearchParam } from "@/lib/use-query-search-param";
import { ExternalLinkIcon } from "@radix-ui/react-icons";
import { QueryResult } from "@upstash/vector";
import { PropsWithChildren, useEffect, useState } from "react";

export default function List({ textReranker, state }: { textReranker: boolean, state: Result | undefined }) {
  const [searchParam, setSearchParam] = useQuerySearchParam();
  const isEmpty = searchParam.query === "";
  const [rerankedVectors, setRerankedVectors] = useState<QueryResult<WikiMetadata>[]>();

  useEffect(() => {
    async function rerankVectors() {
      if (textReranker && state?.data && searchParam.query) {
        try {
          const response = await fetch('http://173.212.198.227:8000/rerank', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: searchParam.query,
              vectors: state.data
            })
          });

          if (response.ok) {
            const rerankedData = await response.json();
            setRerankedVectors(rerankedData);
          }
        } catch (error) {
          console.error('Error reranking vectors:', error);
        }
      }
    }


    

    rerankVectors();
  }, [textReranker, state, searchParam.query]);

  const vectors = textReranker ? rerankedVectors : state?.data;

  const listItems =
    isEmpty || (state && vectors?.length === 0)
      ? undefined
      : !vectors
        ? new Array(3).fill(null).map((_, i) => (
            <ListItem key={i} skeleton textReranker={textReranker} />
          ))
        : vectors.map((vector, i) => (
            <ListItem
              key={vector.metadata?.id + i.toString()}
              vector={vector}
              textReranker={textReranker}
            />
          ));

  return <>{listItems}</>;
}

function ListItemBorderBox({ children }: PropsWithChildren) {
  return (
    <div className="p-6 bg-zinc-100 rounded-2xl overflow-auto">{children}</div>
  );
}
function ListItem({
  vector,
  skeleton,
  textReranker,
}:
  | {
      vector: QueryResult<WikiMetadata>;
      skeleton?: never;
      textReranker: boolean;
    }
  | {
      vector?: never;
      skeleton: true;
      textReranker: boolean;
    }) {
  if (skeleton) {
    return (
      <ListItemBorderBox>
        <div className="max-w-64 sm:h-5 h-4 rounded-md animate-pulse bg-zinc-700/10" />
        <div className="max-w-[450px] mt-2 sm:h-5 h-4 rounded-md animate-pulse bg-zinc-700/10" />
        <div className="max-w-[400px] mt-1 sm:h-5 h-4 rounded-md animate-pulse bg-zinc-700/10" />
        <div className="max-w-[120px] mt-3 sm:h-5 h-4 rounded-md animate-pulse bg-zinc-700/10" />
      </ListItemBorderBox>
    );
  }


  return (
    <ListItemBorderBox>
      <article>
        <p className="font-semibold text-zinc-950">{vector.metadata?.title}</p>
        <p className="line-clamp-2 text-zinc-700">{vector.data}</p>
        <p className="mt-2 text-ellipsis overflow-hidden text-zinc-500 line-clamp-1">
          Score: {vector.score.toFixed(4)} •{" "}
          <a
            href={vector.metadata?.url}
            target="_blank"
            className="hover:bg-emerald-100 text-ellipsis overflow-hidden w-1/4"
          >
            {decodeURI(vector.metadata?.url ?? "")}
          </a>
          <ExternalLinkIcon
            className="ml-1 inline-flex opacity-60"
            href={vector.metadata?.url}
          />
        </p>
      </article>
    </ListItemBorderBox>
  );
}
