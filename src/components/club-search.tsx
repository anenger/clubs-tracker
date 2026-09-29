"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, LoaderCircle, Search, Shield, X } from "lucide-react";
import { demo } from "@/lib/demo";
import { request } from "@/lib/client-api";
import type { Club } from "@/lib/stats";

export function ClubSearch({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (club: Club) => void;
}) {
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 500);
    return () => clearTimeout(timer);
  }, [term]);
  const query = useQuery({
    queryKey: ["club-search", debounced],
    queryFn: ({ signal }) =>
      request<Club[]>(`/api/clubs?q=${encodeURIComponent(debounced)}`, signal),
    enabled: debounced.length >= 2,
  });
  return (
    <dialog
      ref={dialog}
      aria-labelledby="search-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl overflow-auto rounded-xl border border-line bg-surface p-6 text-zinc-100 shadow-2xl backdrop:bg-black/75"
    >
      <div className="flex items-center justify-between">
        <h2 id="search-title" className="text-2xl font-bold">
          Find your club
        </h2>
        <button
          onClick={onClose}
          aria-label="Close search"
          className="rounded p-2 hover:bg-raised"
        >
          <X size={22} />
        </button>
      </div>
      <p className="mt-2 text-muted">
        Search your club name, then select yourself from the squad.
      </p>
      <label className="mt-6 flex items-center gap-3 rounded-md border border-line bg-page px-4 focus-within:border-accent">
        <Search size={20} className="text-muted" />
        <input
          autoFocus
          aria-label="Club name"
          placeholder="Enter club name"
          maxLength={60}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          className="min-w-0 flex-1 bg-transparent py-3.5 outline-none"
        />
      </label>
      <p className="mt-3 text-sm text-muted">PS5 · Xbox Series X|S · PC</p>
      <div className="my-5 min-h-24" aria-live="polite">
        {term.trim().length < 2 ? (
          <p className="py-5 text-sm text-muted">
            Enter at least 2 characters.
          </p>
        ) : query.isFetching || term.trim() !== debounced ? (
          <p className="flex items-center gap-2 py-5 text-muted">
            <LoaderCircle size={18} className="animate-spin" />
            Searching EA Clubs…
          </p>
        ) : query.error ? (
          <div className="py-4">
            <p className="text-red-300">{query.error.message}</p>
            <button
              className="btn-secondary mt-4"
              onClick={() => query.refetch()}
            >
              Try again
            </button>
          </div>
        ) : !query.data?.length ? (
          <p className="py-5 text-muted">No clubs found. Try another name.</p>
        ) : (
          query.data.map((club) => (
            <button
              key={club.id}
              onClick={() => onSelect(club)}
              className="flex w-full items-center gap-4 border-b border-line py-4 text-left hover:bg-raised"
            >
              <Shield size={24} className="text-muted" />
              <span className="flex-1">
                <strong className="block">{club.name}</strong>
                <span className="text-sm text-muted">Club #{club.id}</span>
              </span>
              <ArrowRight size={19} />
            </button>
          ))
        )}
      </div>
      <button
        onClick={() => onSelect(demo.club)}
        className="w-full border-t border-line pt-5 text-left text-sm text-accent hover:text-orange-200"
      >
        Use the demo club instead →
      </button>
    </dialog>
  );
}
