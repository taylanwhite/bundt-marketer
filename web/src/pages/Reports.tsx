import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import {
  Insights as InsightsIcon,
  People as PeopleIcon,
  Forum as VisitsIcon,
  Cake as CakeIcon,
  Event as EventIcon,
  Explore as ExploreIcon,
} from '@mui/icons-material';
import { api } from '../api/client';
import { usePermissions } from '../contexts/PermissionContext';
import { useDonation } from '../contexts/DonationContext';
import { useOffline } from '../contexts/OfflineContext';
import { useCampaign } from '../contexts/CampaignContext';
import { PullToRefreshIndicator } from '../components/PullToRefreshIndicator';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { ChartCard, ChartEmpty, ChartTooltip } from '../components/reports/ChartCard';
import {
  ReportDrilldownDrawer,
  type DrilldownState,
} from '../components/reports/ReportDrilldownDrawer';
import {
  getQuarterProgress,
  getProgressColor,
  getCurrentQuarterLabel,
} from '../utils/donationCalculations';
import {
  type DateRangeKey,
  type NamedCount,
  type ProductMixRow,
  contactsByStatus,
  eventsByStatus,
  eventsByType,
  filterEventsByRange,
  filterOpportunitiesByRange,
  filterReachoutsByRange,
  flattenReachouts,
  getDateRange,
  mouthsByPeriod,
  normalizeContact,
  normalizeEvent,
  opportunitiesByStatus,
  productMix,
  reachoutsByType,
  rowsForPeriod,
  rowsForProduct,
  toDate,
  topBusinesses,
} from '../utils/reportAggregations';
import { Business, CalendarEvent, Contact, Opportunity } from '../types';

const EditContactModal = lazy(() =>
  import('../components/EditContactModal').then((m) => ({ default: m.EditContactModal })),
);

const RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: 'quarter', label: 'This quarter' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'year', label: 'This year' },
  { key: 'all', label: 'All time' },
];

const AXIS_TICK = { fill: '#5a5a5a', fontSize: 11 };
const GRID_STROKE = 'rgba(0,0,0,0.06)';

