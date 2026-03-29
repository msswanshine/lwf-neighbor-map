import type {
  AddressRecord,
  FireAssessmentTool,
  LetterGrade,
  ParticipantType,
} from "../features/addresses/types";
import {
  FIRE_ASSESSMENT_TOOL_ORDER,
  PARTICIPANT_LABELS,
  PARTICIPANT_ORDER,
} from "../features/addresses/types";
import type { NeighborhoodCoverage } from "../features/city-metrics";
import {
  MIN_RATED_ADDRESSES_FOR_ROLLUP,
  type NeighborhoodRollup,
} from "../features/neighborhoods/rollup";
import {
  type MapWashTier,
  MAP_WASH_LEGEND_ROWS,
  MAP_WASH_SWATCH_HEX,
  MAP_WASH_TIER_LABEL,
} from "../lib/map-ab-share-wash";
import { GRADE_HEX, GRADE_ORDER } from "../lib/rating-colors";
import { PARTICIPANT_ACCENT_HEX } from "../lib/participant-colors";

export type CityAbShare = {
  total: number;
  abCount: number;
  pct: number;
  tier: MapWashTier;
};

export type NavigationControlProps = {
  ashlandBbox: readonly [number, number, number, number];
  addressSearch: string;
  onAddressSearchChange: (value: string) => void;
  onClearSelectionHidden: () => void;
  participantFilter: ParticipantType | "all";
  onParticipantFilter: (p: ParticipantType | "all") => void;
  addressesForMapCount: number;
  addressesWithNbCount: number;
  selectionHiddenByFilter: boolean;
  onExportCoverage: () => void;
  onExportSnapshot: () => void;
  cityTotalSites: number;
  cityEngaged: number;
  cityGraded: number;
  cityAbShare: CityAbShare;
  coverageRows: NeighborhoodCoverage[];
  selectedAddress: AddressRecord | undefined;
  selectedNeighborhoodId: string | null;
  selectedRollup: NeighborhoodRollup | undefined;
  selectedNeighborhoodName: string | null;
  onSelectAddressId: (id: string | null) => void;
  onSelectNeighborhoodId: (id: string | null) => void;
  onSetParticipantType: (id: string, t: ParticipantType) => void;
  onSetAssessmentTool: (id: string, tool: FireAssessmentTool) => void;
  onSetGrade: (id: string, grade: LetterGrade | null) => void;
  onBumpEngagement: (id: string) => void;
  addressesWithNb: AddressRecord[];
  showPotentialFireBreakLinks: boolean;
  onShowPotentialFireBreakLinksChange: (show: boolean) => void;
};

