import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";
import { ASHLAND_BBOX } from "./config/regions";
import { assignNeighborhoodIds } from "./features/neighborhoods/assign-neighborhood";
import {
  computeNeighborhoodRollups,
  MIN_RATED_ADDRESSES_FOR_ROLLUP,
} from "./features/neighborhoods/rollup";
import type {
  AddressRecord,
  LetterGrade,
  ParticipantType,
} from "./features/addresses/types";
import {
  PARTICIPANT_LABELS,
  PARTICIPANT_ORDER,
} from "./features/addresses/types";
import {
  loadAddressesFromStorage,
  mergeGradeAndEngagement,
  saveAddressesToStorage,
} from "./features/addresses/storage";
import {
  addressesToSnapshotCsv,
  computeNeighborhoodCoverage,
  coverageToCsv,
  downloadCsv,
} from "./features/city-metrics";
import {
  gradeToMapColor,
  GRADE_HEX,
  GRADE_ORDER,
} from "./lib/rating-colors";
import { PARTICIPANT_ACCENT_HEX } from "./lib/participant-colors";
import {
  FirePrepMap,
  type FirePrepMapHandle,
} from "./map/FirePrepMap";
import { useDebouncedValue } from "./hooks/useDebouncedValue";

type NbProps = { id: string; name: string };

