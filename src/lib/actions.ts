"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { UpstashMessage } from "@upstash/rag-chat";
import {
  Info,
  ModelOption,
  Result,
  ResultCode,
  WikiMetadata,
} from "@/lib/types";
import { MessageMetadata } from "./message-meta";
import {
  FusionAlgorithm,
  type Index,
  QueryResult,
  WeightingStrategy,
  QueryMode,
} from "@upstash/vector";
import { bgeIndex } from "./dbs";
import { bgeRagChat } from "./rag-chat";
import { MODEL_CONFIGS } from "./constants";

export async function serverGetMessages() {
  const sessionId = cookies().get("sessionId")?.value;

  if (!sessionId) throw new Error("No sessionId found");

  const messages = (await bgeRagChat.history.getMessages({
    sessionId: sessionId,
    amount: 10,
  })) as UpstashMessage<MessageMetadata>[];

  return messages;
}

export async function serverClearMessages() {
  const sessionId = cookies().get("sessionId")?.value;

  if (!sessionId) throw new Error("No sessionId found");

  await bgeRagChat.history.deleteMessages({ sessionId });
}

const capitalizeWord = (word: string) => {
  return word.charAt(0).toUpperCase() + word.slice(1);
};


async function customHybridSearch(query: string, index: Index) {
  // Base configurations
  const baseConfig = {
    includeData: true,
    includeVectors: false,
    includeMetadata: true,
    fusionAlgorithm: FusionAlgorithm.DBSF,
    weightingStrategy: WeightingStrategy.IDF,
  };

  // Get query analysis from API
  const analysisResponse = await fetch("http://localhost:8000/analyze-query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: query }),
  });
  const analysis = await analysisResponse.json();

  console.log(analysis);

  // Calculate weights based on word count and analysis
  const words = query.split(/\s+/).filter(word => word.length > 0);
  const wordCount = words.length;

  // Initialize base weights based on word count
  let keywordWeight = 0.5;
  let denseWeight = 0.5;

  // 1. Base weights by word count
  if (wordCount === 1) {
    keywordWeight = 1.0;
    denseWeight = 0.0;
  } else if (wordCount === 2) {
    keywordWeight = 0.75;
    denseWeight = 0.25;
  }else{
  // 2. Adjust weights based on stop words ratio
  const stopWords = Object.entries(analysis.word_categories)
  .filter(([_, category]) => category === 'stopword')
  .length;
  const stopWordsRatio = stopWords / wordCount;

  // Increase semantic weight if more stop words (question-like queries)
  const stopWordModifier = stopWordsRatio * 0.3;
  denseWeight = Math.min(0.9, denseWeight + stopWordModifier);

  // 3. Adjust weights based on special characters/numbers
  const specialWords = Object.entries(analysis.word_categories)
    .filter(([_, category]) => category === 'special')
    .length;
  const specialRatio = specialWords / wordCount;

  // Increase keyword weight for queries with special terms
  const specialModifier = specialRatio * 0.3;
  keywordWeight = Math.min(0.9, keywordWeight + specialModifier);

  // Normalize weights to ensure they sum to 1.0
  const total = keywordWeight + denseWeight;
  keywordWeight = keywordWeight / total;
  denseWeight = denseWeight / total;

  // Create expanded query with similar words
  if (analysis.similar_words && Object.keys(analysis.similar_words).length > 0) {
    const similarTerms = Object.entries(analysis.similar_words)
      .map(([word, similars]) => {
        // Take top 2 similar words for each term
        const topSimilars = (similars as string[]).slice(0, 2);
        return topSimilars.join(' ');
      })
      .join(' ');
      query = `${query} ${similarTerms}`;
  }

  }

  const keywordQuery = words
    .filter(word => {
      const category = analysis.word_categories[word.toLowerCase()];
      return category !== 'stopword';
    })
    .join(' ');


  console.log({keywordQuery});
  console.log({query});

  // Execute queries with calculated weights and expanded query
  const sparseResult = await index.query<WikiMetadata>({
    ...baseConfig,
    data: keywordQuery, // Use expanded query for keyword search
    topK: 20,
    queryMode: QueryMode.SPARSE,
  }, { namespace: "en" });

  const denseResult = await index.query<WikiMetadata>({
    ...baseConfig,
    data: query, // Use original query for semantic search
    topK: 20,
    queryMode: QueryMode.DENSE,
  }, { namespace: "en" });

  console.log({keywordWeight});
  console.log({denseWeight});
  
  console.log("-------------------------------------------------------------------------")
  
  

  // Create a map to store combined results by ID
  const resultsMap = new Map<string, QueryResult<WikiMetadata>>();


  // Process sparse results
  const sparseScores = sparseResult.map(r => r.score);
  const maxSparseScore = Math.max(...sparseScores);
  const minSparseScore = Math.min(...sparseScores);

  sparseResult.forEach(result => {
    if (!result.metadata?.id) return;
    
    // Normalize sparse score to 0-1 range
    const normalizedScore = maxSparseScore === minSparseScore 
      ? 1 
      : (result.score - minSparseScore) / (maxSparseScore - minSparseScore);

    
    resultsMap.set(result.metadata.id, {
      ...result,
      score: normalizedScore * keywordWeight
    });
  });


  // Process and combine dense results
  denseResult.forEach(result => {
    if (!result.metadata?.id) return;
    const existing = resultsMap.get(result.metadata.id);

    
    

    if (existing) {
      // Combine scores if result already exists
      resultsMap.set(result.metadata.id, {
        ...existing,
        score: existing.score + (result.score * denseWeight)
      });
    } else {
      // Add new result if not exists
      resultsMap.set(result.metadata.id, {
        ...result,
        score: result.score * denseWeight
      });
    }
  });

  console.log("------------------------------------ ")

  // Convert map back to array
  let combinedResults = Array.from(resultsMap.values());

  // Handle exact title matches for 1-2 word queries
  if (wordCount <= 2) {
    const queryLower = query.toLowerCase();
    combinedResults = combinedResults.map(result => {
      if (result.metadata?.title?.toLowerCase() === queryLower.toLowerCase()) {
        return { ...result, score: 1000.0 };
      }
      return result;
    });
  }

  // Sort by weighted scores
  return combinedResults.sort((a, b) => b.score - a.score);
}