export function NavigationControl(props: NavigationControlProps) {
  const {
    ashlandBbox,
    addressSearch,
    onAddressSearchChange,
    onClearSelectionHidden,
    participantFilter,
    onParticipantFilter,
    addressesForMapCount,
    addressesWithNbCount,
    selectionHiddenByFilter,
    onExportCoverage,
    onExportSnapshot,
    cityTotalSites,
    cityEngaged,
    cityGraded,
    cityAbShare,
    coverageRows,
    selectedAddress,
    selectedNeighborhoodId,
    selectedRollup,
    selectedNeighborhoodName,
    onSelectAddressId,
    onSelectNeighborhoodId,
    onSetParticipantType,
    onSetAssessmentTool,
    onSetGrade,
    onBumpEngagement,
    addressesWithNb,
    showPotentialFireBreakLinks,
    onShowPotentialFireBreakLinksChange,
  } = props;

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden overscroll-y-contain pr-0.5 [scrollbar-gutter:stable]">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-3">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">
            Find on map
          </h2>
          <label className="mt-2 block text-xs text-[var(--color-muted)]">
            Search address or parcel id
            <input
              type="search"
              value={addressSearch}
              onChange={(e) => {
                onClearSelectionHidden();
                onAddressSearchChange(e.target.value);
              }}
              className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-sm text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
              placeholder="e.g. Siskiyou or DEMO-R130…"
              autoComplete="off"
            />
          </label>
          <fieldset className="mt-3">
            <legend className="text-xs text-[var(--color-muted)]">
              Show participant type on map
            </legend>
            <div className="mt-1 flex flex-wrap gap-1">
              <FilterChip
                active={participantFilter === "all"}
                onClick={() => {
                  onClearSelectionHidden();
                  onParticipantFilter("all");
                }}
                label="All"
              />
              {PARTICIPANT_ORDER.map((p) => (
                <FilterChip
                  key={p}
                  active={participantFilter === p}
                  onClick={() => {
                    onClearSelectionHidden();
                    onParticipantFilter(p);
                  }}
                  label={PARTICIPANT_LABELS[p]}
                  accent={PARTICIPANT_ACCENT_HEX[p]}
                />
              ))}
            </div>
          </fieldset>
          <p className="mt-2 text-xs text-[var(--color-text)]" aria-live="polite">
            Showing <strong>{addressesForMapCount}</strong> of{" "}
            <strong>{addressesWithNbCount}</strong> sites on the map.
          </p>
          {addressesForMapCount === 0 && addressesWithNbCount > 0 ? (
            <p className="mt-1 text-xs text-amber-200/90" role="status">
              No sites match this filter or search—try “All” or clear the search
              box.
            </p>
          ) : null}
          {selectionHiddenByFilter ? (
            <p className="mt-1 text-xs text-[var(--color-muted)]" role="status">
              Previous selection was hidden by the current filter or search.
            </p>
          ) : null}
        </div>

        <Legend />

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">
              City summary
            </h2>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className="rounded border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                onClick={onExportCoverage}
              >
                Export coverage CSV
              </button>
              <button
                type="button"
                className="rounded border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                onClick={onExportSnapshot}
              >
                Export addresses CSV
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            Engagement count &gt; 0 is used as a simple stand-in for “opted in /
            touched by an affiliate app.” Metrics use <strong>all</strong> seeded
            sites; map dots respect the type filter and search.
          </p>
          <ul className="mt-2 space-y-1 text-xs text-[var(--color-text)]">
            <li>Total sites: {cityTotalSites}</li>
            <li>Engaged (≥1 touch): {cityEngaged}</li>
            <li>Graded: {cityGraded}</li>
          </ul>

          <div className="mt-3 border-t border-[var(--color-border)] pt-2">
            <h3 className="text-xs font-semibold text-[var(--color-text)]">
              A or B share (city and zones)
            </h3>
            <p className="mt-1 text-[10px] text-[var(--color-muted)]">
              City-wide and each evacuation zone use the share of sites graded A
              or B (ungraded counts as not A/B). Zone map colors follow the same
              tier scale below.
            </p>
            <p className="mt-2 text-xs text-[var(--color-text)]" aria-live="polite">
              {cityAbShare.total === 0 ? (
                "No sites loaded."
              ) : (
                <>
                  Current:{" "}
                  <strong>{Math.round(cityAbShare.pct)}%</strong> (
                  {cityAbShare.abCount} of {cityAbShare.total} sites A or B) —{" "}
                  <strong>{MAP_WASH_TIER_LABEL[cityAbShare.tier]}</strong>
                </>
              )}
            </p>
            <ul className="mt-2 grid grid-cols-2 gap-2">
              {MAP_WASH_LEGEND_ROWS.map((row) => {
                const active =
                  row.tier === cityAbShare.tier && cityAbShare.total > 0;
                return (
                  <li
                    key={row.tier}
                    className={`flex items-center gap-2 text-[10px] ${
                      active
                        ? "font-semibold text-[var(--color-text)]"
                        : "text-[var(--color-muted)]"
                    }`}
                  >
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-sm border border-[var(--color-border)]"
                      style={{ backgroundColor: MAP_WASH_SWATCH_HEX[row.tier] }}
                      aria-hidden
                    />
                    <span>
                      {row.rangeLabel}{" "}
                      <span className="opacity-80">
                        ({MAP_WASH_TIER_LABEL[row.tier]})
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-3 border-t border-[var(--color-border)] pt-2">
            <table className="w-full text-left text-[10px] text-[var(--color-muted)]">
              <thead>
                <tr className="text-[var(--color-text)]">
                  <th className="py-1 pr-1 font-medium">Zone</th>
                  <th className="py-1 pr-1 font-medium">Sites</th>
                  <th className="py-1 pr-1 font-medium">Eng.</th>
                  <th className="py-1 font-medium">Grd.</th>
                </tr>
              </thead>
              <tbody>
                {coverageRows.map((r) => (
                  <tr key={r.neighborhoodId}>
                    <td className="py-0.5 pr-1 text-[var(--color-text)]">
                      {r.neighborhoodName}
                    </td>
                    <td className="py-0.5 pr-1">{r.siteCount}</td>
                    <td className="py-0.5 pr-1">
                      {r.engagedCount}{" "}
                      <span className="opacity-70">
                        ({Math.round(r.engagementRate * 100)}%)
                      </span>
                    </td>
                    <td className="py-0.5">
                      {r.gradedCount}{" "}
                      <span className="opacity-70">
                        ({Math.round(r.gradedRate * 100)}%)
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[10px] leading-snug text-[var(--color-muted)]">
              Evacuation zone boundaries:{" "}
              <a
                href="https://ashlandgis.maps.arcgis.com/apps/instant/lookup/index.html?appid=192bced74b664595abd59ab1ea5a7c39"
                className="text-sky-400 underline-offset-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                City of Ashland GIS
              </a>
              . For emergency instructions, follow official alerts—not this demo map.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-3">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">
            Specific Property Details
          </h2>
          {!selectedAddress && !selectedNeighborhoodId && (
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Click a property marker for grades and participant type, or a
              zone polygon for its rollup.{" "}
              <span className="sr-only">Map bounds: Ashland, Oregon.</span>
            </p>
          )}

          {selectedAddress && (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium text-[var(--color-text)]">
                {selectedAddress.label}
              </p>
              {selectedAddress.street && (
                <p className="text-xs text-[var(--color-muted)]">
                  {selectedAddress.street}
                </p>
              )}
              {selectedAddress.parcelId && (
                <p className="text-xs text-[var(--color-muted)]">
                  Parcel (demo): {selectedAddress.parcelId}
                </p>
              )}
              {selectedAddress.normalizedAddress && (
                <p className="text-xs text-[var(--color-muted)]">
                  Normalized: {selectedAddress.normalizedAddress}
                </p>
              )}
              <label className="block text-xs text-[var(--color-muted)]">
                Participant
                <select
                  value={selectedAddress.participantType}
                  onChange={(e) =>
                    onSetParticipantType(
                      selectedAddress.id,
                      e.target.value as ParticipantType,
                    )
                  }
                  className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-sm text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                >
                  {PARTICIPANT_ORDER.map((p) => (
                    <option key={p} value={p}>
                      {PARTICIPANT_LABELS[p]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-[var(--color-muted)]">
                Fire risk assessment tool
                <select
                  value={selectedAddress.assessmentTool}
                  onChange={(e) =>
                    onSetAssessmentTool(
                      selectedAddress.id,
                      e.target.value as FireAssessmentTool,
                    )
                  }
                  className="mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-sm text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                >
                  {FIRE_ASSESSMENT_TOOL_ORDER.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-[var(--color-muted)]">
                Engagement (mock / affiliate proxy):{" "}
                {selectedAddress.engagementCount}
              </p>
              <div>
                <p className="text-xs font-medium text-[var(--color-text)]">
                  Critical errors
                </p>
                {selectedAddress.criticalErrors.length > 0 ? (
                  <ul className="mt-1 list-inside list-disc text-xs text-[var(--color-muted)]">
                    {selectedAddress.criticalErrors.map((item, i) => (
                      <li key={`${i}-${item}`}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    None noted.
                  </p>
                )}
              </div>
              <div
                className="flex flex-wrap gap-1"
                role="group"
                aria-label="Preparedness grade"
              >
                {GRADE_ORDER.map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={`min-h-[44px] min-w-[44px] rounded border px-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${
                      selectedAddress.grade === g
                        ? "border-white text-white"
                        : "border-[var(--color-border)] text-[var(--color-text)]"
                    }`}
                    style={{
                      backgroundColor: GRADE_HEX[g],
                    }}
                    onClick={() => onSetGrade(selectedAddress.id, g)}
                  >
                    {g}
                  </button>
                ))}
                <button
                  type="button"
                  className="min-h-[44px] rounded border border-[var(--color-border)] px-2 text-xs text-[var(--color-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                  onClick={() => onSetGrade(selectedAddress.id, null)}
                >
                  Clear grade
                </button>
              </div>
              <button
                type="button"
                className="mt-2 rounded border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                onClick={() => onBumpEngagement(selectedAddress.id)}
              >
                Simulate affiliate visit (+1 engagement)
              </button>
            </div>
          )}

          {selectedNeighborhoodId && selectedRollup && (
            <div className="mt-3 border-t border-[var(--color-border)] pt-3">
              <p className="text-sm font-medium text-[var(--color-text)]">
                {selectedNeighborhoodName ?? selectedNeighborhoodId}
              </p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                Rollup grade:{" "}
                <span className="font-semibold text-[var(--color-text)]">
                  {selectedRollup.grade ?? "Insufficient data"}
                </span>
                {selectedRollup.ratedCount < MIN_RATED_ADDRESSES_FOR_ROLLUP && (
                  <span className="block text-xs">
                    Need at least {MIN_RATED_ADDRESSES_FOR_ROLLUP} graded
                    addresses in this evacuation zone (currently{" "}
                    {selectedRollup.ratedCount}).
                  </span>
                )}
              </p>
              <p className="text-xs text-[var(--color-muted)]">
                Rated: {selectedRollup.ratedCount}, Ungraded:{" "}
                {selectedRollup.unratedCount}, Total engagement:{" "}
                {selectedRollup.totalEngagement}
              </p>
              <ul className="mt-2 list-inside list-disc text-xs text-[var(--color-muted)]">
                {addressesWithNb
                  .filter((a) => a.neighborhoodId === selectedNeighborhoodId)
                  .map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        className="text-left text-[var(--color-text)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                        onClick={() => {
                          onSelectNeighborhoodId(null);
                          onSelectAddressId(a.id);
                        }}
                      >
                        {a.label} — {PARTICIPANT_LABELS[a.participantType]} —{" "}
                        {a.grade ?? "—"}
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-3">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">
            Explore potential fire breaks.
          </h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Green lines connect A- or B-rated sites that are within about one
            kilometer of each other (straight-line distance), among sites
            currently shown on the map.
          </p>
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-[var(--color-text)]">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-emerald-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
              checked={showPotentialFireBreakLinks}
              onChange={(e) =>
                onShowPotentialFireBreakLinksChange(e.target.checked)
              }
            />
            <span>Show connection lines on map</span>
          </label>
        </div>

        <p className="text-xs text-[var(--color-muted)]">
          View: [{ashlandBbox.join(", ")}] — west, south, east, north.
        </p>
      </div>
    </div>
  );
}

function FilterChip(props: {
  active: boolean;
  label: string;
  onClick: () => void;
  accent?: string;
}) {
  const { active, label, onClick, accent } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[36px] rounded-full border px-2 py-1 text-[10px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 sm:text-xs ${
        active
          ? "border-white bg-white/10 text-[var(--color-text)]"
          : "border-[var(--color-border)] text-[var(--color-muted)]"
      }`}
      style={
        accent && active
          ? { borderColor: accent, boxShadow: `inset 0 0 0 1px ${accent}` }
          : accent && !active
            ? { borderLeftWidth: 3, borderLeftColor: accent }
            : undefined
      }
    >
      {label}
    </button>
  );
}

function Legend() {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-3">
      <h2 className="text-sm font-semibold text-[var(--color-text)]">Legend</h2>
      <p className="mt-1 text-xs text-[var(--color-muted)]">
        <strong>Marker fill</strong> = preparedness grade; <strong>ring</strong>{" "}
        = participant type. Zone polygons show A/B preparedness tier wash (same
        scale as the city summary).
      </p>
      <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {GRADE_ORDER.map((g) => (
          <li key={g} className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-full border border-[var(--color-border)]"
              style={{ backgroundColor: GRADE_HEX[g] }}
              aria-hidden
            />
            <span className="text-[var(--color-text)]">{g}</span>
          </li>
        ))}
        <li className="flex items-center gap-2 text-xs">
          <span
            className="inline-block h-3 w-3 shrink-0 rounded-full border border-[var(--color-border)] bg-[#64748b]"
            aria-hidden
          />
          <span className="text-[var(--color-text)]">Ungraded / N/A</span>
        </li>
      </ul>
      <p className="mb-1 mt-3 text-[10px] font-medium text-[var(--color-text)]">
        Participant accents (filters)
      </p>
      <ul className="grid gap-1 text-[10px] text-[var(--color-muted)]">
        {PARTICIPANT_ORDER.map((p) => (
          <li key={p} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: PARTICIPANT_ACCENT_HEX[p] }}
              aria-hidden
            />
            {PARTICIPANT_LABELS[p]}
          </li>
        ))}
      </ul>
    </div>
  );
}
