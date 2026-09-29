"use client";

import { useEffect, useId, useRef } from "react";
import { competitions } from "@/lib/history-types";
import { matchPlayer, matchResult, type Match, type Member } from "@/lib/stats";

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
                  {player.id === selectedId && (
                    <span className="ml-2 text-xs text-accent">
                      Selected · provisional
                    </span>
                  )}
                </th>
                <td className="capitalize">
                  {player.role === "unknown" ? "-" : (player.role ?? "-")}
                </td>
                <td>{value(player.rating, 1)}</td>
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
  onClose,
}: {
  match: Match;
  member: Member;
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
      className="panel fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-6xl overflow-y-auto p-5 text-zinc-100 shadow-2xl backdrop:bg-black/75 sm:p-7"
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-accent uppercase">
            Full match report
          </p>
          <h2 id={titleId} className="mt-2 text-2xl font-semibold">
            Our club{" "}
            <span className="tabular-nums">
              {value(match.goals)} – {value(match.conceded)}
            </span>{" "}
            {match.opponent}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {new Date(match.timestamp).toLocaleString("en-GB", {
              timeZone: "UTC",
            })}{" "}
            UTC ·{" "}
            {competitions.find((item) => item.value === match.competition)
              ?.label ?? "Competition unavailable"}{" "}
            · Result {matchResult(match)}
            {match.awardedByDnf && " · Awarded by DNF"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="btn-secondary shrink-0"
        >
          Close<span className="sr-only"> match report</span>
        </button>
      </header>
      <p id={descriptionId} className="mt-5 text-sm leading-relaxed text-muted">
        {player
          ? `${member.name} is provisionally associated by a unique exact gamertag match.`
          : `No unique gamertag association found for ${member.name}.`}{" "}
        This does not verify account ownership or survive renames. A dash (-)
        means unavailable, not zero. Cards shown are red cards; yellow-card data
        is unavailable.
      </p>
      <PlayerTable
        title="Our club"
        players={match.players}
        selectedId={player?.id}
      />
      <PlayerTable
        title={match.opponent}
        players={match.opponentPlayers ?? []}
      />
      <p className="mt-5 text-xs text-muted">
        Match ID: {match.id} · MOTM = player of the match. Positions and
        statistics are as reported for this match.
      </p>
    </dialog>
  );
}
