import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  LineChart,
  PieChart,
  Bar,
  Line,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { getDefautsDetectesStats } from "../../services/defautsDetectesService";
import { getOrdresFabrication } from "../../services/ordresFabricationService";
import "../styles/controleur/AnalyseQualite.css";

// ── Chart color tokens ───────────────────────────────────────────────────
// These stay in JS because recharts needs real color values for its
// fill/stroke/etc. props, not CSS classes.

const COLORS = {
  grid: "#e2e8f0",
  primary: "#2563eb",
  primaryLight: "#93c5fd",
  danger: "#dc2626",
  warning: "#f59e0b",
};

const PIE_COLORS = [
  "#2563eb",
  "#0ea5e9",
  "#14b8a6",
  "#f59e0b",
  "#f97316",
  "#dc2626",
  "#8b5cf6",
];

const COEFFICIENT_THRESHOLD = 6; // production halt rule: cumulative coeff per OF+TOPO

const EMPTY_STATS = {
  kpis: {
    total_defauts: 0,
    of_concernes: 0,
    coefficient_moyen: 0,
  },
  pareto: [],
  par_type: [],
  par_jour: [],
  par_poste: [],
  topo_hotspots: [],
  seuil_arret: [],
  top_produits: [],
};

// ── Component ────────────────────────────────────────────────────────────

