import { useState } from "react";
import * as MatchesApi from "@/features/match/api/match.api";
import { CreateMatchRequest } from "@/features/match/model/types";

/**
 * Opening the create-match modal and creating what it returns, for any scope
 * that hosts it.
 *
 * It reloads nothing. Creating a match changes the pool it lands in, the server
 * says so, and the lists that were showing that pool refetch themselves.
 */
export function useCreateMatchAction() {
  const [createMatchOpen, setCreateMatchOpen] = useState(false);

  /* The list this page draws is where the new match appears, so nothing is
     said here; a failure reaches the dialog that asked and stays there. */
  const createMatch = async (request: CreateMatchRequest) => {
    await MatchesApi.create(request);
  };

  return {
    createMatchOpen,
    openCreateMatch: () => setCreateMatchOpen(true),
    closeCreateMatch: () => setCreateMatchOpen(false),
    createMatch,
  };
}
