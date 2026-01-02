import { useState, useEffect, useCallback } from 'react';
import { grantsApi, landFeaturesApi, floodWarningsApi, fieldAnalyticsApi, fieldsApi, fieldOccupancyApi, sheepFlocksApi } from '../../services/api';
import type {
  Grant,
  GrantCreate,
  GrantUpdate,
  GrantDetail,
  GrantSchemeType,
  GrantStatus,
  GrantPaymentScheduleCreate,
  LandFeature,
  LandFeatureCreate,
  LandFeatureUpdate,
  LandFeatureType,
  FeatureCondition,
  FeatureMaintenanceLogCreate,
  MaintenanceType,
  WaterSourceType,
  FloodMonitoringStation,
  FloodMonitoringStationCreate,
  FloodWarningStatus,
  EAStation,
  FieldRotationSuggestion,
  Field,
  MaintenanceDueItem,
  WaterTroughStatus,
  FieldCurrentOccupancy,
  SheepFlock,
  SheepFlockCreate,
  SheepFlockUpdate,
  SheepFlockFieldAssignmentCreate,
} from '../../types';
import { useModalForm } from '../../hooks';
import {
  Tabs,
  TabPanel,
  Modal,
  ConfirmModal,
  FormGroup,
  FormRow,
  Input,
  Select,
  Textarea,
  Card,
  CardHeader,
  CardBody,
  Badge,
  StatusBadge,
  Alert,
  Loading,
  Empty,
  DataTable,
  Button,
} from '../../components/ui';
import '../../styles/LandManagement.css';
import Fields from './Fields';

// Label maps for displaying enum values
const schemeTypeLabels: Record<GrantSchemeType, string> = {
  countryside_stewardship_mid: 'Countryside Stewardship (Mid)',
  countryside_stewardship_higher: 'Countryside Stewardship (Higher)',
  hedgerow_boundary: 'Hedgerow & Boundary',
  woodland_planting: 'Woodland Planting',
  tree_health: 'Tree Health',
  environmental_land_management: 'Environmental Land Management',
  sfi: 'SFI',
  other: 'Other',
};

const grantStatusLabels: Record<GrantStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  active: 'Active',
  completed: 'Completed',
  withdrawn: 'Withdrawn',
};

const featureTypeLabels: Record<LandFeatureType, string> = {
  hedgerow: 'Hedgerow',
  tree: 'Tree',
  tree_group: 'Tree Group',
  pond: 'Pond',
  watercourse: 'Watercourse',
  boundary_fence: 'Boundary Fence',
  electric_fence: 'Electric Fence',
  post_and_rail: 'Post & Rail',
  water_trough: 'Water Trough',
  gate: 'Gate',
  other: 'Other',
};

const conditionLabels: Record<FeatureCondition, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  critical: 'Critical',
};

const conditionColors: Record<FeatureCondition, 'success' | 'info' | 'warning' | 'error'> = {
  excellent: 'success',
  good: 'info',
  fair: 'warning',
  poor: 'error',
  critical: 'error',
};

const maintenanceTypeLabels: Record<MaintenanceType, string> = {
  cutting: 'Cutting',
  trimming: 'Trimming',
  repair: 'Repair',
  replacement: 'Replacement',
  inspection: 'Inspection',
  fill: 'Fill',
  voltage_check: 'Voltage Check',
  cleaning: 'Cleaning',
  treatment: 'Treatment',
  other: 'Other',
};

const waterSourceLabels: Record<string, string> = {
  mains_feed: 'Mains Feed',
  natural_spring: 'Natural Spring',
  manual_fill: 'Manual Fill',
  rainwater: 'Rainwater',
};

// Safe accessor for water source labels
const getWaterSourceLabel = (type: string | undefined | null): string => {
  if (!type) return 'Unknown';
  return waterSourceLabels[type] || type;
};

// Default form states
const defaultGrantForm: GrantCreate = {
  name: '',
  scheme_type: 'other',
  status: 'draft',
};

const defaultFeatureForm: LandFeatureCreate = {
  name: '',
  feature_type: 'other',
  tpo_protected: false,
  electric_fence_working: true,
  is_active: true,
};

const defaultMaintenanceForm: FeatureMaintenanceLogCreate = {
  maintenance_date: new Date().toISOString().split('T')[0],
  maintenance_type: 'inspection',
};

const defaultStationForm: FloodMonitoringStationCreate = {
  station_id: '',
  station_name: '',
};

const defaultPaymentForm: GrantPaymentScheduleCreate = {
  due_date: new Date().toISOString().split('T')[0],
  amount: 0,
};

const defaultSheepFlockForm: SheepFlockCreate = {
  name: '',
  count: 1,
};

const defaultSheepAssignForm: SheepFlockFieldAssignmentCreate = {
  field_id: 0,
};

