"use client";

import { useEffect, useId, useRef } from "react";
import { competitions } from "@/lib/history-types";
import { matchPlayer, matchResult, type Match, type Member } from "@/lib/stats";
import { ResultChip, YouBadge, ratingTone } from "./ui";

function value(number: number | null | undefined, digits = 0) {
  return number == null
    ? "-"
    : number.toLocaleString("en-GB", { maximumFractionDigits: digits });
}

function PlayerTable({
  players,
  title,
  selectedId,
}: {
  players: Match["players"];
  title: string;
  selectedId?: string;
}) {
  return (
    <section className="mt-6">
      <h3 className="mb-3 text-lg font-semibold">
        {title}{" "}
        <span className="text-sm font-normal text-muted">
          · {players.length} players reported
        </span>
      </h3>
      <div
        tabIndex={0}
        role="region"
        aria-label={`${title} player stats, scroll horizontally for more columns`}
        className="overflow-x-auto rounded-lg border border-line focus-visible:outline-2 focus-visible:outline-accent"
      >
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr>
              {[
                "Player",
                "Role",
                "Rating",
                "Goals",
                "Assists",
                "Shots",
                "Passes made / attempted",
                "Tackles made / attempted",
                "GK saves",
                "Conceded",
                "Clean sheets",
                "Red cards",
                "MOTM",
                "Seconds played",
              ].map((label) => (
                <th key={label} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr
                key={player.id}
                className={
                  player.id === selectedId
                    ? "bg-accent/10"
                    : "hover:bg-white/[.02]"
                }
              >
                <th
                  scope="row"
                  className="text-left font-medium tracking-normal text-zinc-100 normal-case"
                >
                  {player.name || "Unnamed player"}
                  {player.id === selectedId && <YouBadge />}
                </th>
                <td className="capitalize">
                  {player.role === "unknown" ? "-" : (player.role ?? "-")}
                </td>
                <td className={`font-semibold ${ratingTone(player.rating)}`}>
                  {value(player.rating, 1)}
                </td>
                <td>{value(player.goals)}</td>
                <td>{value(player.assists)}</td>
                <td>{value(player.shots)}</td>
                <td>
                  {value(player.passesMade)} / {value(player.passAttempts)}
                </td>
                <td>
                  {value(player.tacklesMade)} / {value(player.tackleAttempts)}
                </td>
                <td>{value(player.saves)}</td>
                <td>{value(player.goalsConceded)}</td>
                <td>{value(player.cleanSheets)}</td>
                <td>{value(player.redCards)}</td>
                <td>{value(player.motm)}</td>
                <td>{value(player.secondsPlayed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!players.length && (
          <p className="p-5 text-sm text-muted">
            No player data reported for this team.
          </p>
        )}
      </div>
    </section>
  );
}

export function MatchReport({
  match,
  member,
  clubName,
  onClose,
}: {
  match: Match;
  member: Member;
  clubName: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const player = matchPlayer(match, member.name);

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    element?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="card fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-6xl overflow-y-auto p-5 text-zinc-100 shadow-2xl backdrop:bg-black/75 sm:p-7"
    >
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <ResultChip result={matchResult(match)} />
          <div>
            <h2 id={titleId} className="text-2xl font-semibold">
              {clubName}{" "}
              <span className="tabular-nums">
                {value(match.goals)}–{value(match.conceded)}
              </span>{" "}
              {match.opponent}
            </h2>
            <p id={descriptionId} className="mt-1 text-sm text-muted">
              {new Date(match.timestamp).toLocaleString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "UTC",
              })}{" "}
              UTC ·{" "}
              {competitions.find((item) => item.value === match.competition)
                ?.label ?? "Competition unknown"}
              {match.awardedByDnf && " · Won by forfeit"}
              {!player && ` · ${member.name} didn’t play`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="btn-secondary shrink-0"
        >
          Close<span className="sr-only"> match report</span>
        </button>
      </header>
      <PlayerTable
        title={clubName}
        players={match.players}
        selectedId={player?.id}
      />
      <PlayerTable
        title={match.opponent}
        players={match.opponentPlayers ?? []}
      />
      <p className="mt-5 text-xs text-muted">
        — means EA didn’t report the number. Only red cards are available.
      </p>
    </dialog>
  );
}