export async function queryIndex({
  query,
  modelOption,
}: {
  query: string;
  modelOption: ModelOption;
}): Promise<Result> {
  try {
    query = capitalizeWord(query);
    const parsedCredentials = z
      .object({
        query: z.string().min(2),
      })
      .required()
      .safeParse({
        query,
      });

    if (parsedCredentials.error) {
      return {
        code: ResultCode.MinLengthError,
        data: [],
      };
    }

    const { index, queryMode } = MODEL_CONFIGS[modelOption];
    let result;
    const t0 = performance.now();

    if (modelOption === "Custom bge-m3" || modelOption === "Custom mxbai") {
      result = await customHybridSearch(query, index);
    }  else {
      const q = {
        data: query,
        topK: 20,
        includeData: true,
        includeVectors: false,
        includeMetadata: true,
        queryMode,
        fusionAlgorithm: FusionAlgorithm.DBSF,
        weightingStrategy: WeightingStrategy.IDF,
      };
      result = await index.query<WikiMetadata>(q, { namespace: "en" });
    }

    const t1 = performance.now();
    const ms = t1 - t0;

    return {
      code: ResultCode.Success,
      data: removeDuplicates(result),
      ms,
    };
  } catch (error) {
    console.error("Error querying:", error);
    return {
      code: ResultCode.UnknownError,
      data: [],
    };
  }
}

function removeDuplicates(results: QueryResult<WikiMetadata>[]) {
  const map = new Map<string, QueryResult<WikiMetadata>[]>();
  
  for (const result of results) {
    if (!result.metadata?.url) continue;
    
    const url = result.metadata.url;
    const existing = map.get(url) || [];
    
    // Only keep up to 2 results per URL
    if (existing.length < 2) {
      map.set(url, [...existing, result]);
    }
  }

  // Flatten the array of arrays and sort by score
  return Array.from(map.values())
    .flat()
    .sort((a, b) => b.score - a.score);
}

export async function serverGetInfo(): Promise<Info | undefined> {
  try {
    const data = await bgeIndex.info();
    return data;
  } catch (error) {
    console.error("Error querying Upstash:", error);
    return undefined;
  }
}