function filterAddressesForMap(
  list: AddressRecord[],
  participantFilter: ParticipantType | "all",
  queryRaw: string,
): AddressRecord[] {
  const q = queryRaw.trim().toLowerCase();
  return list.filter((a) => {
    if (
      participantFilter !== "all" &&
      a.participantType !== participantFilter
    ) {
      return false;
    }
    if (!q) return true;
    const hay = [a.label, a.street, a.normalizedAddress, a.parcelId, a.id]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

function enrichNeighborhoods(
  raw: FeatureCollection<Polygon | MultiPolygon, NbProps>,
  rollups: ReturnType<typeof computeNeighborhoodRollups>,
): FeatureCollection<Polygon | MultiPolygon, NbProps & { rollupColor: string }> {
  return {
    ...raw,
    features: raw.features.map((f) => {
      const rid = f.properties.id;
      const r = rollups.get(rid);
      const color = gradeToMapColor(r?.grade ?? null);
      return {
        ...f,
        properties: {
          ...f.properties,
          rollupColor: color,
        },
      };
    }),
  };
}

export default function App() {
  const [neighborhoodsBase, setNeighborhoodsBase] = useState<FeatureCollection<
    Polygon | MultiPolygon,
    NbProps
  > | null>(null);
  const [addressesPersisted, setAddressesPersisted] = useState(() =>
    loadAddressesFromStorage(),
  );
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState<
    string | null
  >(null);
  const [participantFilter, setParticipantFilter] = useState<
    ParticipantType | "all"
  >("all");
  const [addressSearch, setAddressSearch] = useState("");
  const debouncedSearch = useDebouncedValue(addressSearch, 220);
  const mapRef = useRef<FirePrepMapHandle>(null);
  const [selectionHiddenByFilter, setSelectionHiddenByFilter] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/neighborhoods-ashland.geojson")
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setNeighborhoodsBase(j);
      })
      .catch(() => {
        if (!cancelled) setNeighborhoodsBase(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const neighborhoodIds = useMemo(
    () => neighborhoodsBase?.features.map((f) => f.properties.id) ?? [],
    [neighborhoodsBase],
  );

  const neighborhoodNameById = useMemo(() => {
    const m = new Map<string, string>();
    neighborhoodsBase?.features.forEach((f) => {
      m.set(f.properties.id, f.properties.name);
    });
    return m;
  }, [neighborhoodsBase]);

  const addressesWithNb = useMemo(() => {
    if (!neighborhoodsBase) return [];
    const base: AddressRecord[] = addressesPersisted.map((a) => ({
      ...a,
      neighborhoodId: null,
    }));
    return assignNeighborhoodIds(base, neighborhoodsBase);
  }, [addressesPersisted, neighborhoodsBase]);

  const rollups = useMemo(
    () => computeNeighborhoodRollups(addressesWithNb, neighborhoodIds),
    [addressesWithNb, neighborhoodIds],
  );

  const neighborhoodsForMap = useMemo(() => {
    if (!neighborhoodsBase) return null;
    return enrichNeighborhoods(neighborhoodsBase, rollups);
  }, [neighborhoodsBase, rollups]);

  const coverageRows = useMemo(
    () =>
      computeNeighborhoodCoverage(
        addressesWithNb,
        neighborhoodNameById,
        rollups,
        neighborhoodIds,
      ),
    [addressesWithNb, neighborhoodNameById, rollups, neighborhoodIds],
  );

  const addressesForMap = useMemo(
    () =>
      filterAddressesForMap(addressesWithNb, participantFilter, addressSearch),
    [addressesWithNb, participantFilter, addressSearch],
  );

  const addressesForFit = useMemo(
    () =>
      filterAddressesForMap(
        addressesWithNb,
        participantFilter,
        debouncedSearch,
      ),
    [addressesWithNb, participantFilter, debouncedSearch],
  );

  useEffect(() => {
    if (!selectedAddressId) return;
    if (!addressesForMap.some((a) => a.id === selectedAddressId)) {
      setSelectedAddressId(null);
      setSelectionHiddenByFilter(true);
    }
  }, [addressesForMap, selectedAddressId]);

  useEffect(() => {
    if (selectedAddressId) setSelectionHiddenByFilter(false);
  }, [selectedAddressId]);

  const addressesForFitRef = useRef(addressesForFit);
  addressesForFitRef.current = addressesForFit;

  useEffect(() => {
    const addrs = addressesForFitRef.current;
    if (!addrs.length) return;
    mapRef.current?.fitToAddresses(addrs);
  }, [participantFilter, debouncedSearch]);

  const persist = useCallback((next: typeof addressesPersisted) => {
    setAddressesPersisted(next);
    saveAddressesToStorage(next);
  }, []);

  const setGrade = useCallback(
    (id: string, grade: LetterGrade | null) => {
      persist(mergeGradeAndEngagement(addressesPersisted, { id, grade }));
    },
    [addressesPersisted, persist],
  );

  const setParticipantType = useCallback(
    (id: string, participantType: ParticipantType) => {
      persist(mergeGradeAndEngagement(addressesPersisted, { id, participantType }));
    },
    [addressesPersisted, persist],
  );

  const bumpEngagement = useCallback(
    (id: string) => {
      const cur = findPersistedAddress(addressesPersisted, id);
      persist(
        mergeGradeAndEngagement(addressesPersisted, {
          id,
          engagementCount: cur.engagementCount + 1,
        }),
      );
    },
    [addressesPersisted, persist],
  );

  const exportCoverage = useCallback(() => {
    downloadCsv(
      "ashland-neighborhood-coverage.csv",
      coverageToCsv(coverageRows),
    );
  }, [coverageRows]);

  const exportSnapshot = useCallback(() => {
    const rows = addressesWithNb.map((a) => ({
      id: a.id,
      parcelId: a.parcelId,
      normalizedAddress: a.normalizedAddress,
      street: a.street,
      neighborhoodName:
        neighborhoodNameById.get(a.neighborhoodId ?? "") ?? "",
      participantType: a.participantType,
      grade: a.grade ?? "",
      engagementCount: a.engagementCount,
    }));
    downloadCsv(
      "ashland-address-snapshot.csv",
      addressesToSnapshotCsv(rows),
    );
  }, [addressesWithNb, neighborhoodNameById]);

  const selectedAddress = addressesWithNb.find((a) => a.id === selectedAddressId);
  const selectedRollup = selectedNeighborhoodId
    ? rollups.get(selectedNeighborhoodId)
    : null;
  const selectedNeighborhoodName =
    neighborhoodsBase?.features.find(
      (f) => f.properties.id === selectedNeighborhoodId,
    )?.properties.name ?? null;

  const cityTotalSites = addressesWithNb.length;
  const cityEngaged = addressesWithNb.filter((a) => a.engagementCount > 0).length;
  const cityGraded = addressesWithNb.filter((a) => a.grade !== null).length;

  return (
    <div className="flex min-h-full flex-col gap-3 p-3 md:flex-row md:gap-4 md:p-4">
      <div className="flex min-h-[50vh] flex-1 flex-col md:min-h-0">
        <header className="mb-2 shrink-0">
          <h1 className="text-lg font-semibold text-[var(--color-text)] md:text-xl">
            Ashland fire preparedness awareness
          </h1>
          <p className="max-w-prose text-sm text-[var(--color-muted)]">
            Demo parcel points in{" "}
            <code className="rounded bg-[var(--color-panel)] px-1 text-xs">
              src/data/addresses-ashland-seed.json
            </code>{" "}
            (replace with county export). Neighborhoods:{" "}
            <code className="rounded bg-[var(--color-panel)] px-1 text-xs">
              public/data/neighborhoods-ashland.geojson
            </code>
            . Zoom to street level for circles and Overture building footprints
            (zoom 15+). Use locate control to center on your position.
          </p>
        </header>
        <div className="min-h-[280px] flex-1">
          {neighborhoodsForMap ? (
            <FirePrepMap
              ref={mapRef}
              neighborhoods={neighborhoodsForMap}
              addresses={addressesForMap}
              selectedId={selectedAddressId}
              onSelectAddress={setSelectedAddressId}
              onSelectNeighborhood={setSelectedNeighborhoodId}
            />
          ) : (
            <div
              className="flex h-full min-h-[280px] items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-muted)]"
              role="status"
            >
              Loading neighborhood boundaries…
            </div>
          )}
        </div>
      </div>

      <aside
        className="flex w-full shrink-0 flex-col gap-3 md:w-80"
        aria-label="Ratings, filters, and city summary"
      >
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
                setSelectionHiddenByFilter(false);
                setAddressSearch(e.target.value);
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
                  setSelectionHiddenByFilter(false);
                  setParticipantFilter("all");
                }}
                label="All"
              />
              {PARTICIPANT_ORDER.map((p) => (
                <FilterChip
                  key={p}
                  active={participantFilter === p}
                  onClick={() => {
                    setSelectionHiddenByFilter(false);
                    setParticipantFilter(p);
                  }}
                  label={PARTICIPANT_LABELS[p]}
                  accent={PARTICIPANT_ACCENT_HEX[p]}
                />
              ))}
            </div>
          </fieldset>
          <p className="mt-2 text-xs text-[var(--color-text)]" aria-live="polite">
            Showing{" "}
            <strong>{addressesForMap.length}</strong> of{" "}
            <strong>{addressesWithNb.length}</strong> sites on the map.
          </p>
          {addressesForMap.length === 0 && addressesWithNb.length > 0 ? (
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
                onClick={exportCoverage}
              >
                Export coverage CSV
              </button>
              <button
                type="button"
                className="rounded border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                onClick={exportSnapshot}
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
          <div className="mt-3 max-h-48 overflow-y-auto border-t border-[var(--color-border)] pt-2">
            <table className="w-full text-left text-[10px] text-[var(--color-muted)]">
              <thead>
                <tr className="text-[var(--color-text)]">
                  <th className="py-1 pr-1 font-medium">Area</th>
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
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-3">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">
            Selection
          </h2>
          {!selectedAddress && !selectedNeighborhoodId && (
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Click an address for grades and participant type. Click a
              neighborhood for rollup and address list.{" "}
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
                    setParticipantType(
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
              <p className="text-xs text-[var(--color-muted)]">
                Engagement (mock / affiliate proxy):{" "}
                {selectedAddress.engagementCount}
              </p>
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
                    onClick={() => setGrade(selectedAddress.id, g)}
                  >
                    {g}
                  </button>
                ))}
                <button
                  type="button"
                  className="min-h-[44px] rounded border border-[var(--color-border)] px-2 text-xs text-[var(--color-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                  onClick={() => setGrade(selectedAddress.id, null)}
                >
                  Clear grade
                </button>
              </div>
              <button
                type="button"
                className="mt-2 rounded border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                onClick={() => bumpEngagement(selectedAddress.id)}
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
                {selectedRollup.ratedCount <
                  MIN_RATED_ADDRESSES_FOR_ROLLUP && (
                  <span className="block text-xs">
                    Need at least {MIN_RATED_ADDRESSES_FOR_ROLLUP} graded
                    addresses in this area (currently {selectedRollup.ratedCount}
                    ).
                  </span>
                )}
              </p>
              <p className="text-xs text-[var(--color-muted)]">
                Rated: {selectedRollup.ratedCount}, Ungraded:{" "}
                {selectedRollup.unratedCount}, Total engagement:{" "}
                {selectedRollup.totalEngagement}
              </p>
              <ul className="mt-2 max-h-40 list-inside list-disc overflow-y-auto text-xs text-[var(--color-muted)]">
                {addressesWithNb
                  .filter((a) => a.neighborhoodId === selectedNeighborhoodId)
                  .map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        className="text-left text-[var(--color-text)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                        onClick={() => {
                          setSelectedNeighborhoodId(null);
                          setSelectedAddressId(a.id);
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

        <p className="text-xs text-[var(--color-muted)]">
          View: [{ASHLAND_BBOX.join(", ")}] — west, south, east, north.
        </p>
      </aside>
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

function findPersistedAddress(
  list: { id: string; engagementCount: number }[],
  id: string,
) {
  const a = list.find((x) => x.id === id);
  if (!a) throw new Error(`Unknown address ${id}`);
  return a;
}

function Legend() {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-3">
      <h2 className="text-sm font-semibold text-[var(--color-text)]">Legend</h2>
      <p className="mt-1 text-xs text-[var(--color-muted)]">
        <strong>Fill</strong> color = preparedness grade; <strong>ring</strong>{" "}
        color = participant type (see below). Neighborhood fill = rollup when
        enough graded sites exist ({MIN_RATED_ADDRESSES_FOR_ROLLUP}+).
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
