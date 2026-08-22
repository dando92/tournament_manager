import { useState } from "react";
import { toast } from "react-toastify";
import * as MatchesApi from "@/features/match/api/match.api";
import { CreateMatchRequest } from "@/features/match/model/types";

/** Opening the create-match modal and creating what it returns, for any scope that hosts it. */
export function useCreateMatchAction(onChanged?: () => Promise<void>) {
  const [createMatchOpen, setCreateMatchOpen] = useState(false);

  const createMatch = async (request: CreateMatchRequest) => {
    await MatchesApi.create(request);
    await onChanged?.();
    toast.success("Match created.");
  };

  return {
    createMatchOpen,
    openCreateMatch: () => setCreateMatchOpen(true),
    closeCreateMatch: () => setCreateMatchOpen(false),
    createMatch,
  };
}
