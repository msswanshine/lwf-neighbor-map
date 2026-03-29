import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";
import { ASHLAND_BBOX } from "./config/regions";
import { assignNeighborhoodIds } from "./features/neighborhoods/assign-neighborhood";
import { tierForNeighborhood } from "./features/neighborhoods/neighborhood-wash-tier";
import { computeNeighborhoodRollups } from "./features/neighborhoods/rollup";
import type {
  AddressRecord,
  FireAssessmentTool,
  LetterGrade,
  ParticipantType,
} from "./features/addresses/types";
import { getBundledSeedAddresses } from "./features/addresses/initial-addresses";
import { mergeGradeAndEngagement } from "./features/addresses/storage";
import {
  addressesToSnapshotCsv,
  computeNeighborhoodCoverage,
  coverageToCsv,
  downloadCsv,
} from "./features/city-metrics";
import { abShareToWashTier } from "./lib/map-ab-share-wash";
import { NavigationControl } from "./components/NavigationControl";
import { FirePrepMap } from "./map/FirePrepMap";
import type { NeighborhoodGeoJson } from "./map/neighborhood-layers";
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

export default function App() {
  const ratingsDrawerId = useId();
  const goalsDialogTitleId = useId();
  const [ratingsDrawerOpen, setRatingsDrawerOpen] = useState(false);
  const [goalsPopupOpen, setGoalsPopupOpen] = useState(false);
  const goalsTriggerRef = useRef<HTMLButtonElement>(null);
  const goalsDialogRef = useRef<HTMLDivElement>(null);
  const goalsCloseRef = useRef<HTMLButtonElement>(null);

  const closeGoalsPopup = useCallback(() => {
    setGoalsPopupOpen(false);
    queueMicrotask(() => goalsTriggerRef.current?.focus());
  }, []);

  const [neighborhoodsBase, setNeighborhoodsBase] = useState<FeatureCollection<
    Polygon | MultiPolygon,
    NbProps
  > | null>(null);
  const [addressesPersisted, setAddressesPersisted] = useState(
    getBundledSeedAddresses,
  );
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState<
    string | null
  >(null);
  const [participantFilter, setParticipantFilter] = useState<
    ParticipantType | "all"
  >("all");
  const [addressSearch, setAddressSearch] = useState("");
  const [selectionHiddenByFilter, setSelectionHiddenByFilter] = useState(false);
  const [showPotentialFireBreakLinks, setShowPotentialFireBreakLinks] =
    useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/evac-zones-ashland.geojson")
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

  const neighborhoodsWithWash = useMemo((): NeighborhoodGeoJson | null => {
    if (!neighborhoodsBase) return null;
    return {
      ...neighborhoodsBase,
      features: neighborhoodsBase.features.map((f) => {
        const washTier = tierForNeighborhood(f.properties.id, addressesWithNb);
        return {
          ...f,
          properties: {
            ...f.properties,
            washTier,
          },
        };
      }),
    };
  }, [neighborhoodsBase, addressesWithNb]);

  /** Bumps when grades or neighborhood assignment change so the map GeoJSON source always refreshes tints. */
  const neighborhoodTintRevision = useMemo(
    () =>
      [...addressesWithNb]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((a) => `${a.id}:${a.grade ?? ""}:${a.neighborhoodId ?? ""}`)
        .join("|"),
    [addressesWithNb],
  );

  const rollups = useMemo(
    () => computeNeighborhoodRollups(addressesWithNb, neighborhoodIds),
    [addressesWithNb, neighborhoodIds],
  );

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

  useEffect(() => {
    if (selectedAddressId || selectedNeighborhoodId) {
      setRatingsDrawerOpen(true);
    }
  }, [selectedAddressId, selectedNeighborhoodId]);

  const persist = useCallback((next: typeof addressesPersisted) => {
    setAddressesPersisted(next);
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

  const setAssessmentTool = useCallback(
    (id: string, assessmentTool: FireAssessmentTool) => {
      persist(mergeGradeAndEngagement(addressesPersisted, { id, assessmentTool }));
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
      "ashland-evac-zone-coverage.csv",
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
      assessmentTool: a.assessmentTool,
    }));
    downloadCsv(
      "ashland-address-snapshot.csv",
      addressesToSnapshotCsv(rows),
    );
  }, [addressesWithNb, neighborhoodNameById]);

  const selectedAddress = addressesWithNb.find((a) => a.id === selectedAddressId);
  const selectedNeighborhoodName =
    neighborhoodsBase?.features.find(
      (f) => f.properties.id === selectedNeighborhoodId,
    )?.properties.name ?? null;

  const cityTotalSites = addressesWithNb.length;
  const cityEngaged = addressesWithNb.filter((a) => a.engagementCount > 0).length;
  const cityGraded = addressesWithNb.filter((a) => a.grade !== null).length;

  const cityAbShare = useMemo(() => {
    const total = addressesWithNb.length;
    const abCount = addressesWithNb.filter(
      (a) => a.grade === "A" || a.grade === "B",
    ).length;
    const pct = total ? (abCount / total) * 100 : 0;
    const tier = abShareToWashTier(pct);
    return { total, abCount, pct, tier };
  }, [addressesWithNb]);

  useEffect(() => {
    if (!goalsPopupOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeGoalsPopup();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goalsPopupOpen, closeGoalsPopup]);

  useEffect(() => {
    if (!goalsPopupOpen) return;
    goalsCloseRef.current?.focus();
  }, [goalsPopupOpen]);

  useEffect(() => {
    if (!goalsPopupOpen) return;
    const node = goalsDialogRef.current;
    if (!node) return;
    const selector =
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusables = [...node.querySelectorAll<HTMLElement>(selector)].filter(
        (el) => !el.hasAttribute("inert"),
      );
      if (focusables.length === 0) return;
      if (focusables.length === 1) {
        e.preventDefault();
        focusables[0].focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    node.addEventListener("keydown", onKeyDown);
    return () => node.removeEventListener("keydown", onKeyDown);
  }, [goalsPopupOpen]);

  return (
    <div className="relative flex min-h-full flex-col gap-3 p-3 md:h-[calc(100dvh-2rem)] md:min-h-0 md:flex-row md:gap-4 md:overflow-hidden md:p-4">
      <div className="flex min-h-[50vh] min-w-0 flex-1 flex-col overflow-y-auto md:min-h-0 md:overflow-hidden">
        <header className="mb-1 shrink-0 md:mb-2">
          <h1 className="text-lg font-semibold text-[var(--color-text)] md:text-xl">
            Ashland fireWise Engagement Map
          </h1>
          <p className="max-w-prose text-sm text-[var(--color-muted)]">
            Map showing all addresses who have opted in to the fireWise program
            engagement map, with grades of fireWise preparedness and participant
            type.
          </p>
        </header>
        <div className="flex min-h-[50vh] flex-1 flex-col md:min-h-0">
          {neighborhoodsWithWash ? (
            <FirePrepMap
              addresses={addressesForMap}
              neighborhoods={neighborhoodsWithWash}
              neighborhoodTintRevision={neighborhoodTintRevision}
              selectedNeighborhoodId={selectedNeighborhoodId}
              selectedId={selectedAddressId}
              onSelectAddress={setSelectedAddressId}
              onSelectNeighborhood={setSelectedNeighborhoodId}
              showPotentialFireBreakLinks={showPotentialFireBreakLinks}
            />
          ) : (
            <div
              className="flex h-full min-h-[50vh] items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-muted)] md:min-h-0"
              role="status"
            >
              Loading evacuation zone boundaries…
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        className={`fixed right-4 top-[calc(20dvh+40px)] z-50 min-h-[44px] min-w-[44px] rounded-l-md border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm font-medium text-[var(--color-text)] shadow-lg transition-[right] duration-300 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 motion-reduce:transition-none ${
          ratingsDrawerOpen
            ? "md:right-[calc(1rem+20rem)]"
            : "md:right-4"
        }`}
        aria-expanded={ratingsDrawerOpen}
        aria-controls={ratingsDrawerId}
        aria-label={
          ratingsDrawerOpen
            ? "Hide ratings and filters panel"
            : "Show ratings and filters panel"
        }
        onClick={() => setRatingsDrawerOpen((o) => !o)}
      >
        {ratingsDrawerOpen ? "Hide" : "Panel"}
      </button>

      <aside
        id={ratingsDrawerId}
        className={`fixed bottom-0 right-0 top-0 z-40 flex w-full max-w-80 flex-col bg-[var(--color-surface)] shadow-2xl transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none md:bottom-4 md:right-4 md:top-4 md:h-[calc(100dvh-2rem)] md:max-h-[calc(100dvh-2rem)] md:rounded-l-lg md:border md:border-[var(--color-border)] ${
          ratingsDrawerOpen
            ? "translate-x-0 opacity-100"
            : "pointer-events-none translate-x-full opacity-0"
        } `}
        aria-hidden={!ratingsDrawerOpen}
        aria-label="Ratings, filters, and city summary"
        inert={!ratingsDrawerOpen}
      >
        <div className="min-h-0 flex-1 overflow-hidden p-3 pt-4 md:p-2 md:pt-3">
          <NavigationControl
            ashlandBbox={ASHLAND_BBOX}
            addressSearch={addressSearch}
            onAddressSearchChange={setAddressSearch}
            onClearSelectionHidden={() => setSelectionHiddenByFilter(false)}
            participantFilter={participantFilter}
            onParticipantFilter={setParticipantFilter}
            addressesForMapCount={addressesForMap.length}
            addressesWithNbCount={addressesWithNb.length}
            selectionHiddenByFilter={selectionHiddenByFilter}
            onExportCoverage={exportCoverage}
            onExportSnapshot={exportSnapshot}
            cityTotalSites={cityTotalSites}
            cityEngaged={cityEngaged}
            cityGraded={cityGraded}
            cityAbShare={cityAbShare}
            coverageRows={coverageRows}
            selectedAddress={selectedAddress}
            selectedNeighborhoodId={selectedNeighborhoodId}
            selectedRollup={
              selectedNeighborhoodId
                ? rollups.get(selectedNeighborhoodId)
                : undefined
            }
            selectedNeighborhoodName={selectedNeighborhoodName}
            onSelectAddressId={setSelectedAddressId}
            onSelectNeighborhoodId={setSelectedNeighborhoodId}
            onSetParticipantType={setParticipantType}
            onSetAssessmentTool={setAssessmentTool}
            onSetGrade={setGrade}
            onBumpEngagement={bumpEngagement}
            addressesWithNb={addressesWithNb}
            showPotentialFireBreakLinks={showPotentialFireBreakLinks}
            onShowPotentialFireBreakLinksChange={setShowPotentialFireBreakLinks}
          />
        </div>
      </aside>

      <button
        ref={goalsTriggerRef}
        type="button"
        className={`fixed bottom-4 left-4 z-[45] min-h-[44px] rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm font-medium text-[var(--color-text)] shadow-lg transition-opacity duration-300 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 motion-reduce:transition-none motion-reduce:duration-0 ${
          goalsPopupOpen ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
        aria-expanded={goalsPopupOpen}
        aria-haspopup="dialog"
        onClick={() => setGoalsPopupOpen(true)}
      >
        Goals & features
      </button>

      <div
        role="presentation"
        className={`fixed inset-0 z-[43] bg-black/45 transition-opacity duration-300 ease-out motion-reduce:transition-none motion-reduce:duration-0 ${
          goalsPopupOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!goalsPopupOpen}
        onClick={closeGoalsPopup}
      />

      <div
        ref={goalsDialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={goalsDialogTitleId}
        aria-hidden={!goalsPopupOpen}
        className={`fixed bottom-16 left-4 z-[44] max-h-[min(72vh,32rem)] w-[min(calc(100vw-2rem),28rem)] overflow-y-auto overscroll-y-contain rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none motion-reduce:duration-0 ${
          goalsPopupOpen
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-2 opacity-0"
        } `}
        inert={!goalsPopupOpen}
      >
        <div className="flex items-start justify-between gap-3 p-4 pb-2">
          <h2
            id={goalsDialogTitleId}
            className="text-base font-semibold leading-snug text-[var(--color-text)]"
          >
            Goals & features
          </h2>
          <button
            ref={goalsCloseRef}
            type="button"
            className="shrink-0 rounded border border-[var(--color-border)] px-2 py-2 text-xs font-medium text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
            aria-label="Close goals and features"
            onClick={closeGoalsPopup}
          >
            Close
          </button>
        </div>
        <div className="px-4 pb-4 pt-0 text-sm text-[var(--color-muted)]">
          <strong className="text-[var(--color-text)]">Goals:</strong>
          <ul className="mt-1 list-inside list-disc">
            <li>
              Easily identify addresses who have opted in to the fireWise program
              and their preparedness grade
            </li>
            <li>Identify areas of least preparedness to maximize outreach</li>
            <li>
              Enable evacuation zones to help build urban firebreak areas by working
              together clumping A rated properties
            </li>
            <li>
              Help Ashland become a model for urban fire preparedness by being a city
              wide fire break by design.
            </li>
          </ul>
          <strong className="mt-3 block text-[var(--color-text)]">Features:</strong>
          <ul className="mt-1 list-inside list-disc">
            <li>Map showing all addresses who have opted in to the fireWise program</li>
            <li>Grades of fireWise preparedness</li>
            <li>Participant type</li>
            <li>Evacuation zone rollups</li>
            <li>
              Enable evacuation zones to help build urban firebreak areas by lining up
              A rated properties
            </li>
          </ul>
        </div>
      </div>
    </div>
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