function isoDate(value: Date | string | null | undefined): string {
  const d = toDate(value);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function Reports() {
  const navigate = useNavigate();
  const { permissions } = usePermissions();
  const { dataVersion } = useDonation();
  const { syncedCount } = useOffline();
  const { products, storeGoal } = useCampaign();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [loading, setLoading] = useState(true);
  const [rangeKey, setRangeKey] = useState<DateRangeKey>('quarter');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [businesses, setBusinesses] = useState<Map<string, string>>(new Map());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [drilldown, setDrilldown] = useState<DrilldownState | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  const pullState = usePullToRefresh({
    onRefresh: () => loadData(),
    enabled: isMobile,
  });

  useEffect(() => {
    loadData();
    // syncedCount refreshes after offline writes land; dataVersion after in-app saves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissions.currentStoreId, dataVersion, syncedCount]);

  const loadData = async () => {
    try {
      if (!permissions.currentStoreId) {
        setContacts([]);
        setBusinesses(new Map());
        setEvents([]);
        setOpportunities([]);
        return;
      }

      const storeId = permissions.currentStoreId;
      const [businessList, contactsList, eventsList, newOpps, convertedOpps, dismissedOpps] =
        await Promise.all([
          api.get<Business[]>(`/businesses?storeId=${storeId}`),
          api.get<Contact[]>(`/contacts?storeId=${storeId}`),
          api.get<CalendarEvent[]>(`/calendar-events?storeId=${storeId}`),
          api.get<Opportunity[]>(`/opportunities?storeId=${storeId}&status=new`),
          api.get<Opportunity[]>(`/opportunities?storeId=${storeId}&status=converted`),
          api.get<Opportunity[]>(`/opportunities?storeId=${storeId}&status=dismissed`),
        ]);

      const businessMap = new Map<string, string>();
      businessList.forEach((b) => businessMap.set(b.id, b.name));
      setBusinesses(businessMap);
      setContacts(contactsList.map(normalizeContact));
      setEvents(eventsList.map(normalizeEvent));
      setOpportunities(
        [...newOpps, ...convertedOpps, ...dismissedOpps].map((opp) => ({
          ...opp,
          createdAt: toDate(opp.createdAt) ?? opp.createdAt,
        })),
      );
    } catch (error) {
      console.error('Error loading reports:', error);
      setContacts([]);
      setBusinesses(new Map());
      setEvents([]);
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  };

  const range = useMemo(() => getDateRange(rangeKey), [rangeKey]);
  const allReachouts = useMemo(
    () => flattenReachouts(contacts, businesses, products),
    [contacts, businesses, products],
  );
  const rangedReachouts = useMemo(
    () => filterReachoutsByRange(allReachouts, range),
    [allReachouts, range],
  );
  const donationReachouts = useMemo(
    () => rangedReachouts.filter((row) => row.mouths > 0),
    [rangedReachouts],
  );
  const rangedEvents = useMemo(() => filterEventsByRange(events, range), [events, range]);
  const rangedOpps = useMemo(
    () => filterOpportunitiesByRange(opportunities, range),
    [opportunities, range],
  );
  const openOpps = useMemo(
    () => opportunities.filter((opp) => opp.status === 'new'),
    [opportunities],
  );

  const periodData = useMemo(
    () => mouthsByPeriod(rangedReachouts, range, rangeKey),
    [rangedReachouts, range, rangeKey],
  );
  const statusData = useMemo(() => contactsByStatus(contacts), [contacts]);
  const visitTypeData = useMemo(() => reachoutsByType(rangedReachouts), [rangedReachouts]);
  const eventTypeData = useMemo(() => eventsByType(rangedEvents), [rangedEvents]);
  const eventStatusData = useMemo(() => eventsByStatus(rangedEvents), [rangedEvents]);
  const mixData = useMemo(() => productMix(donationReachouts, products), [donationReachouts, products]);
  const businessData = useMemo(() => topBusinesses(donationReachouts), [donationReachouts]);
  const oppStatusData = useMemo(() => opportunitiesByStatus(rangedOpps), [rangedOpps]);

  const quarterProgress = useMemo(
    () => getQuarterProgress(contacts, new Date(), products, storeGoal),
    [contacts, products, storeGoal],
  );
  const progressColor = getProgressColor(Math.min(quarterProgress.percentage, 100));
  const progressColorMap = { success: '#f5c842', warning: '#e8b923', error: '#f44336' };

  const totalMouths = donationReachouts.reduce((sum, row) => sum + row.mouths, 0);
  const chartHeight = isMobile ? 240 : 280;

  const openDrilldown = (next: DrilldownState) => setDrilldown(next);

  const handleOpenContact = (contact: Contact) => setEditingContact(contact);
  const handleOpenEvent = (event: CalendarEvent) => {
    const date = isoDate(event.date);
    navigate(date ? `/calendar?date=${date}` : '/calendar');
  };
  const handleOpenOpportunity = () => navigate('/opportunities');

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PullToRefreshIndicator
        pullDistance={pullState.pullDistance}
        refreshing={pullState.refreshing}
        willTrigger={pullState.willTrigger}
      />

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'flex-end' },
          justifyContent: 'space-between',
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            <InsightsIcon sx={{ color: '#d4a017' }} />
            Reports
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Click any chart to see the contacts, visits, or events behind it.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          {RANGE_OPTIONS.map((option) => (
            <Chip
              key={option.key}
              label={option.label}
              onClick={() => setRangeKey(option.key)}
              sx={{
                fontWeight: rangeKey === option.key ? 700 : 500,
                bgcolor: rangeKey === option.key ? 'rgba(245, 200, 66, 0.28)' : 'transparent',
                border: '1px solid',
                borderColor: rangeKey === option.key ? 'rgba(245, 200, 66, 0.7)' : 'rgba(0,0,0,0.12)',
              }}
            />
          ))}
        </Box>
      </Box>

      <Card
        sx={{
          mb: 3,
          bgcolor: 'rgba(245, 200, 66, 0.14)',
          border: '1px solid rgba(245, 200, 66, 0.45)',
        }}
      >
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.6 }}>
                {getCurrentQuarterLabel()} goal
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {quarterProgress.totalMouths.toLocaleString()}
                <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  / {quarterProgress.goal.toLocaleString()} mouths
                </Typography>
              </Typography>
            </Box>
            <Chip
              label={`${quarterProgress.percentage.toFixed(1)}%`}
              sx={{ bgcolor: progressColorMap[progressColor], fontWeight: 700 }}
            />
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <KpiCard
          icon={<PeopleIcon />}
          label="Contacts"
          value={contacts.length}
          hint="Everyone in this store"
          onClick={() =>
            openDrilldown({
              title: 'All contacts',
              subtitle: 'Current store roster',
              kind: 'contacts',
              contacts,
            })
          }
        />
        <KpiCard
          icon={<VisitsIcon />}
          label="Visits"
          value={rangedReachouts.length}
          hint={range.label}
          onClick={() =>
            openDrilldown({
              title: 'Visits',
              subtitle: range.label,
              kind: 'reachouts',
              reachouts: rangedReachouts,
            })
          }
        />
        <KpiCard
          icon={<CakeIcon />}
          label="Mouths"
          value={totalMouths}
          hint={`${donationReachouts.length} donations · ${range.label}`}
          onClick={() =>
            openDrilldown({
              title: 'Donations',
              subtitle: range.label,
              kind: 'reachouts',
              reachouts: donationReachouts,
            })
          }
        />
        <KpiCard
          icon={<EventIcon />}
          label="Events"
          value={rangedEvents.length}
          hint={range.label}
          onClick={() =>
            openDrilldown({
              title: 'Events',
              subtitle: range.label,
              kind: 'events',
              events: rangedEvents,
            })
          }
        />
        <KpiCard
          icon={<ExploreIcon />}
          label="Open pipeline"
          value={openOpps.length}
          hint="Opportunities still open"
          onClick={() =>
            openDrilldown({
              title: 'Open opportunities',
              kind: 'opportunities',
              opportunities: openOpps,
            })
          }
        />
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <ChartCard
            title="Mouths over time"
            subtitle={`${range.label} · click a point to see those donations`}
            height={chartHeight}
            onViewAll={() =>
              openDrilldown({
                title: 'Donations over time',
                subtitle: range.label,
                kind: 'reachouts',
                reachouts: donationReachouts,
              })
            }
          >
            {periodData.some((b) => b.mouths > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={periodData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  onClick={(state) => {
                    const index = typeof state.activeIndex === 'number'
                      ? state.activeIndex
                      : Number(state.activeIndex);
                    const bucket = Number.isFinite(index)
                      ? periodData[index]
                      : periodData.find((item) => item.label === state.activeLabel);
                    if (!bucket) return;
                    openDrilldown({
                      title: `Donations · ${bucket.label}`,
                      subtitle: range.label,
                      kind: 'reachouts',
                      reachouts: rowsForPeriod(donationReachouts, bucket),
                    });
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <defs>
                    <linearGradient id="mouthsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f5c842" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#f5c842" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                  <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} />
                  <Tooltip
                    content={({ active, payload, label }) => (
                      <ChartTooltip
                        active={active}
                        label={String(label ?? '')}
                        rows={[
                          { name: 'Mouths', value: Number(payload?.[0]?.value || 0), color: '#d4a017' },
                          { name: 'Donations', value: Number(payload?.[0]?.payload?.count || 0), color: '#f5c842' },
                        ]}
                      />
                    )}
                  />
                  <Area
                    type="monotone"
                    dataKey="mouths"
                    stroke="#d4a017"
                    strokeWidth={2.5}
                    fill="url(#mouthsFill)"
                    name="Mouths"
                    activeDot={{ r: 6, fill: '#d4a017', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty message="No donations in this range yet." />
            )}
          </ChartCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <ChartCard
            title="Product mix"
            subtitle="Tap a bar to see those donations"
            height={chartHeight}
            onViewAll={() =>
              openDrilldown({
                title: 'All donations',
                subtitle: range.label,
                kind: 'reachouts',
                reachouts: donationReachouts,
              })
            }
          >
            {mixData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={mixData}
                  layout="vertical"
                  margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
                >
                  <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
                  <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={isMobile ? 88 : 110}
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => (
                      <ChartTooltip
                        active={active}
                        label={String(payload?.[0]?.payload?.name ?? '')}
                        rows={[
                          { name: 'Quantity', value: Number(payload?.[0]?.payload?.quantity || 0), color: '#f5c842' },
                          { name: 'Mouths', value: Number(payload?.[0]?.payload?.mouths || 0), color: '#d4a017' },
                        ]}
                      />
                    )}
                  />
                  <Bar
                    dataKey="mouths"
                    fill="#f5c842"
                    radius={[0, 8, 8, 0]}
                    style={{ cursor: 'pointer' }}
                    onClick={(item) => {
                      const product = item?.payload as ProductMixRow | undefined;
                      if (!product) return;
                      openDrilldown({
                        title: product.name,
                        subtitle: `${product.quantity.toLocaleString()} donated · ${range.label}`,
                        kind: 'reachouts',
                        reachouts: rowsForProduct(donationReachouts, product),
                      });
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty message="No donated products in this range." />
            )}
          </ChartCard>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <NamedBarChart
            title="Contact status"
            subtitle="Current roster · click a status"
            height={chartHeight}
            data={statusData}
            empty="No contacts yet."
            onViewAll={() =>
              openDrilldown({ title: 'All contacts', kind: 'contacts', contacts })
            }
            onSelect={(slice) =>
              openDrilldown({
                title: `${slice.label} contacts`,
                kind: 'contacts',
                contacts: contacts.filter((c) => (c.status || 'new') === slice.key),
              })
            }
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <NamedPieChart
            title="Visits by type"
            subtitle={`${range.label} · click a slice`}
            height={chartHeight}
            data={visitTypeData}
            empty="No visits logged in this range."
            onViewAll={() =>
              openDrilldown({
                title: 'All visits',
                subtitle: range.label,
                kind: 'reachouts',
                reachouts: rangedReachouts,
              })
            }
            onSelect={(slice) =>
              openDrilldown({
                title: `${slice.label} visits`,
                subtitle: range.label,
                kind: 'reachouts',
                reachouts: rangedReachouts.filter((row) => (row.reachout.type || 'other') === slice.key),
              })
            }
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <NamedBarChart
            title="Events by type"
            subtitle={`${range.label} · click a type`}
            height={chartHeight}
            data={eventTypeData}
            empty="No events in this range."
            onViewAll={() =>
              openDrilldown({
                title: 'All events',
                subtitle: range.label,
                kind: 'events',
                events: rangedEvents,
              })
            }
            onSelect={(slice) =>
              openDrilldown({
                title: `${slice.label} events`,
                subtitle: range.label,
                kind: 'events',
                events: rangedEvents.filter((event) => (event.type || 'other') === slice.key),
              })
            }
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <NamedPieChart
            title="Event status"
            subtitle={`${range.label} · click a slice`}
            height={chartHeight}
            data={eventStatusData}
            empty="No events in this range."
            onViewAll={() =>
              openDrilldown({
                title: 'All events',
                subtitle: range.label,
                kind: 'events',
                events: rangedEvents,
              })
            }
            onSelect={(slice) =>
              openDrilldown({
                title: `${slice.label} events`,
                subtitle: range.label,
                kind: 'events',
                events: rangedEvents.filter((event) => (event.status || 'scheduled') === slice.key),
              })
            }
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard
            title="Top businesses"
            subtitle="By mouths donated · click a bar"
            height={chartHeight}
            onViewAll={() =>
              openDrilldown({
                title: 'Donation visits',
                subtitle: range.label,
                kind: 'reachouts',
                reachouts: donationReachouts,
              })
            }
          >
            {businessData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={businessData} layout="vertical" margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                  <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
                  <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={isMobile ? 90 : 120}
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => (
                      <ChartTooltip
                        active={active}
                        label={String(payload?.[0]?.payload?.name ?? '')}
                        rows={[
                          { name: 'Mouths', value: Number(payload?.[0]?.payload?.mouths || 0), color: '#d4a017' },
                          { name: 'Donations', value: Number(payload?.[0]?.payload?.visits || 0), color: '#f5c842' },
                        ]}
                      />
                    )}
                  />
                  <Bar
                    dataKey="mouths"
                    fill="#d4a017"
                    radius={[0, 8, 8, 0]}
                    style={{ cursor: 'pointer' }}
                    onClick={(item) => {
                      const business = item?.payload as { businessId: string; name: string } | undefined;
                      if (!business) return;
                      openDrilldown({
                        title: business.name,
                        subtitle: 'Contacts at this business',
                        kind: 'contacts',
                        contacts: contacts.filter((c) => c.businessId === business.businessId),
                      });
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty message="No business donations in this range." />
            )}
          </ChartCard>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <NamedBarChart
            title="Opportunity pipeline"
            subtitle={`${range.label} · click a stage`}
            height={chartHeight}
            data={oppStatusData}
            empty="No opportunities in this range."
            onViewAll={() =>
              openDrilldown({
                title: 'Opportunities',
                subtitle: range.label,
                kind: 'opportunities',
                opportunities: rangedOpps,
              })
            }
            onSelect={(slice) =>
              openDrilldown({
                title: `${slice.label} opportunities`,
                subtitle: range.label,
                kind: 'opportunities',
                opportunities: rangedOpps.filter((opp) => (opp.status || 'new') === slice.key),
              })
            }
          />
        </Grid>
      </Grid>

      <ReportDrilldownDrawer
        open={!!drilldown}
        onClose={() => setDrilldown(null)}
        drilldown={drilldown}
        isMobile={isMobile}
        businesses={businesses}
        onOpenContact={handleOpenContact}
        onOpenEvent={handleOpenEvent}
        onOpenOpportunity={handleOpenOpportunity}
      />

      <Suspense fallback={null}>
        {editingContact && (
          <EditContactModal
            contact={editingContact}
            onClose={() => setEditingContact(null)}
            onSuccess={() => {
              loadData();
              setEditingContact(null);
            }}
          />
        )}
      </Suspense>
    </Box>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  hint: string;
  onClick: () => void;
}) {
  return (
    <Grid size={{ xs: 6, sm: 4, md: 'grow' }}>
      <Card sx={{ height: '100%', '&:hover': { borderColor: 'rgba(245, 200, 66, 0.5)' } }}>
        <CardActionArea onClick={onClick} sx={{ height: '100%', alignItems: 'stretch' }}>
          <CardContent sx={{ py: 1.75, px: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary', mb: 0.75 }}>
              <Box sx={{ display: 'flex', '& svg': { fontSize: 18, color: '#d4a017' } }}>{icon}</Box>
              <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.4 }}>
                {label}
              </Typography>
            </Box>
            <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
              {value.toLocaleString()}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {hint}
            </Typography>
          </CardContent>
        </CardActionArea>
      </Card>
    </Grid>
  );
}

function NamedBarChart({
  title,
  subtitle,
  height,
  data,
  empty,
  onViewAll,
  onSelect,
}: {
  title: string;
  subtitle: string;
  height: number;
  data: NamedCount[];
  empty: string;
  onViewAll: () => void;
  onSelect: (slice: NamedCount) => void;
}) {
  return (
    <ChartCard title={title} subtitle={subtitle} height={height} onViewAll={onViewAll}>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="label" width={88} tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <Tooltip
              content={({ active, payload }) => (
                <ChartTooltip
                  active={active}
                  label={String(payload?.[0]?.payload?.label ?? '')}
                  rows={[{ name: 'Count', value: Number(payload?.[0]?.value || 0), color: payload?.[0]?.payload?.color }]}
                />
              )}
            />
            <Bar
              dataKey="count"
              radius={[0, 8, 8, 0]}
              style={{ cursor: 'pointer' }}
              onClick={(item) => {
                const slice = item?.payload as NamedCount | undefined;
                if (slice) onSelect(slice);
              }}
            >
              {data.map((entry) => (
                <Cell key={entry.key} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <ChartEmpty message={empty} />
      )}
    </ChartCard>
  );
}

function NamedPieChart({
  title,
  subtitle,
  height,
  data,
  empty,
  onViewAll,
  onSelect,
}: {
  title: string;
  subtitle: string;
  height: number;
  data: NamedCount[];
  empty: string;
  onViewAll: () => void;
  onSelect: (slice: NamedCount) => void;
}) {
  return (
    <ChartCard title={title} subtitle={subtitle} height={height} onViewAll={onViewAll}>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={({ active, payload }) => (
                <ChartTooltip
                  active={active}
                  label={String(payload?.[0]?.payload?.label ?? '')}
                  rows={[{ name: 'Count', value: Number(payload?.[0]?.value || 0), color: payload?.[0]?.payload?.color }]}
                />
              )}
            />
            <Pie
              data={data}
              dataKey="count"
              nameKey="label"
              innerRadius="52%"
              outerRadius="82%"
              paddingAngle={3}
              stroke="#fff"
              strokeWidth={2}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.key}
                  fill={entry.color}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onSelect(entry)}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <ChartEmpty message={empty} />
      )}
    </ChartCard>
  );
}
