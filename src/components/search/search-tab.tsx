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
    if (isFasttext) {
      try {
        const response = await fetch(`http://127.0.0.1:6600/similar_words?word=${encodeURIComponent(query)}&top_n=5`);
        const data = await response.json();
        const similarWords = data.similar_words.map((item: { word: string }) => item.word);
        const combinedWords = similarWords.join(" "); // Kelimeleri boşlukla birleştir
        query = modifyQuery(combinedWords); // Birleştirilmiş kelimeleri kullan
      } catch (error) {
        console.error('Error:', error);
      }
    }

    console.log("Modified Query:", query);
    setSearchParam({ query: query });
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
          />
        </BorderBox>

        <BorderBox>
          <ToggleNew
            textReranker={isFasttext}
            setTextReranker={setIsFasttext}
            onChange={(checked) => {
              console.log("Fasttext Toggle is now:", checked); // Konsola yazdır
              setIsFasttext(checked); // State'i güncelle
            }}
            className="mt-4"
            label="fasttext"
          />

          <ToggleNew
            textReranker={textReranker}
            setTextReranker={setTextReranker}
            onChange={(checked) => {
              console.log("Fasttext Toggle is now:", checked); // Konsola yazdır
              setTextReranker(checked); // State'i güncelle
            }}
            className="mt-4"
            label="textReranker"
          />

          <SearchResult
            textReranker={textReranker}
            searchParam={searchParam.query}
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