export function AdminLandManagement() {
  // Active tab state
  const [activeTab, setActiveTab] = useState('dashboard');

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data states
  const [grants, setGrants] = useState<Grant[]>([]);
  const [features, setFeatures] = useState<LandFeature[]>([]);
  const [stations, setStations] = useState<FloodMonitoringStation[]>([]);
  const [floodStatus, setFloodStatus] = useState<FloodWarningStatus | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [rotationSuggestions, setRotationSuggestions] = useState<FieldRotationSuggestion[]>([]);
  const [fieldOccupancy, setFieldOccupancy] = useState<FieldCurrentOccupancy[]>([]);
  const [sheepFlocks, setSheepFlocks] = useState<SheepFlock[]>([]);

  // Dashboard stats
  const [maintenanceDue, setMaintenanceDue] = useState<MaintenanceDueItem[]>([]);
  const [troughsNeedingFill, setTroughsNeedingFill] = useState<WaterTroughStatus[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<Grant[]>([]);

  // Detail views
  const [selectedGrant, setSelectedGrant] = useState<GrantDetail | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<LandFeature | null>(null);

  // EA Station search
  const [eaStations, setEaStations] = useState<EAStation[]>([]);
  const [eaSearchTerm, setEaSearchTerm] = useState('');
  const [eaSearching, setEaSearching] = useState(false);

  // Modal hooks
  const grantModal = useModalForm<GrantCreate>(defaultGrantForm);
  const featureModal = useModalForm<LandFeatureCreate>(defaultFeatureForm);
  const maintenanceModal = useModalForm<FeatureMaintenanceLogCreate>(defaultMaintenanceForm);
  const stationModal = useModalForm<FloodMonitoringStationCreate>(defaultStationForm);
  const paymentModal = useModalForm<GrantPaymentScheduleCreate>(defaultPaymentForm);
  const sheepFlockModal = useModalForm<SheepFlockCreate>(defaultSheepFlockForm);
  const sheepAssignModal = useModalForm<SheepFlockFieldAssignmentCreate>(defaultSheepAssignForm);

  // Selected sheep flock for assign modal
  const [selectedFlock, setSelectedFlock] = useState<SheepFlock | null>(null);

  // Confirm modal
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'grant' | 'feature' | 'station' | 'sheep_flock';
    item: Grant | LandFeature | FloodMonitoringStation | SheepFlock;
  } | null>(null);

  // Tabs configuration
  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'fields', label: 'Fields', count: fields.length },
    { id: 'occupancy', label: 'Occupancy', count: fieldOccupancy.reduce((sum, f) => sum + f.total_horse_count + f.total_sheep_count, 0) },
    { id: 'sheep', label: 'Sheep Flocks', count: sheepFlocks.length },
    { id: 'grants', label: 'Grants', count: grants.length },
    { id: 'features', label: 'Features', count: features.length },
    { id: 'water', label: 'Water Mgmt' },
    { id: 'flood', label: 'Flood Monitor', count: stations.length },
    { id: 'analytics', label: 'Analytics' },
  ];

  // Load initial data
  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadGrants(),
        loadFeatures(),
        loadStations(),
        loadFloodStatus(),
        loadFields(),
        loadDashboardData(),
        loadFieldOccupancy(),
        loadSheepFlocks(),
      ]);
      setError('');
    } catch (err) {
      setError('Failed to load land management data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const loadGrants = async () => {
    const data = await grantsApi.list();
    setGrants(data);
  };

  const loadFeatures = async () => {
    const data = await landFeaturesApi.list();
    setFeatures(data);
  };

  const loadStations = async () => {
    const data = await floodWarningsApi.listStations(false);
    setStations(data);
  };

  const loadFloodStatus = async () => {
    try {
      const data = await floodWarningsApi.getCurrentWarnings();
      setFloodStatus(data);
    } catch {
      // Flood status might fail if no stations configured
      setFloodStatus(null);
    }
  };

  const loadFields = async () => {
    const data = await fieldsApi.list();
    setFields(data);
  };

  const loadFieldOccupancy = async () => {
    try {
      const data = await fieldOccupancyApi.getAllOccupancy();
      setFieldOccupancy(data);
    } catch {
      // Might fail if no fields exist
      setFieldOccupancy([]);
    }
  };

  const loadSheepFlocks = async () => {
    try {
      const data = await sheepFlocksApi.list();
      setSheepFlocks(data);
    } catch {
      setSheepFlocks([]);
    }
  };

  const loadDashboardData = async () => {
    try {
      const [maintenance, troughs, deadlines, suggestions] = await Promise.all([
        landFeaturesApi.getMaintenanceDue(30),
        landFeaturesApi.getWaterTroughs(),
        grantsApi.getUpcomingDeadlines(30),
        fieldAnalyticsApi.getRotationSuggestions(false), // false = not acknowledged = pending
      ]);
      setMaintenanceDue(maintenance);
      setTroughsNeedingFill(troughs.filter((t) => t.needs_fill));
      setUpcomingDeadlines(deadlines);
      setRotationSuggestions(suggestions);
    } catch (err) {
      console.error('Dashboard data error:', err);
    }
  };

  const daysSince = (dateStr: string): number => {
    const date = new Date(dateStr);
    const now = new Date();
    return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  };

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB');
  };

  const formatCurrency = (amount?: number): string => {
    if (amount === undefined || amount === null) return '-';
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
  };

  // Grant handlers
  const handleGrantSubmit = async () => {
    try {
      if (grantModal.isEditing) {
        await grantsApi.update(grantModal.editingId!, grantModal.formData as GrantUpdate);
        setSuccess('Grant updated');
      } else {
        await grantsApi.create(grantModal.formData);
        setSuccess('Grant created');
      }
      grantModal.close();
      await loadGrants();
    } catch {
      setError('Failed to save grant');
    }
  };

  const handleViewGrant = async (grant: Grant) => {
    try {
      const detail = await grantsApi.get(grant.id);
      setSelectedGrant(detail);
    } catch {
      setError('Failed to load grant details');
    }
  };

  const handleEditGrant = (grant: Grant) => {
    grantModal.edit(grant.id, {
      name: grant.name,
      scheme_type: grant.scheme_type,
      status: grant.status,
      reference_number: grant.reference_number,
      application_date: grant.application_date,
      submission_deadline: grant.submission_deadline,
      decision_date: grant.decision_date,
      agreement_start_date: grant.agreement_start_date,
      agreement_end_date: grant.agreement_end_date,
      total_value: grant.total_value,
      annual_payment: grant.annual_payment,
      scheme_provider: grant.scheme_provider,
      next_inspection_date: grant.next_inspection_date,
      inspection_notes: grant.inspection_notes,
      notes: grant.notes,
    });
  };

  // Feature handlers
  const handleFeatureSubmit = async () => {
    try {
      if (featureModal.isEditing) {
        await landFeaturesApi.update(featureModal.editingId!, featureModal.formData as LandFeatureUpdate);
        setSuccess('Feature updated');
      } else {
        await landFeaturesApi.create(featureModal.formData);
        setSuccess('Feature created');
      }
      featureModal.close();
      await loadFeatures();
    } catch {
      setError('Failed to save feature');
    }
  };

  const handleEditFeature = (feature: LandFeature) => {
    featureModal.edit(feature.id, {
      name: feature.name,
      feature_type: feature.feature_type,
      description: feature.description,
      field_id: feature.field_id,
      location_description: feature.location_description,
      length_meters: feature.length_meters,
      area_sqm: feature.area_sqm,
      current_condition: feature.current_condition,
      maintenance_frequency_days: feature.maintenance_frequency_days,
      tpo_protected: feature.tpo_protected,
      tpo_reference: feature.tpo_reference,
      tree_species: feature.tree_species,
      hedgerow_species_mix: feature.hedgerow_species_mix,
      fence_height_cm: feature.fence_height_cm,
      water_source_type: feature.water_source_type,
      fill_frequency_days: feature.fill_frequency_days,
      electric_fence_working: feature.electric_fence_working,
      notes: feature.notes,
      is_active: feature.is_active,
    });
  };

  // Maintenance handlers
  const handleLogMaintenance = async () => {
    if (!selectedFeature) return;
    try {
      await landFeaturesApi.logMaintenance(selectedFeature.id, maintenanceModal.formData);
      setSuccess('Maintenance logged');
      maintenanceModal.close();
      setSelectedFeature(null);
      await loadFeatures();
      await loadDashboardData();
    } catch {
      setError('Failed to log maintenance');
    }
  };

  const handleRecordFill = async (item: { id: number; name: string }) => {
    try {
      await landFeaturesApi.recordFill(item.id);
      setSuccess(`Water trough "${item.name}" marked as filled`);
      await loadFeatures();
      await loadDashboardData();
    } catch {
      setError('Failed to record fill');
    }
  };

  // Station handlers
  const handleStationSubmit = async () => {
    try {
      await floodWarningsApi.addStation(stationModal.formData);
      setSuccess('Station added');
      stationModal.close();
      await loadStations();
    } catch {
      setError('Failed to add station');
    }
  };

  const handleSearchEAStations = async () => {
    if (!eaSearchTerm) return;
    setEaSearching(true);
    try {
      const result = await floodWarningsApi.searchEAStations({ search: eaSearchTerm });
      setEaStations(result.stations || []);
    } catch {
      setError('Failed to search stations');
    } finally {
      setEaSearching(false);
    }
  };

  const handleSelectEAStation = (station: EAStation) => {
    stationModal.setFormData({
      station_id: station.station_id,
      station_name: station.label,
      river_name: station.river_name,
      latitude: station.lat,
      longitude: station.long,
    });
    setEaStations([]);
    setEaSearchTerm('');
  };

  const handleRefreshReadings = async () => {
    try {
      await floodWarningsApi.refreshReadings();
      setSuccess('Readings refreshed');
      await loadStations();
      await loadFloodStatus();
    } catch {
      setError('Failed to refresh readings');
    }
  };

  // Sheep Flock handlers
  const handleSheepFlockSubmit = async () => {
    try {
      if (sheepFlockModal.isEditing) {
        await sheepFlocksApi.update(sheepFlockModal.editingId!, sheepFlockModal.formData as SheepFlockUpdate);
        setSuccess('Sheep flock updated');
      } else {
        await sheepFlocksApi.create(sheepFlockModal.formData);
        setSuccess('Sheep flock created');
      }
      sheepFlockModal.close();
      await loadSheepFlocks();
      await loadFieldOccupancy();
    } catch {
      setError('Failed to save sheep flock');
    }
  };

  const handleEditSheepFlock = (flock: SheepFlock) => {
    sheepFlockModal.edit(flock.id, {
      name: flock.name,
      count: flock.count,
      breed: flock.breed,
      notes: flock.notes,
    });
  };

  const handleAssignSheepFlock = async () => {
    if (!selectedFlock) return;
    try {
      await sheepFlocksApi.assignToField(selectedFlock.id, sheepAssignModal.formData);
      setSuccess(`${selectedFlock.name} assigned to field`);
      sheepAssignModal.close();
      setSelectedFlock(null);
      await loadSheepFlocks();
      await loadFieldOccupancy();
    } catch {
      setError('Failed to assign flock to field');
    }
  };

  const handleRemoveSheepFlockFromField = async (flock: SheepFlock) => {
    try {
      await sheepFlocksApi.removeFromField(flock.id);
      setSuccess(`${flock.name} removed from field`);
      await loadSheepFlocks();
      await loadFieldOccupancy();
    } catch {
      setError('Failed to remove flock from field');
    }
  };

  // Delete handler
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      switch (deleteTarget.type) {
        case 'grant':
          await grantsApi.delete(deleteTarget.item.id);
          await loadGrants();
          break;
        case 'feature':
          await landFeaturesApi.delete(deleteTarget.item.id);
          await loadFeatures();
          break;
        case 'station':
          await floodWarningsApi.deleteStation(deleteTarget.item.id);
          await loadStations();
          break;
        case 'sheep_flock':
          await sheepFlocksApi.delete(deleteTarget.item.id);
          await loadSheepFlocks();
          await loadFieldOccupancy();
          break;
      }
      setSuccess(`${deleteTarget.type.replace('_', ' ')} deleted`);
      setDeleteTarget(null);
    } catch {
      setError(`Failed to delete ${deleteTarget.type.replace('_', ' ')}`);
    }
  };

  // Payment handlers
  const handleAddPayment = async () => {
    if (!selectedGrant) return;
    try {
      await grantsApi.addPayment(selectedGrant.id, paymentModal.formData);
      setSuccess('Payment scheduled');
      paymentModal.close();
      const detail = await grantsApi.get(selectedGrant.id);
      setSelectedGrant(detail);
    } catch {
      setError('Failed to add payment');
    }
  };

  
  if (loading) return <Loading message="Loading land management..." />;

  return (
    <div className="land-management-page">
      <div className="page-header">
        <h1>Land Management</h1>
      </div>

      {error && <Alert variant="error" onDismiss={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" onDismiss={() => setSuccess('')}>{success}</Alert>}

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Dashboard Tab */}
      <TabPanel id="dashboard" activeTab={activeTab}>
        <div className="dashboard-grid">
          {/* Flood Warnings Card */}
          <Card className={`dashboard-card ${floodStatus?.has_warnings ? 'has-warning' : ''}`}>
            <CardHeader>
              <h3>Flood Status</h3>
              {floodStatus?.has_severe_warnings && <Badge variant="error">SEVERE</Badge>}
            </CardHeader>
            <CardBody>
              {!floodStatus || !floodStatus.station_alerts ? (
                <p className="text-muted">No stations configured</p>
              ) : floodStatus.has_warnings && floodStatus.station_alerts.length > 0 ? (
                <>
                  <p className="warning-count">{floodStatus.station_alerts.length} station(s) at risk</p>
                  <ul className="warning-list">
                    {floodStatus.station_alerts.map((a) => (
                      <li key={a.station_id}>
                        <span>{a.station_name}</span>
                        <Badge variant={a.current_status === 'severe' ? 'error' : 'warning'}>
                          {a.current_level?.toFixed(2)}m
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="status-ok">All clear</p>
              )}
              {floodStatus?.last_updated && (
                <p className="text-muted small">Updated: {formatDate(floodStatus.last_updated)}</p>
              )}
            </CardBody>
          </Card>

          {/* Maintenance Due Card */}
          <Card className="dashboard-card">
            <CardHeader>
              <h3>Maintenance Due</h3>
              <Badge variant={maintenanceDue.length > 0 ? 'warning' : 'success'}>
                {maintenanceDue.length}
              </Badge>
            </CardHeader>
            <CardBody>
              {maintenanceDue.length === 0 ? (
                <p className="status-ok">No maintenance due</p>
              ) : (
                <ul className="maintenance-list">
                  {maintenanceDue.slice(0, 5).map((f) => (
                    <li key={f.id}>
                      <span>{f.name}</span>
                      <span className="due-date">
                        {f.maintenance_overdue ? 'Overdue' : `Due: ${formatDate(f.next_maintenance_due)}`}
                      </span>
                    </li>
                  ))}
                  {maintenanceDue.length > 5 && (
                    <li className="more-link" onClick={() => setActiveTab('features')}>
                      +{maintenanceDue.length - 5} more...
                    </li>
                  )}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* Water Troughs Card */}
          <Card className="dashboard-card">
            <CardHeader>
              <h3>Troughs Need Filling</h3>
              <Badge variant={troughsNeedingFill.length > 0 ? 'warning' : 'success'}>
                {troughsNeedingFill.length}
              </Badge>
            </CardHeader>
            <CardBody>
              {troughsNeedingFill.length === 0 ? (
                <p className="status-ok">All troughs filled</p>
              ) : (
                <ul className="trough-list">
                  {troughsNeedingFill.map((t) => (
                    <li key={t.id}>
                      <span>{t.name}</span>
                      <Button size="sm" onClick={() => handleRecordFill(t)}>Fill</Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* Grant Deadlines Card */}
          <Card className="dashboard-card">
            <CardHeader>
              <h3>Upcoming Deadlines</h3>
              <Badge variant={upcomingDeadlines.length > 0 ? 'info' : 'success'}>
                {upcomingDeadlines.length}
              </Badge>
            </CardHeader>
            <CardBody>
              {upcomingDeadlines.length === 0 ? (
                <p className="status-ok">No upcoming deadlines</p>
              ) : (
                <ul className="deadline-list">
                  {upcomingDeadlines.map((g) => (
                    <li key={g.id}>
                      <span>{g.name}</span>
                      <span className="deadline-date">{formatDate(g.submission_deadline)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* Rotation Suggestions Card */}
          <Card className="dashboard-card wide">
            <CardHeader>
              <h3>Field Rotation Suggestions</h3>
            </CardHeader>
            <CardBody>
              {rotationSuggestions.length === 0 ? (
                <p className="text-muted">No pending suggestions</p>
              ) : (
                <ul className="suggestion-list">
                  {rotationSuggestions.map((s) => (
                    <li key={s.id}>
                      <Badge variant={s.priority === 'urgent' ? 'error' : s.priority === 'high' ? 'warning' : 'info'}>
                        {s.priority}
                      </Badge>
                      <span className="field-name">{s.field_name}</span>
                      <span className="reason">{s.reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </TabPanel>

      {/* Fields Tab */}
      <TabPanel id="fields" activeTab={activeTab}>
        <Fields />
      </TabPanel>

      {/* Occupancy Tab */}
      <TabPanel id="occupancy" activeTab={activeTab}>
        <div className="tab-header">
          <h2>Field Occupancy</h2>
        </div>

        {fieldOccupancy.length === 0 ? (
          <Empty title="No fields configured" />
        ) : (
          <div className="occupancy-grid">
            {fieldOccupancy.map((field) => (
              <Card
                key={field.field_id}
                className={`occupancy-card ${field.is_resting ? 'resting' : ''}`}
              >
                <CardHeader>
                  <h3>{field.field_name}</h3>
                  <div className="occupancy-badges">
                    <Badge variant={
                      field.current_condition === 'excellent' ? 'success' :
                      field.current_condition === 'good' ? 'info' :
                      field.current_condition === 'fair' ? 'warning' : 'error'
                    }>
                      {field.current_condition}
                    </Badge>
                    {field.is_resting && <Badge variant="warning">Resting</Badge>}
                  </div>
                </CardHeader>
                <CardBody>
                  {field.max_horses && (
                    <p className="capacity">
                      Capacity: {field.total_horse_count}/{field.max_horses} horses
                    </p>
                  )}

                  <div className="occupancy-section">
                    <h4>Horses ({field.current_horses.length})</h4>
                    {field.current_horses.length === 0 ? (
                      <p className="text-muted">No horses assigned</p>
                    ) : (
                      <ul className="occupant-list">
                        {field.current_horses.map((horse) => (
                          <li key={horse.horse_id}>
                            <span className="occupant-name">{horse.horse_name}</span>
                            {horse.owner_name && <span className="occupant-owner">({horse.owner_name})</span>}
                            <span className="occupant-since">Since {formatDate(horse.assigned_since)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="occupancy-section">
                    <h4>Sheep ({field.total_sheep_count})</h4>
                    {field.current_sheep.length === 0 ? (
                      <p className="text-muted">No sheep flocks assigned</p>
                    ) : (
                      <ul className="occupant-list">
                        {field.current_sheep.map((flock) => (
                          <li key={flock.flock_id}>
                            <span className="occupant-name">{flock.flock_name}</span>
                            <span className="occupant-count">{flock.count} sheep</span>
                            {flock.breed && <span className="occupant-breed">({flock.breed})</span>}
                            <span className="occupant-since">Since {formatDate(flock.assigned_since)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </TabPanel>

      {/* Sheep Flocks Tab */}
      <TabPanel id="sheep" activeTab={activeTab}>
        <div className="tab-header">
          <h2>Sheep Flocks</h2>
          <Button onClick={() => sheepFlockModal.open()}>Add Flock</Button>
        </div>

        <p className="section-desc">
          Sheep flocks are used for worm control grazing. Sheep help break the parasite lifecycle
          by consuming worm larvae that would otherwise affect horses.
        </p>

        {sheepFlocks.length === 0 ? (
          <Empty title="No sheep flocks configured" />
        ) : (
          <div className="sheep-grid">
            {sheepFlocks.map((flock) => (
              <Card key={flock.id} className={`sheep-card ${!flock.is_active ? 'inactive' : ''}`}>
                <CardHeader>
                  <h3>{flock.name}</h3>
                  <Badge variant="info">{flock.count} sheep</Badge>
                </CardHeader>
                <CardBody>
                  {flock.breed && (
                    <div className="flock-info">
                      <span className="label">Breed:</span>
                      <span>{flock.breed}</span>
                    </div>
                  )}
                  <div className="flock-info">
                    <span className="label">Current Field:</span>
                    <span>{flock.current_field_name || 'Not assigned'}</span>
                  </div>
                  {flock.notes && <p className="flock-notes">{flock.notes}</p>}
                </CardBody>
                <div className="card-actions">
                  {flock.current_field_id ? (
                    <Button size="sm" variant="secondary" onClick={() => handleRemoveSheepFlockFromField(flock)}>
                      Remove from Field
                    </Button>
                  ) : (
                    <Button size="sm" variant="primary" onClick={() => {
                      setSelectedFlock(flock);
                      sheepAssignModal.open();
                    }}>
                      Assign to Field
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => handleEditSheepFlock(flock)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleteTarget({ type: 'sheep_flock', item: flock })}>Delete</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </TabPanel>

      {/* Grants Tab */}
      <TabPanel id="grants" activeTab={activeTab}>
        <div className="tab-header">
          <h2>Government Grants & Schemes</h2>
          <Button onClick={() => grantModal.open()}>Add Grant</Button>
        </div>

        {grants.length === 0 ? (
          <Empty title="No grants configured" />
        ) : (
          <div className="grants-grid">
            {grants.map((grant) => (
              <Card key={grant.id} className="grant-card">
                <CardHeader>
                  <h3>{grant.name}</h3>
                  <StatusBadge status={grant.status as 'active' | 'pending' | 'completed'} />
                </CardHeader>
                <CardBody>
                  <div className="grant-info">
                    <div className="info-row">
                      <span className="label">Scheme:</span>
                      <span>{schemeTypeLabels[grant.scheme_type]}</span>
                    </div>
                    {grant.reference_number && (
                      <div className="info-row">
                        <span className="label">Reference:</span>
                        <span>{grant.reference_number}</span>
                      </div>
                    )}
                    {grant.total_value && (
                      <div className="info-row">
                        <span className="label">Value:</span>
                        <span>{formatCurrency(grant.total_value)}</span>
                      </div>
                    )}
                    {grant.submission_deadline && (
                      <div className="info-row">
                        <span className="label">Deadline:</span>
                        <span>{formatDate(grant.submission_deadline)}</span>
                      </div>
                    )}
                    {grant.agreement_end_date && (
                      <div className="info-row">
                        <span className="label">Ends:</span>
                        <span>{formatDate(grant.agreement_end_date)}</span>
                      </div>
                    )}
                  </div>
                  <div className="grant-stats">
                    <span>{grant.field_count || 0} fields</span>
                    <span>{grant.feature_count || 0} features</span>
                  </div>
                </CardBody>
                <div className="card-actions">
                  <Button size="sm" variant="ghost" onClick={() => handleViewGrant(grant)}>View</Button>
                  <Button size="sm" variant="ghost" onClick={() => handleEditGrant(grant)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleteTarget({ type: 'grant', item: grant })}>Delete</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </TabPanel>

      {/* Features Tab */}
      <TabPanel id="features" activeTab={activeTab}>
        <div className="tab-header">
          <h2>Land Features</h2>
          <Button onClick={() => featureModal.open()}>Add Feature</Button>
        </div>

        {features.length === 0 ? (
          <Empty title="No land features configured" />
        ) : (
          <div className="features-grid">
            {features.map((feature) => (
              <Card
                key={feature.id}
                className={`feature-card ${feature.maintenance_overdue ? 'overdue' : ''} ${!feature.is_active ? 'inactive' : ''}`}
              >
                <CardHeader>
                  <div className="feature-title">
                    <h3>{feature.name}</h3>
                    <Badge variant="info">{featureTypeLabels[feature.feature_type]}</Badge>
                  </div>
                  {feature.current_condition && (
                    <Badge variant={conditionColors[feature.current_condition]}>
                      {conditionLabels[feature.current_condition]}
                    </Badge>
                  )}
                </CardHeader>
                <CardBody>
                  {feature.description && <p className="feature-desc">{feature.description}</p>}

                  <div className="feature-details">
                    {feature.field_name && (
                      <div className="detail-row">
                        <span className="label">Field:</span>
                        <span>{feature.field_name}</span>
                      </div>
                    )}
                    {feature.tpo_protected && (
                      <div className="detail-row">
                        <Badge variant="warning">TPO Protected</Badge>
                        {feature.tpo_reference && <span>{feature.tpo_reference}</span>}
                      </div>
                    )}
                    {feature.water_source_type && (
                      <div className="detail-row">
                        <span className="label">Water Source:</span>
                        <span>{getWaterSourceLabel(feature.water_source_type)}</span>
                      </div>
                    )}
                    {feature.electric_fence_working !== undefined && feature.feature_type === 'electric_fence' && (
                      <div className="detail-row">
                        <span className="label">Status:</span>
                        <Badge variant={feature.electric_fence_working ? 'success' : 'error'}>
                          {feature.electric_fence_working ? 'Working' : 'Not Working'}
                        </Badge>
                      </div>
                    )}
                    {feature.last_maintenance_date && (
                      <div className="detail-row">
                        <span className="label">Last Maintained:</span>
                        <span>{formatDate(feature.last_maintenance_date)}</span>
                      </div>
                    )}
                    {feature.next_maintenance_due && (
                      <div className="detail-row">
                        <span className="label">Next Due:</span>
                        <span className={feature.maintenance_overdue ? 'overdue-text' : ''}>
                          {formatDate(feature.next_maintenance_due)}
                          {feature.maintenance_overdue && ' (OVERDUE)'}
                        </span>
                      </div>
                    )}
                  </div>
                </CardBody>
                <div className="card-actions">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      setSelectedFeature(feature);
                      maintenanceModal.open();
                    }}
                  >
                    Log Maintenance
                  </Button>
                  {feature.feature_type === 'water_trough' && feature.water_source_type === 'manual_fill' && (
                    <Button size="sm" onClick={() => handleRecordFill(feature)}>Record Fill</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => handleEditFeature(feature)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleteTarget({ type: 'feature', item: feature })}>Delete</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </TabPanel>

      {/* Water Management Tab */}
      <TabPanel id="water" activeTab={activeTab}>
        <div className="tab-header">
          <h2>Water Management</h2>
        </div>

        <div className="water-sections">
          <section className="water-section">
            <h3>Manual Fill Troughs</h3>
            <div className="troughs-grid">
              {features
                .filter((f) => f.feature_type === 'water_trough' && f.water_source_type === 'manual_fill')
                .map((trough) => {
                  const daysSinceFill = trough.last_fill_date ? daysSince(trough.last_fill_date) : Infinity;
                  const needsFill = daysSinceFill >= (trough.fill_frequency_days || 7);

                  return (
                    <Card key={trough.id} className={`trough-card ${needsFill ? 'needs-fill' : ''}`}>
                      <CardBody>
                        <h4>{trough.name}</h4>
                        {trough.field_name && <p className="field-name">{trough.field_name}</p>}
                        <div className="trough-status">
                          <div className="status-row">
                            <span>Last Filled:</span>
                            <span>{trough.last_fill_date ? formatDate(trough.last_fill_date) : 'Never'}</span>
                          </div>
                          <div className="status-row">
                            <span>Fill Frequency:</span>
                            <span>Every {trough.fill_frequency_days || 7} days</span>
                          </div>
                          {trough.last_fill_date && (
                            <div className="status-row">
                              <span>Days Since Fill:</span>
                              <span className={needsFill ? 'overdue-text' : ''}>{daysSinceFill}</span>
                            </div>
                          )}
                        </div>
                        <Button
                          variant={needsFill ? 'primary' : 'secondary'}
                          onClick={() => handleRecordFill(trough)}
                          className="fill-button"
                        >
                          Record Fill
                        </Button>
                      </CardBody>
                    </Card>
                  );
                })}
            </div>
            {features.filter((f) => f.feature_type === 'water_trough' && f.water_source_type === 'manual_fill').length === 0 && (
              <Empty title="No manual fill troughs configured" />
            )}
          </section>

          <section className="water-section">
            <h3>Auto-Fill Troughs (Mains/Spring)</h3>
            <div className="troughs-grid">
              {features
                .filter((f) => f.feature_type === 'water_trough' && f.water_source_type !== 'manual_fill')
                .map((trough) => (
                  <Card key={trough.id} className="trough-card">
                    <CardBody>
                      <h4>{trough.name}</h4>
                      {trough.field_name && <p className="field-name">{trough.field_name}</p>}
                      <div className="trough-status">
                        <div className="status-row">
                          <span>Source:</span>
                          <span>{getWaterSourceLabel(trough.water_source_type)}</span>
                        </div>
                        {trough.current_condition && (
                          <div className="status-row">
                            <span>Condition:</span>
                            <Badge variant={conditionColors[trough.current_condition]}>
                              {conditionLabels[trough.current_condition]}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </CardBody>
                  </Card>
                ))}
            </div>
          </section>
        </div>
      </TabPanel>

      {/* Flood Monitoring Tab */}
      <TabPanel id="flood" activeTab={activeTab}>
        <div className="tab-header">
          <h2>Flood Monitoring</h2>
          <div className="tab-actions">
            <Button variant="secondary" onClick={handleRefreshReadings}>Refresh Readings</Button>
            <Button onClick={() => stationModal.open()}>Add Station</Button>
          </div>
        </div>

        {floodStatus?.has_warnings && (
          <Alert variant={floodStatus.has_severe_warnings ? 'error' : 'warning'} className="flood-alert">
            {floodStatus.has_severe_warnings ? 'SEVERE FLOOD WARNING' : 'Flood Warning'}: {floodStatus.warnings.length} field(s) at risk
          </Alert>
        )}

        <section className="flood-section">
          <h3>Monitoring Stations</h3>
          {stations.length === 0 ? (
            <Empty title="No monitoring stations configured" />
          ) : (
            <div className="stations-grid">
              {stations.map((station) => (
                <Card key={station.id} className={`station-card ${station.current_status === 'severe' ? 'severe' : station.current_status === 'warning' ? 'warning' : ''}`}>
                  <CardHeader>
                    <h4>{station.station_name}</h4>
                    {station.current_status && (
                      <Badge variant={station.current_status === 'severe' ? 'error' : station.current_status === 'warning' ? 'warning' : 'success'}>
                        {station.current_status}
                      </Badge>
                    )}
                  </CardHeader>
                  <CardBody>
                    {station.river_name && <p className="river-name">{station.river_name}</p>}
                    <div className="station-info">
                      <div className="info-row">
                        <span>Station ID:</span>
                        <span>{station.station_id}</span>
                      </div>
                      {typeof station.last_reading === 'number' && (
                        <div className="info-row">
                          <span>Current Level:</span>
                          <span>{station.last_reading.toFixed(2)}m</span>
                        </div>
                      )}
                      {station.warning_threshold_meters && (
                        <div className="info-row">
                          <span>Warning at:</span>
                          <span>{station.warning_threshold_meters}m</span>
                        </div>
                      )}
                      <div className="info-row">
                        <span>Linked Fields:</span>
                        <span>{station.linked_field_count || 0}</span>
                      </div>
                      {station.last_fetched && (
                        <div className="info-row">
                          <span>Last Updated:</span>
                          <span>{formatDate(station.last_fetched)}</span>
                        </div>
                      )}
                    </div>
                  </CardBody>
                  <div className="card-actions">
                    <Button size="sm" variant="ghost" onClick={() => setDeleteTarget({ type: 'station', item: station })}>Remove</Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section className="flood-section">
          <h3>Field Flood Risk Links</h3>
          <p className="section-desc">Link fields to monitoring stations to receive flood warnings.</p>
          {/* TODO: Add field-station linking UI */}
        </section>
      </TabPanel>

      {/* Analytics Tab */}
      <TabPanel id="analytics" activeTab={activeTab}>
        <div className="tab-header">
          <h2>Field Utilization Analytics</h2>
        </div>

        <section className="analytics-section">
          <h3>Rotation Suggestions</h3>
          {rotationSuggestions.length === 0 ? (
            <Empty title="No rotation suggestions" />
          ) : (
            <DataTable
              data={rotationSuggestions}
              keyExtractor={(s) => s.id}
              columns={[
                { key: 'field_name', header: 'Field' },
                {
                  key: 'priority',
                  header: 'Priority',
                  render: (s) => (
                    <Badge variant={s.priority === 'urgent' ? 'error' : s.priority === 'high' ? 'warning' : 'info'}>
                      {s.priority}
                    </Badge>
                  )
                },
                { key: 'suggestion_type', header: 'Type' },
                { key: 'reason', header: 'Reason' },
                { key: 'suggested_date', header: 'Date', render: (s) => formatDate(s.suggested_date) },
                {
                  key: 'actions',
                  header: 'Actions',
                  render: (s) => (
                    <Button
                      size="sm"
                      disabled={s.acknowledged}
                      onClick={async () => {
                        await fieldAnalyticsApi.acknowledgeSuggestion(s.id);
                        await loadDashboardData();
                      }}
                    >
                      {s.acknowledged ? 'Acknowledged' : 'Acknowledge'}
                    </Button>
                  )
                },
              ]}
            />
          )}
        </section>
      </TabPanel>

      {/* Grant Modal */}
      <Modal
        isOpen={grantModal.isOpen}
        onClose={grantModal.close}
        title={grantModal.isEditing ? 'Edit Grant' : 'Add Grant'}
        size="lg"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleGrantSubmit(); }}>
          <FormGroup label="Grant Name" required>
            <Input
              value={grantModal.formData.name || ''}
              onChange={(e) => grantModal.setFormData({ ...grantModal.formData, name: e.target.value })}
              required
            />
          </FormGroup>

          <FormRow>
            <FormGroup label="Scheme Type" required>
              <Select
                value={grantModal.formData.scheme_type || 'other'}
                onChange={(e) => grantModal.setFormData({ ...grantModal.formData, scheme_type: e.target.value as GrantSchemeType })}
              >
                {Object.entries(schemeTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </FormGroup>

            <FormGroup label="Status" required>
              <Select
                value={grantModal.formData.status || 'draft'}
                onChange={(e) => grantModal.setFormData({ ...grantModal.formData, status: e.target.value as GrantStatus })}
              >
                {Object.entries(grantStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </FormGroup>
          </FormRow>

          <FormRow>
            <FormGroup label="Reference Number">
              <Input
                value={grantModal.formData.reference_number || ''}
                onChange={(e) => grantModal.setFormData({ ...grantModal.formData, reference_number: e.target.value })}
              />
            </FormGroup>

            <FormGroup label="Scheme Provider">
              <Input
                value={grantModal.formData.scheme_provider || ''}
                onChange={(e) => grantModal.setFormData({ ...grantModal.formData, scheme_provider: e.target.value })}
                placeholder="e.g., Natural England, RPA"
              />
            </FormGroup>
          </FormRow>

          <FormRow>
            <FormGroup label="Application Date">
              <Input
                type="date"
                value={grantModal.formData.application_date || ''}
                onChange={(e) => grantModal.setFormData({ ...grantModal.formData, application_date: e.target.value })}
              />
            </FormGroup>

            <FormGroup label="Submission Deadline">
              <Input
                type="date"
                value={grantModal.formData.submission_deadline || ''}
                onChange={(e) => grantModal.setFormData({ ...grantModal.formData, submission_deadline: e.target.value })}
              />
            </FormGroup>
          </FormRow>

          <FormRow>
            <FormGroup label="Agreement Start">
              <Input
                type="date"
                value={grantModal.formData.agreement_start_date || ''}
                onChange={(e) => grantModal.setFormData({ ...grantModal.formData, agreement_start_date: e.target.value })}
              />
            </FormGroup>

            <FormGroup label="Agreement End">
              <Input
                type="date"
                value={grantModal.formData.agreement_end_date || ''}
                onChange={(e) => grantModal.setFormData({ ...grantModal.formData, agreement_end_date: e.target.value })}
              />
            </FormGroup>
          </FormRow>

          <FormRow>
            <FormGroup label="Total Value (£)">
              <Input
                type="number"
                step="0.01"
                value={grantModal.formData.total_value || ''}
                onChange={(e) => grantModal.setFormData({ ...grantModal.formData, total_value: parseFloat(e.target.value) || undefined })}
              />
            </FormGroup>

            <FormGroup label="Annual Payment (£)">
              <Input
                type="number"
                step="0.01"
                value={grantModal.formData.annual_payment || ''}
                onChange={(e) => grantModal.setFormData({ ...grantModal.formData, annual_payment: parseFloat(e.target.value) || undefined })}
              />
            </FormGroup>
          </FormRow>

          <FormRow>
            <FormGroup label="Next Inspection Date">
              <Input
                type="date"
                value={grantModal.formData.next_inspection_date || ''}
                onChange={(e) => grantModal.setFormData({ ...grantModal.formData, next_inspection_date: e.target.value })}
              />
            </FormGroup>
          </FormRow>

          <FormGroup label="Inspection Notes">
            <Textarea
              value={grantModal.formData.inspection_notes || ''}
              onChange={(e) => grantModal.setFormData({ ...grantModal.formData, inspection_notes: e.target.value })}
              rows={2}
            />
          </FormGroup>

          <FormGroup label="Notes">
            <Textarea
              value={grantModal.formData.notes || ''}
              onChange={(e) => grantModal.setFormData({ ...grantModal.formData, notes: e.target.value })}
              rows={3}
            />
          </FormGroup>

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={grantModal.close}>Cancel</Button>
            <Button type="submit" variant="primary">{grantModal.isEditing ? 'Save' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      {/* Feature Modal */}
      <Modal
        isOpen={featureModal.isOpen}
        onClose={featureModal.close}
        title={featureModal.isEditing ? 'Edit Feature' : 'Add Feature'}
        size="lg"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleFeatureSubmit(); }}>
          <FormRow>
            <FormGroup label="Feature Name" required>
              <Input
                value={featureModal.formData.name || ''}
                onChange={(e) => featureModal.setFormData({ ...featureModal.formData, name: e.target.value })}
                required
              />
            </FormGroup>

            <FormGroup label="Feature Type" required>
              <Select
                value={featureModal.formData.feature_type || 'other'}
                onChange={(e) => featureModal.setFormData({ ...featureModal.formData, feature_type: e.target.value as LandFeatureType })}
              >
                {Object.entries(featureTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </FormGroup>
          </FormRow>

          <FormGroup label="Description">
            <Textarea
              value={featureModal.formData.description || ''}
              onChange={(e) => featureModal.setFormData({ ...featureModal.formData, description: e.target.value })}
              rows={2}
            />
          </FormGroup>

          <FormRow>
            <FormGroup label="Field">
              <Select
                value={featureModal.formData.field_id || ''}
                onChange={(e) => featureModal.setFormData({ ...featureModal.formData, field_id: e.target.value ? parseInt(e.target.value) : undefined })}
              >
                <option value="">No specific field</option>
                {fields.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </Select>
            </FormGroup>

            <FormGroup label="Condition">
              <Select
                value={featureModal.formData.current_condition || ''}
                onChange={(e) => featureModal.setFormData({ ...featureModal.formData, current_condition: e.target.value as FeatureCondition || undefined })}
              >
                <option value="">Not assessed</option>
                {Object.entries(conditionLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </FormGroup>
          </FormRow>

          <FormGroup label="Location Description">
            <Input
              value={featureModal.formData.location_description || ''}
              onChange={(e) => featureModal.setFormData({ ...featureModal.formData, location_description: e.target.value })}
              placeholder="e.g., North boundary of Top Field"
            />
          </FormGroup>

          <FormRow>
            <FormGroup label="Length (m)">
              <Input
                type="number"
                value={featureModal.formData.length_meters || ''}
                onChange={(e) => featureModal.setFormData({ ...featureModal.formData, length_meters: parseFloat(e.target.value) || undefined })}
              />
            </FormGroup>

            <FormGroup label="Area (sqm)">
              <Input
                type="number"
                value={featureModal.formData.area_sqm || ''}
                onChange={(e) => featureModal.setFormData({ ...featureModal.formData, area_sqm: parseFloat(e.target.value) || undefined })}
              />
            </FormGroup>

            <FormGroup label="Maintenance Frequency (days)">
              <Input
                type="number"
                value={featureModal.formData.maintenance_frequency_days || ''}
                onChange={(e) => featureModal.setFormData({ ...featureModal.formData, maintenance_frequency_days: parseInt(e.target.value) || undefined })}
              />
            </FormGroup>
          </FormRow>

          {/* Tree-specific fields */}
          {(featureModal.formData.feature_type === 'tree' || featureModal.formData.feature_type === 'tree_group') && (
            <>
              <FormRow>
                <FormGroup label="Tree Species">
                  <Input
                    value={featureModal.formData.tree_species || ''}
                    onChange={(e) => featureModal.setFormData({ ...featureModal.formData, tree_species: e.target.value })}
                    placeholder="e.g., Oak, Ash, Beech"
                  />
                </FormGroup>
                <FormGroup label="TPO Reference">
                  <Input
                    value={featureModal.formData.tpo_reference || ''}
                    onChange={(e) => featureModal.setFormData({ ...featureModal.formData, tpo_reference: e.target.value })}
                    disabled={!featureModal.formData.tpo_protected}
                  />
                </FormGroup>
              </FormRow>
              <FormGroup>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={featureModal.formData.tpo_protected || false}
                    onChange={(e) => featureModal.setFormData({ ...featureModal.formData, tpo_protected: e.target.checked })}
                  />
                  TPO Protected
                </label>
              </FormGroup>
            </>
          )}

          {/* Hedgerow-specific fields */}
          {featureModal.formData.feature_type === 'hedgerow' && (
            <FormGroup label="Species Mix">
              <Input
                value={featureModal.formData.hedgerow_species_mix || ''}
                onChange={(e) => featureModal.setFormData({ ...featureModal.formData, hedgerow_species_mix: e.target.value })}
                placeholder="e.g., Hawthorn, Blackthorn, Field Maple"
              />
            </FormGroup>
          )}

          {/* Fence-specific fields */}
          {(featureModal.formData.feature_type === 'boundary_fence' ||
            featureModal.formData.feature_type === 'electric_fence' ||
            featureModal.formData.feature_type === 'post_and_rail') && (
            <FormRow>
              <FormGroup label="Fence Height (cm)">
                <Input
                  type="number"
                  value={featureModal.formData.fence_height_cm || ''}
                  onChange={(e) => featureModal.setFormData({ ...featureModal.formData, fence_height_cm: parseInt(e.target.value) || undefined })}
                />
              </FormGroup>
            </FormRow>
          )}

          {/* Electric fence-specific fields */}
          {featureModal.formData.feature_type === 'electric_fence' && (
            <FormGroup>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={featureModal.formData.electric_fence_working ?? true}
                  onChange={(e) => featureModal.setFormData({ ...featureModal.formData, electric_fence_working: e.target.checked })}
                />
                Electric Fence Working
              </label>
            </FormGroup>
          )}

          {/* Water trough-specific fields */}
          {featureModal.formData.feature_type === 'water_trough' && (
            <FormRow>
              <FormGroup label="Water Source">
                <Select
                  value={featureModal.formData.water_source_type || ''}
                  onChange={(e) => featureModal.setFormData({ ...featureModal.formData, water_source_type: e.target.value as WaterSourceType || undefined })}
                >
                  <option value="">Select source</option>
                  {Object.entries(waterSourceLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </FormGroup>

              {featureModal.formData.water_source_type === 'manual_fill' && (
                <FormGroup label="Fill Frequency (days)">
                  <Input
                    type="number"
                    value={featureModal.formData.fill_frequency_days || 7}
                    onChange={(e) => featureModal.setFormData({ ...featureModal.formData, fill_frequency_days: parseInt(e.target.value) || 7 })}
                  />
                </FormGroup>
              )}
            </FormRow>
          )}

          <FormGroup label="Notes">
            <Textarea
              value={featureModal.formData.notes || ''}
              onChange={(e) => featureModal.setFormData({ ...featureModal.formData, notes: e.target.value })}
              rows={2}
            />
          </FormGroup>

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={featureModal.close}>Cancel</Button>
            <Button type="submit" variant="primary">{featureModal.isEditing ? 'Save' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      {/* Maintenance Log Modal */}
      <Modal
        isOpen={maintenanceModal.isOpen}
        onClose={() => { maintenanceModal.close(); setSelectedFeature(null); }}
        title={`Log Maintenance - ${selectedFeature?.name}`}
      >
        <form onSubmit={(e) => { e.preventDefault(); handleLogMaintenance(); }}>
          <FormRow>
            <FormGroup label="Date" required>
              <Input
                type="date"
                value={maintenanceModal.formData.maintenance_date}
                onChange={(e) => maintenanceModal.setFormData({ ...maintenanceModal.formData, maintenance_date: e.target.value })}
                required
              />
            </FormGroup>

            <FormGroup label="Type" required>
              <Select
                value={maintenanceModal.formData.maintenance_type}
                onChange={(e) => maintenanceModal.setFormData({ ...maintenanceModal.formData, maintenance_type: e.target.value as MaintenanceType })}
              >
                {Object.entries(maintenanceTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </FormGroup>
          </FormRow>

          <FormGroup label="Description">
            <Textarea
              value={maintenanceModal.formData.description || ''}
              onChange={(e) => maintenanceModal.setFormData({ ...maintenanceModal.formData, description: e.target.value })}
              rows={2}
            />
          </FormGroup>

          <FormRow>
            <FormGroup label="Condition Before">
              <Select
                value={maintenanceModal.formData.condition_before || ''}
                onChange={(e) => maintenanceModal.setFormData({ ...maintenanceModal.formData, condition_before: e.target.value as FeatureCondition || undefined })}
              >
                <option value="">Select</option>
                {Object.entries(conditionLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </FormGroup>

            <FormGroup label="Condition After">
              <Select
                value={maintenanceModal.formData.condition_after || ''}
                onChange={(e) => maintenanceModal.setFormData({ ...maintenanceModal.formData, condition_after: e.target.value as FeatureCondition || undefined })}
              >
                <option value="">Select</option>
                {Object.entries(conditionLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </FormGroup>
          </FormRow>

          <FormRow>
            <FormGroup label="Contractor Name">
              <Input
                value={maintenanceModal.formData.contractor_name || ''}
                onChange={(e) => maintenanceModal.setFormData({ ...maintenanceModal.formData, contractor_name: e.target.value })}
              />
            </FormGroup>

            <FormGroup label="Cost (£)">
              <Input
                type="number"
                step="0.01"
                value={maintenanceModal.formData.cost || ''}
                onChange={(e) => maintenanceModal.setFormData({ ...maintenanceModal.formData, cost: parseFloat(e.target.value) || undefined })}
              />
            </FormGroup>
          </FormRow>

          <FormGroup label="Notes">
            <Textarea
              value={maintenanceModal.formData.notes || ''}
              onChange={(e) => maintenanceModal.setFormData({ ...maintenanceModal.formData, notes: e.target.value })}
              rows={2}
            />
          </FormGroup>

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={() => { maintenanceModal.close(); setSelectedFeature(null); }}>Cancel</Button>
            <Button type="submit" variant="primary">Log Maintenance</Button>
          </div>
        </form>
      </Modal>

      {/* Station Modal */}
      <Modal
        isOpen={stationModal.isOpen}
        onClose={stationModal.close}
        title="Add Monitoring Station"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleStationSubmit(); }}>
          <FormGroup label="Search Environment Agency Stations">
            <div className="search-row">
              <Input
                value={eaSearchTerm}
                onChange={(e) => setEaSearchTerm(e.target.value)}
                placeholder="Search by river name or location..."
              />
              <Button type="button" onClick={handleSearchEAStations} disabled={eaSearching}>
                {eaSearching ? 'Searching...' : 'Search'}
              </Button>
            </div>
          </FormGroup>

          {eaStations.length > 0 && (
            <div className="ea-results">
              {eaStations.slice(0, 10).map((station) => (
                <div key={station.station_id} className="ea-station-item" onClick={() => handleSelectEAStation(station)}>
                  <strong>{station.label}</strong>
                  {station.river_name && <span> - {station.river_name}</span>}
                  {station.town && <span className="town"> ({station.town})</span>}
                </div>
              ))}
            </div>
          )}

          <FormRow>
            <FormGroup label="Station ID" required>
              <Input
                value={stationModal.formData.station_id}
                onChange={(e) => stationModal.setFormData({ ...stationModal.formData, station_id: e.target.value })}
                required
              />
            </FormGroup>

            <FormGroup label="Station Name" required>
              <Input
                value={stationModal.formData.station_name}
                onChange={(e) => stationModal.setFormData({ ...stationModal.formData, station_name: e.target.value })}
                required
              />
            </FormGroup>
          </FormRow>

          <FormGroup label="River Name">
            <Input
              value={stationModal.formData.river_name || ''}
              onChange={(e) => stationModal.setFormData({ ...stationModal.formData, river_name: e.target.value })}
            />
          </FormGroup>

          <FormRow>
            <FormGroup label="Warning Threshold (m)">
              <Input
                type="number"
                step="0.01"
                value={stationModal.formData.warning_threshold_meters || ''}
                onChange={(e) => stationModal.setFormData({ ...stationModal.formData, warning_threshold_meters: parseFloat(e.target.value) || undefined })}
              />
            </FormGroup>

            <FormGroup label="Severe Threshold (m)">
              <Input
                type="number"
                step="0.01"
                value={stationModal.formData.severe_threshold_meters || ''}
                onChange={(e) => stationModal.setFormData({ ...stationModal.formData, severe_threshold_meters: parseFloat(e.target.value) || undefined })}
              />
            </FormGroup>
          </FormRow>

          <FormGroup label="Notes">
            <Textarea
              value={stationModal.formData.notes || ''}
              onChange={(e) => stationModal.setFormData({ ...stationModal.formData, notes: e.target.value })}
              rows={2}
            />
          </FormGroup>

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={stationModal.close}>Cancel</Button>
            <Button type="submit" variant="primary">Add Station</Button>
          </div>
        </form>
      </Modal>

      {/* Grant Detail Modal */}
      <Modal
        isOpen={!!selectedGrant}
        onClose={() => setSelectedGrant(null)}
        title={selectedGrant?.name || 'Grant Details'}
        size="lg"
      >
        {selectedGrant && (
          <div className="grant-detail">
            <div className="detail-section">
              <h4>Grant Information</h4>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="label">Scheme:</span>
                  <span>{schemeTypeLabels[selectedGrant.scheme_type]}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Status:</span>
                  <StatusBadge status={selectedGrant.status as 'active' | 'pending' | 'completed'} />
                </div>
                {selectedGrant.reference_number && (
                  <div className="detail-item">
                    <span className="label">Reference:</span>
                    <span>{selectedGrant.reference_number}</span>
                  </div>
                )}
                {selectedGrant.total_value && (
                  <div className="detail-item">
                    <span className="label">Total Value:</span>
                    <span>{formatCurrency(selectedGrant.total_value)}</span>
                  </div>
                )}
                {selectedGrant.annual_payment && (
                  <div className="detail-item">
                    <span className="label">Annual Payment:</span>
                    <span>{formatCurrency(selectedGrant.annual_payment)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="detail-section">
              <h4>Linked Fields ({selectedGrant.linked_fields?.length || 0})</h4>
              {selectedGrant.linked_fields?.length > 0 ? (
                <ul className="linked-list">
                  {selectedGrant.linked_fields.map((link) => (
                    <li key={link.id}>{link.field_name}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted">No fields linked</p>
              )}
            </div>

            <div className="detail-section">
              <h4>Linked Features ({selectedGrant.linked_features?.length || 0})</h4>
              {selectedGrant.linked_features?.length > 0 ? (
                <ul className="linked-list">
                  {selectedGrant.linked_features.map((link) => (
                    <li key={link.id}>{link.feature_name}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted">No features linked</p>
              )}
            </div>

            <div className="detail-section">
              <div className="section-header">
                <h4>Payment Schedule ({selectedGrant.payment_schedules?.length || 0})</h4>
                <Button size="sm" onClick={() => paymentModal.open()}>Add Payment</Button>
              </div>
              {selectedGrant.payment_schedules?.length > 0 ? (
                <DataTable
                  data={selectedGrant.payment_schedules}
                  keyExtractor={(p) => p.id}
                  columns={[
                    { key: 'due_date', header: 'Due Date', render: (p) => formatDate(p.due_date) },
                    { key: 'amount', header: 'Amount', render: (p) => formatCurrency(p.amount) },
                    { key: 'status', header: 'Status' },
                    { key: 'received_date', header: 'Received', render: (p) => formatDate(p.received_date) },
                  ]}
                />
              ) : (
                <p className="text-muted">No payments scheduled</p>
              )}
            </div>

            {selectedGrant.notes && (
              <div className="detail-section">
                <h4>Notes</h4>
                <p>{selectedGrant.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Payment Modal */}
      <Modal
        isOpen={paymentModal.isOpen}
        onClose={paymentModal.close}
        title="Add Payment Schedule"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleAddPayment(); }}>
          <FormRow>
            <FormGroup label="Due Date" required>
              <Input
                type="date"
                value={paymentModal.formData.due_date}
                onChange={(e) => paymentModal.setFormData({ ...paymentModal.formData, due_date: e.target.value })}
                required
              />
            </FormGroup>

            <FormGroup label="Amount (£)" required>
              <Input
                type="number"
                step="0.01"
                value={paymentModal.formData.amount}
                onChange={(e) => paymentModal.setFormData({ ...paymentModal.formData, amount: parseFloat(e.target.value) || 0 })}
                required
              />
            </FormGroup>
          </FormRow>

          <FormGroup label="Reference">
            <Input
              value={paymentModal.formData.reference || ''}
              onChange={(e) => paymentModal.setFormData({ ...paymentModal.formData, reference: e.target.value })}
            />
          </FormGroup>

          <FormGroup label="Notes">
            <Textarea
              value={paymentModal.formData.notes || ''}
              onChange={(e) => paymentModal.setFormData({ ...paymentModal.formData, notes: e.target.value })}
              rows={2}
            />
          </FormGroup>

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={paymentModal.close}>Cancel</Button>
            <Button type="submit" variant="primary">Add Payment</Button>
          </div>
        </form>
      </Modal>

      {/* Sheep Flock Modal */}
      <Modal
        isOpen={sheepFlockModal.isOpen}
        onClose={sheepFlockModal.close}
        title={sheepFlockModal.isEditing ? 'Edit Sheep Flock' : 'Add Sheep Flock'}
      >
        <form onSubmit={(e) => { e.preventDefault(); handleSheepFlockSubmit(); }}>
          <FormGroup label="Flock Name" required>
            <Input
              value={sheepFlockModal.formData.name || ''}
              onChange={(e) => sheepFlockModal.setFormData({ ...sheepFlockModal.formData, name: e.target.value })}
              placeholder="e.g., Main Flock, Hill Sheep"
              required
            />
          </FormGroup>

          <FormRow>
            <FormGroup label="Number of Sheep" required>
              <Input
                type="number"
                min="1"
                value={sheepFlockModal.formData.count || 1}
                onChange={(e) => sheepFlockModal.setFormData({ ...sheepFlockModal.formData, count: parseInt(e.target.value) || 1 })}
                required
              />
            </FormGroup>

            <FormGroup label="Breed">
              <Input
                value={sheepFlockModal.formData.breed || ''}
                onChange={(e) => sheepFlockModal.setFormData({ ...sheepFlockModal.formData, breed: e.target.value })}
                placeholder="e.g., Suffolk, Texel"
              />
            </FormGroup>
          </FormRow>

          <FormGroup label="Notes">
            <Textarea
              value={sheepFlockModal.formData.notes || ''}
              onChange={(e) => sheepFlockModal.setFormData({ ...sheepFlockModal.formData, notes: e.target.value })}
              rows={2}
            />
          </FormGroup>

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={sheepFlockModal.close}>Cancel</Button>
            <Button type="submit" variant="primary">{sheepFlockModal.isEditing ? 'Save' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      {/* Sheep Assign to Field Modal */}
      <Modal
        isOpen={sheepAssignModal.isOpen}
        onClose={() => { sheepAssignModal.close(); setSelectedFlock(null); }}
        title={`Assign ${selectedFlock?.name || 'Flock'} to Field`}
      >
        <form onSubmit={(e) => { e.preventDefault(); handleAssignSheepFlock(); }}>
          <FormGroup label="Select Field" required>
            <Select
              value={sheepAssignModal.formData.field_id || ''}
              onChange={(e) => sheepAssignModal.setFormData({ ...sheepAssignModal.formData, field_id: parseInt(e.target.value) })}
              required
            >
              <option value="">Choose a field...</option>
              {fields.filter((f) => f.is_active && !f.is_resting).map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </Select>
          </FormGroup>

          <FormGroup label="Start Date">
            <Input
              type="date"
              value={sheepAssignModal.formData.start_date || ''}
              onChange={(e) => sheepAssignModal.setFormData({ ...sheepAssignModal.formData, start_date: e.target.value })}
            />
          </FormGroup>

          <FormGroup label="Notes">
            <Textarea
              value={sheepAssignModal.formData.notes || ''}
              onChange={(e) => sheepAssignModal.setFormData({ ...sheepAssignModal.formData, notes: e.target.value })}
              rows={2}
            />
          </FormGroup>

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={() => { sheepAssignModal.close(); setSelectedFlock(null); }}>Cancel</Button>
            <Button type="submit" variant="primary">Assign to Field</Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={`Delete ${deleteTarget?.type?.replace('_', ' ')}`}
        message={`Are you sure you want to delete "${(deleteTarget?.item as { name?: string })?.name || (deleteTarget?.item as { station_name?: string })?.station_name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

export default AdminLandManagement;
