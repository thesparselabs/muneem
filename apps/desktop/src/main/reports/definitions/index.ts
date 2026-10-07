import type { ReportDefinition } from '../definition.js';
import { trialBalanceReport } from './accounting.js';
import { GST_REPORTS } from './gst.js';
import { BUSINESS_REPORTS } from './business.js';
import { MASTER_REPORTS } from './masters.js';
import { PARTY_REPORTS } from './parties.js';
import { SALES_REPORTS } from './sales.js';
import { STATEMENT_REPORTS } from './statements.js';

// Every report the app offers (FR-054, PRD §25).
export const REPORTS: readonly ReportDefinition[] = [trialBalanceReport, ...STATEMENT_REPORTS, ...SALES_REPORTS, ...BUSINESS_REPORTS, ...PARTY_REPORTS, ...GST_REPORTS, ...MASTER_REPORTS];
