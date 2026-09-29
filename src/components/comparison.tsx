"use client";

import { useState } from "react";
import { format, perGame, type Member } from "@/lib/stats";

export function Comparison({
  member,
  members,
}: {
  member: Member;
  members: Member[];
}) {
  const [group, setGroup] = useState("same-role");
  const peers = members.filter(
    (m) =>
      m.name !== member.name &&
      (group === "all" ||
        (group === "same-role" && m.role === member.role) ||
        group === `player:${m.name}`),
  );
  return (
    <section className="panel">
      <div className="flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">Compare with your squad</h2>
          <p className="mt-2 text-sm text-muted">
            Per-match numbers. Same-role comparisons by default.
          </p>
        </div>
        <select
          aria-label="Comparison group"
          value={group}
          onChange={(e) => setGroup(e.target.value)}
        >
          <option value="same-role">Same position</option>
          <option value="all">Whole squad</option>
          {members
            .filter((m) => m.name !== member.name)
            .map((m) => (
              <option key={m.name} value={`player:${m.name}`}>
                {m.proName || m.name}
              </option>
            ))}
        </select>
      </div>
      <div
        className="overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        tabIndex={0}
        role="region"
        aria-label="Squad comparison, scroll horizontally for more stats"
      >
        <table className="w-full">
          <thead>
            <tr>
              <th>Player</th>
              <th>Position</th>
              <th>Matches</th>
              <th>Rating</th>
              <th>Goals / match</th>
              <th>Assists / match</th>
              <th>Pass accuracy</th>
              <th>Tackle success</th>
            </tr>
          </thead>
          <tbody>
            {[member, ...peers].map((m) => (
              <tr
                key={m.name}
                className={m.name === member.name ? "bg-accent/5" : ""}
              >
                <td>
                  <strong className="font-semibold">
                    {m.proName || m.name}
                  </strong>
                  {m.name === member.name && (
                    <span className="ml-2 text-xs font-semibold text-accent">
                      YOU
                    </span>
                  )}
                </td>
                <td className="text-muted capitalize">{m.role}</td>
                <td>
                  {format(m.games, 0)}
                  {(m.games ?? 0) < 10 && (
                    <span className="mt-1 block text-xs text-amber-300">
                      Limited sample
                    </span>
                  )}
                </td>
                <td className="font-semibold">{format(m.rating)}</td>
                <td>{format(perGame(m.goals, m.games), 2)}</td>
                <td>{format(perGame(m.assists, m.games), 2)}</td>
                <td>
                  {format(m.passing)}
                  {m.passing !== null && "%"}
                </td>
                <td>
                  {format(m.tackling)}
                  {m.tackling !== null && "%"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!peers.length && (
        <p className="px-6 py-5 text-muted">
          No other teammates match this selection. Try the whole squad.
        </p>
      )}
      <p className="border-t border-line px-6 py-4 text-sm text-muted">
        Compare similar positions and appearance counts. Missing stats appear as
        —.
      </p>
    </section>
  );
}
