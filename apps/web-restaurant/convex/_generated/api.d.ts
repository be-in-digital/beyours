/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as affiliateSettings from "../affiliateSettings.js";
import type * as affiliateSignature from "../affiliateSignature.js";
import type * as affiliateUsers from "../affiliateUsers.js";
import type * as auth from "../auth.js";
import type * as contactLeads from "../contactLeads.js";
import type * as contractContent from "../contractContent.js";
import type * as contractSignatures from "../contractSignatures.js";
import type * as contractVersions from "../contractVersions.js";
import type * as crons from "../crons.js";
import type * as email_layout from "../email/layout.js";
import type * as email_send from "../email/send.js";
import type * as email_templates from "../email/templates.js";
import type * as http from "../http.js";
import type * as invoices from "../invoices.js";
import type * as migrations from "../migrations.js";
import type * as orders from "../orders.js";
import type * as payments from "../payments.js";
import type * as referralCodes from "../referralCodes.js";
import type * as referrals from "../referrals.js";
import type * as saActivity from "../saActivity.js";
import type * as saClients from "../saClients.js";
import type * as saDashboard from "../saDashboard.js";
import type * as saFleet from "../saFleet.js";
import type * as saIncidents from "../saIncidents.js";
import type * as saLib from "../saLib.js";
import type * as saMonitoring from "../saMonitoring.js";
import type * as saRevenue from "../saRevenue.js";
import type * as saSales from "../saSales.js";
import type * as saSeed from "../saSeed.js";
import type * as stripe from "../stripe.js";
import type * as stripeConnect from "../stripeConnect.js";
import type * as stripeEvents from "../stripeEvents.js";
import type * as subscriptions from "../subscriptions.js";
import type * as whitelist from "../whitelist.js";
import type * as yousign from "../yousign.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  affiliateSettings: typeof affiliateSettings;
  affiliateSignature: typeof affiliateSignature;
  affiliateUsers: typeof affiliateUsers;
  auth: typeof auth;
  contactLeads: typeof contactLeads;
  contractContent: typeof contractContent;
  contractSignatures: typeof contractSignatures;
  contractVersions: typeof contractVersions;
  crons: typeof crons;
  "email/layout": typeof email_layout;
  "email/send": typeof email_send;
  "email/templates": typeof email_templates;
  http: typeof http;
  invoices: typeof invoices;
  migrations: typeof migrations;
  orders: typeof orders;
  payments: typeof payments;
  referralCodes: typeof referralCodes;
  referrals: typeof referrals;
  saActivity: typeof saActivity;
  saClients: typeof saClients;
  saDashboard: typeof saDashboard;
  saFleet: typeof saFleet;
  saIncidents: typeof saIncidents;
  saLib: typeof saLib;
  saMonitoring: typeof saMonitoring;
  saRevenue: typeof saRevenue;
  saSales: typeof saSales;
  saSeed: typeof saSeed;
  stripe: typeof stripe;
  stripeConnect: typeof stripeConnect;
  stripeEvents: typeof stripeEvents;
  subscriptions: typeof subscriptions;
  whitelist: typeof whitelist;
  yousign: typeof yousign;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
