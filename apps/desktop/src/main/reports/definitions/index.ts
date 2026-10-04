import type { ReportDefinition } from '../definition.js';
import { trialBalanceReport } from './accounting.js';
import { GST_REPORTS } from './gst.js';

// Every report the app offers; 8e adds the FR-054 catalogue here.
export const REPORTS: readonly ReportDefinition[] = [trialBalanceReport, ...GST_REPORTS];
