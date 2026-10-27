export type ViewScreen =
  | 'catalog'
  | 'users'
  | 'settings'
  | 'analytics'
  | 'orders'
  | 'sync'
  | 'audit'
  | 'stock'
  | 'movement'
  | 'tickets'
  | 'diagnostics';

export type ScreenState = 'ready' | 'loading' | 'empty' | 'error' | 'success';

export interface SkuStockItem {
  id: string;
  sku: string;
  productName: string;
  variantName: string;
  category: string;
  physicalStock: number;
  reservedStock: number;
  safetyMargin: number;
  availableStock: number;
  channelStatus: {
    ml: { synced: boolean; observedStock: number; listingId: string };
    shopee: { synced: boolean; observedStock: number; itemId: string };
  };
  unitPrice: number;
  barcode: string;
  lastUpdated: string;
}

export interface OrderReservation {
  id: string;
  orderNumber: string;
  channel: 'mercadolivre' | 'shopee';
  placedAt: string;
  customerName: string;
  customerDocumentMasked: string;
  items: {
    sku: string;
    productName: string;
    quantity: number;
  }[];
  reservedQuantity: number;
  orderStatus: 'APROVADO' | 'EM_SEPARACAO' | 'EXPEDIDO' | 'CANCELADO';
  reservationStatus: 'RESERVADO_INTEGRAL' | 'RESERVADO_PARCIAL' | 'FALTA_ESTOQUE' | 'CONSUMIDA_EXPEDICAO' | 'LIBERADA';
  uncoveredDemand: number;
  notes?: string;
}

export interface ChannelSyncInfo {
  id: 'mercadolivre' | 'shopee';
  name: string;
  apiVer: string;
  connectedAccount: string;
  status: 'OPERATIONAL' | 'WARNING' | 'ERROR' | 'PAUSED';
  lastWebhookSecondsAgo: number;
  queuePending: number;
  queueLatencySeconds: number;
  tokenExpiresIn: string;
  activeMarginDefault: number;
}

export interface StockDiscrepancy {
  id: string;
  channel: 'mercadolivre' | 'shopee';
  resourceSku: string;
  productName: string;
  localAvailable: number;
  remoteObserved: number;
  difference: number;
  probableCause: string;
  status: 'PENDENTE' | 'RESOLVIDO' | 'INVESTIGANDO';
  detectedAt: string;
  proposalResolution: string;
}

export interface AuditMovement {
  id: string;
  timestamp: string;
  sku: string;
  productName: string;
  eventType: 'ENTRADA_REPOSICAO' | 'BAIXA_EXPEDICAO' | 'RESERVA_COMPRA' | 'LIBERACAO_CANCELAMENTO' | 'AJUSTE_BALANCO';
  documentRef: string;
  operator: string;
  quantityDelta: number;
  resultingPhysical: number;
  resultingAvailable: number;
  justification: string;
  proposalNote?: string;
}

export interface SalesKpiMetrics {
  periodDays: number;
  startDate: string;
  endDate: string;
  totalUnitsSold: number;
  unitsGrowthPercent: number;
  mlUnits: number;
  shopeeUnits: number;
  grossRevenue: number;
  revenueGrowthPercent: number;
  mlRevenue: number;
  shopeeRevenue: number;
  averageTicket: number;
  ticketGrowthPercent: number;
  mlTicket: number;
  shopeeTicket: number;
  topProduct: {
    name: string;
    sku: string;
    unitsSold: number;
    revenue: number;
  };
  weeklyEvolution: {
    week: string;
    ml: number;
    shopee: number;
    total: number;
  }[];
  topSkus: {
    sku: string;
    productName: string;
    unitsSold: number;
    revenue: number;
    sharePercent: number;
  }[];
  officialMetrics: {
    ml: {
      status: 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE';
      adVisits: number;
      averageConversionRate: number;
      questionsReceived: number;
      sourceInfo: string;
    };
    shopee: {
      status: 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE';
      productViews: number;
      shopClicks: number;
      conversionRate: number;
      sourceInfo: string;
    };
  };
}
