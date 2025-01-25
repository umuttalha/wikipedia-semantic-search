import { useEffect, useState } from "react";
import Search from "./search";
import { InfoBox } from "./info-box";
import { useQuerySearchParam } from "../../lib/use-query-search-param";
import { formatter } from "@/lib/utils";
import { SearchResult } from "./search-result";
import { useFetchInfo } from "@/lib/use-fetch-info";
import { BorderBox } from "../border-box";
import { ToggleNew } from "../toggle";




export const SearchTab = () => {
  const [search, setSearch] = useState<string>("");
  const [searchParam, setSearchParam] = useQuerySearchParam();
  const [isInitial, setIsInitial] = useState(true);

  const { data: info } = useFetchInfo();

  const [isAnyLoading, setIsAnyLoading] = useState(false);


  const [isFasttext, setIsFasttext] = useState(false);
  const [textReranker, setTextReranker] = useState(false);



  // Use the search query in the URL
  useEffect(() => {
    if (!isInitial) return;
    setIsInitial(false);
    if (searchParam.query) {
      setSearch(searchParam.query);
    } else {
      const query = "Who are the founders of internet?";
      setSearchParam({
        query,
        leftModel: "MXBAI (Dense)",
        rightModel: "MXBAI / BM25 (Hybrid)",
      });
      setSearch(query);
    }
  }, [searchParam, isInitial]);

  const handleSearchSubmit = async (query: string) => {
    let rightQuery = query;
    
    if (isFasttext) {
      try {
        const response = await fetch('http://173.212.198.227:8000/find-similar-words', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: query,
            max_results: 5
          })
        });

        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        rightQuery = await response.text();
        
      } catch (error) {
        console.error('Error:', error);
        rightQuery = query;
      }
    }

    console.log("Original Query:", query);
    console.log("Right Query:", rightQuery);
    
    setSearchParam({ 
      query: query,
      rightQuery: isFasttext ? rightQuery : query
    });
  };

  const modifyQuery = (query: string) => {
    // Örnek olarak, query'yi büyük harfe çeviriyoruz
    return query.toUpperCase();
  };

  return (
    <div className="max-w-[1180px] mx-auto grid gap-4">
      <BorderBox>
        <Search
          value={search}
          onChange={setSearch}
          onSubmit={() => handleSearchSubmit(search)}
          isLoading={isAnyLoading}
        />
        <p className="text-zinc-500 text-sm mt-2 -mb-2">
          This database index stores{" "}
          <b>{formatter.format(info?.vectorCount ?? 0)}</b> wikipedia articles.
        </p>
      </BorderBox>

      <div className="grid grid-cols-2 gap-4 justify-center max-w-[1180px] mx-auto w-full">
        <BorderBox>
          <SearchResult
            textReranker={false}
            searchParam={searchParam.query}
            onLoadingChange={setIsAnyLoading}
            modelOption={searchParam.leftModel}
            setModelOption={(model) => setSearchParam({ leftModel: model })}
            isRightPanel={false}
          />
        </BorderBox>

        <BorderBox>
          <ToggleNew
            checked={isFasttext}
            onChange={(checked) => {
              console.log("Fasttext Toggle is now:", checked);
              setIsFasttext(checked);
              if (!checked) {
                // Reset right query to match left when disabling fasttext
                setSearchParam({ rightQuery: searchParam.query });
              }
            }}
            className="mt-4"
            label="fasttext"
          />

          <ToggleNew
            checked={textReranker}
            onChange={(checked) => {
              console.log("TextReranker Toggle is now:", checked);
              setTextReranker(checked);
            }}
            className="mt-4"
            label="textReranker"
          />

          <SearchResult
            textReranker={textReranker}
            searchParam={searchParam.query}
            rightQuery={searchParam.rightQuery}
            isRightPanel={true}
            onLoadingChange={setIsAnyLoading}
            modelOption={searchParam.rightModel}
            setModelOption={(model) => setSearchParam({ rightModel: model })}
          />
        </BorderBox>
      </div>
      {!isAnyLoading && <InfoBox />}
    </div>
  );
};