function AnalyseQualite() {
  const [ordres, setOrdres] = useState([]);
  const [ordresLoading, setOrdresLoading] = useState(true);
  const [ordresError, setOrdresError] = useState(null);

  const [stats, setStats] = useState(EMPTY_STATS);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);

  const [selectedOf, setSelectedOf] = useState("");
  const [selectedProduit, setSelectedProduit] = useState("");

  // Lookup table (OF list) — loaded once, used for the two dropdowns and
  // the OF detail strip. Small table, safe to load in full.
  useEffect(() => {
    let cancelled = false;

    getOrdresFabrication()
      .then((data) => {
        if (!cancelled) setOrdres(data || []);
      })
      .catch((err) => {
        if (!cancelled) setOrdresError(err);
      })
      .finally(() => {
        if (!cancelled) setOrdresLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Aggregated stats — refetched from the server every time a filter
  // changes. Payload stays small no matter how large defauts_detectes gets.
  useEffect(() => {
    let cancelled = false;
    setStatsLoading(true);

    getDefautsDetectesStats({
      numeroOf: selectedOf || undefined,
      referenceProduit: selectedProduit || undefined,
    })
      .then((data) => {
        if (!cancelled) {
          setStats(data);
          setStatsError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setStatsError(err);
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedOf, selectedProduit]);

  const ofByNumero = useMemo(() => {
    const map = new Map();
    ordres.forEach((of) => map.set(of.numero_of, of));
    return map;
  }, [ordres]);

  const ofOptions = useMemo(
    () => [...ordres].sort((a, b) => b.numero_of - a.numero_of),
    [ordres]
  );

  const produitOptions = useMemo(() => {
    const set = new Set();
    ordres.forEach(
      (of) =>
        of.reference_produit && set.add(of.reference_produit)
    );
    return [...set].sort();
  }, [ordres]);

  const selectedOfDetails = selectedOf
    ? ofByNumero.get(Number(selectedOf))
    : null;

  const hasActiveFilter = Boolean(selectedOf || selectedProduit);
  const loading = ordresLoading && statsLoading;
  const error = ordresError || statsError;

  const {
    kpis,
    pareto,
    par_type: parType,
    par_jour: parJour,
    par_poste: parPoste,
    topo_hotspots: topoHotspots,
    seuil_arret: seuilArret,
    top_produits: topProduits,
  } = stats;

  if (loading) {
    return (
      <main className="main">
        <h1 className="h1">Analyse des données qualité</h1>
        <p className="sub">Chargement des données…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="main">
        <h1 className="h1">Analyse des données qualité</h1>
        <p className="subError">
          Erreur de chargement des données : {error.message}
        </p>
      </main>
    );
  }

  return (
    <main className="main">
      <h1 className="h1">Analyse des données qualité</h1>

      {/* Filtres */}
      <section className="filterBar">
        <div className="filterField">
          <label className="filterLabel" htmlFor="filter-of">
            Ordre de fabrication
          </label>

          <select
            id="filter-of"
            className="select"
            value={selectedOf}
            onChange={(e) => setSelectedOf(e.target.value)}
          >
            <option value="">Tous les OF</option>

            {ofOptions.map((of) => (
              <option key={of.numero_of} value={of.numero_of}>
                OF {of.numero_of} — {of.reference_produit}
              </option>
            ))}
          </select>
        </div>

        <div className="filterField">
          <label className="filterLabel" htmlFor="filter-produit">
            Produit
          </label>

          <select
            id="filter-produit"
            className="select"
            value={selectedProduit}
            onChange={(e) => setSelectedProduit(e.target.value)}
          >
            <option value="">Tous les produits</option>

            {produitOptions.map((ref) => (
              <option key={ref} value={ref}>
                {ref}
              </option>
            ))}
          </select>
        </div>

        {hasActiveFilter && (
          <button
            type="button"
            className="resetBtn"
            onClick={() => {
              setSelectedOf("");
              setSelectedProduit("");
            }}
          >
            Réinitialiser
          </button>
        )}

        {statsLoading && (
          <span className="refreshHint">Actualisation…</span>
        )}
      </section>

      {selectedOfDetails && (
        <section className="ofDetailCard">
          <span>
            <strong>OF {selectedOfDetails.numero_of}</strong>
          </span>
          <span>
            Référence : {selectedOfDetails.reference_produit}
          </span>
          <span>Quantité : {selectedOfDetails.quantite}</span>
          <span>Site : {selectedOfDetails.site_id}</span>
        </section>
      )}

      {hasActiveFilter && kpis.total_defauts === 0 && (
        <p className="emptyState">
          Aucun défaut enregistré pour ce filtre.
        </p>
      )}

      {/* KPIs */}
      <section className="kpiRow">
        <KpiCard
          label="Total défauts"
          value={kpis.total_defauts}
        />

        <KpiCard
          label="OF concernés"
          value={kpis.of_concernes}
        />

        <KpiCard
          label="Coefficient moyen"
          value={kpis.coefficient_moyen}
        />

        <KpiCard
          label="OF en alerte (seuil ≥ 6)"
          value={
            seuilArret.filter(
              (s) =>
                s.coefficient >= COEFFICIENT_THRESHOLD
            ).length
          }
          tone={
            seuilArret.some(
              (s) =>
                s.coefficient >= COEFFICIENT_THRESHOLD
            )
              ? "danger"
              : "ok"
          }
        />
      </section>

      {/* Pareto */}
      <ChartCard
        title="Pareto des codes défauts"
        subtitle="Fréquence et % cumulé (top 12)"
      >
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart
            data={pareto}
            margin={{
              top: 8,
              right: 24,
              left: 0,
              bottom: 8,
            }}
          >
            <CartesianGrid
              stroke={COLORS.grid}
              vertical={false}
            />

            <XAxis
              dataKey="code"
              tick={{ fontSize: 12 }}
              interval={0}
              angle={-30}
              textAnchor="end"
              height={60}
            />

            <YAxis
              yAxisId="left"
              tick={{ fontSize: 12 }}
              allowDecimals={false}
            />

            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              tick={{ fontSize: 12 }}
              unit="%"
            />

            <Tooltip />
            <Legend />

            <Bar
              yAxisId="left"
              dataKey="count"
              name="Occurrences"
              fill={COLORS.primary}
              radius={[4, 4, 0, 0]}
            />

            <Line
              yAxisId="right"
              type="monotone"
              dataKey="cumul_pct"
              name="% cumulé"
              stroke={COLORS.warning}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid2">
        {/* Répartition par type */}
        <ChartCard title="Répartition par type de défaut">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={parType}
                dataKey="count"
                nameKey="type"
                outerRadius={100}
                label
              >
                {parType.map((_, i) => (
                  <Cell
                    key={i}
                    fill={
                      PIE_COLORS[
                        i % PIE_COLORS.length
                      ]
                    }
                  />
                ))}
              </Pie>

              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Défauts par poste */}
        <ChartCard title="Défauts par poste de détection">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={parPoste}
              layout="vertical"
              margin={{ left: 16 }}
            >
              <CartesianGrid
                stroke={COLORS.grid}
                horizontal={false}
              />

              <XAxis
                type="number"
                tick={{ fontSize: 12 }}
                allowDecimals={false}
              />

              <YAxis
                type="category"
                dataKey="poste"
                width={140}
                tick={{ fontSize: 12 }}
              />

              <Tooltip />

              <Bar
                dataKey="count"
                name="Défauts"
                fill={COLORS.primary}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Évolution dans le temps */}
      <ChartCard
        title="Évolution des défauts dans le temps"
        subtitle="Nombre de défauts par jour"
      >
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={parJour}
            margin={{
              top: 8,
              right: 24,
              left: 0,
              bottom: 8,
            }}
          >
            <CartesianGrid
              stroke={COLORS.grid}
              vertical={false}
            />

            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
            />

            <YAxis
              tick={{ fontSize: 12 }}
              allowDecimals={false}
            />

            <Tooltip />

            <Line
              type="monotone"
              dataKey="count"
              name="Défauts"
              stroke={COLORS.primary}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid2">
        {/* Points chauds TOPO */}
        <ChartCard
          title="Points chauds — repères TOPO"
          subtitle="Top 10 positions les plus touchées"
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topoHotspots}>
              <CartesianGrid
                stroke={COLORS.grid}
                vertical={false}
              />

              <XAxis
                dataKey="repere_topo"
                tick={{ fontSize: 12 }}
              />

              <YAxis
                tick={{ fontSize: 12 }}
                allowDecimals={false}
              />

              <Tooltip />

              <Bar
                dataKey="count"
                name="Défauts"
                fill={COLORS.warning}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Top produits */}
        <ChartCard
          title="Produits les plus impactés"
          subtitle="Top 10 références par nombre de défauts"
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={topProduits}
              layout="vertical"
              margin={{ left: 16 }}
            >
              <CartesianGrid
                stroke={COLORS.grid}
                horizontal={false}
              />

              <XAxis
                type="number"
                tick={{ fontSize: 12 }}
                allowDecimals={false}
              />

              <YAxis
                type="category"
                dataKey="reference_produit"
                width={120}
                tick={{ fontSize: 12 }}
              />

              <Tooltip />

              <Bar
                dataKey="count"
                name="Défauts"
                fill={COLORS.primary}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Suivi du seuil d'arrêt */}
      <ChartCard
        title="Suivi du seuil d'arrêt de production"
        subtitle={`Coefficient cumulé par OF + repère TOPO (seuil = ${COEFFICIENT_THRESHOLD})`}
      >
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={seuilArret}
            margin={{
              top: 8,
              right: 24,
              left: 0,
              bottom: 8,
            }}
          >
            <CartesianGrid
              stroke={COLORS.grid}
              vertical={false}
            />

            <XAxis
              dataKey={(d) =>
                `OF ${d.numero_of} · ${d.repere_topo}`
              }
              tick={{ fontSize: 11 }}
              interval={0}
              angle={-30}
              textAnchor="end"
              height={70}
            />

            <YAxis
              tick={{ fontSize: 12 }}
              allowDecimals={false}
            />

            <Tooltip />

            <ReferenceLine
              y={COEFFICIENT_THRESHOLD}
              stroke={COLORS.danger}
              strokeDasharray="4 4"
              label={{
                value: "Seuil d'arrêt",
                position: "insideTopRight",
                fill: COLORS.danger,
                fontSize: 12,
              }}
            />

            <Bar
              dataKey="coefficient"
              name="Coefficient cumulé"
              radius={[4, 4, 0, 0]}
            >
              {seuilArret.map((s, i) => (
                <Cell
                  key={i}
                  fill={
                    s.coefficient >=
                    COEFFICIENT_THRESHOLD
                      ? COLORS.danger
                      : s.coefficient >=
                          COEFFICIENT_THRESHOLD - 2
                        ? COLORS.warning
                        : COLORS.primaryLight
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </main>
  );
}

// ── Small presentational helpers ────────────────────────────────────────

function KpiCard({ label, value, tone }) {
  const valueClass = [
    "kpiValue",
    tone === "danger" && "kpiValueDanger",
    tone === "ok" && "kpiValueOk",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="kpiCard">
      <div className="kpiLabel">{label}</div>
      <div className={valueClass}>{value}</div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <section className="chartCard">
      <h2 className="chartTitle">{title}</h2>

      {subtitle && (
        <p className="chartSubtitle">{subtitle}</p>
      )}

      {children}
    </section>
  );
}

export default AnalyseQualite;