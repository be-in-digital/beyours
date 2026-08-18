import { create } from "zustand";

/* ── Dev mode (global, switched on by ?dev=true in the URL) ── */

interface DevModeStore {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
}

export const useDevMode = create<DevModeStore>((set) => ({
  enabled: false,
  setEnabled: (enabled) => set({ enabled }),
}));

/* ── Types ── */

type Plan = "essentielle" | "premium";
type BuyerType = "business" | "personal";
type OrderType = "creation" | "maintenance";
type BillingPeriod = "monthly" | "yearly";
type CheckoutStep = "buyer-type" | "info" | "method" | "processing";

interface WhitelistModalStore {
  isOpen: boolean;
  selectedPlan: Plan;
  open: (plan?: Plan) => void;
  close: () => void;
}

export const useWhitelistModal = create<WhitelistModalStore>((set) => ({
  isOpen: false,
  selectedPlan: "essentielle",
  open: (plan = "essentielle") => set({ isOpen: true, selectedPlan: plan }),
  close: () => set({ isOpen: false }),
}));

export type BookingVariant = "decouverte" | "lancement";

interface CalendlyModalStore {
  isOpen: boolean;
  variant: BookingVariant;
  open: (variant?: BookingVariant) => void;
  close: () => void;
}

export const useCalendlyModal = create<CalendlyModalStore>((set) => ({
  isOpen: false,
  variant: "decouverte",
  // Guarded on purpose: most call sites pass the handler straight to onClick,
  // so `open` receives a MouseEvent rather than a variant. Anything that is
  // not the post-purchase variant falls back to the public one.
  open: (variant) =>
    set({ isOpen: true, variant: variant === "lancement" ? "lancement" : "decouverte" }),
  close: () => set({ isOpen: false }),
}));

interface CustomerInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  restaurantName: string;
  city: string;
  siret?: string;
}

type ReferralStatus = "idle" | "checking" | "applied" | "error";

interface AppliedReferral {
  code: string;
  referralCodeId: string;
  affiliateUserId: string;
  discountPercent: number;
}

interface CheckoutStore {
  step: CheckoutStep;
  plan: Plan;
  orderType: OrderType;
  buyerType: BuyerType;
  billingPeriod: BillingPeriod;
  customerInfo: CustomerInfo | null;
  error: string | null;
  // Referral
  referralInput: string;
  referralStatus: ReferralStatus;
  appliedReferral: AppliedReferral | null;
  referralError: string | null;
  setStep: (step: CheckoutStep) => void;
  setPlan: (plan: Plan) => void;
  setOrderType: (orderType: OrderType) => void;
  setBuyerType: (buyerType: BuyerType) => void;
  setBillingPeriod: (billingPeriod: BillingPeriod) => void;
  setCustomerInfo: (info: CustomerInfo) => void;
  setError: (error: string | null) => void;
  setReferralInput: (input: string) => void;
  setReferralStatus: (status: ReferralStatus) => void;
  applyReferral: (referral: AppliedReferral) => void;
  clearReferral: () => void;
  setReferralError: (error: string | null) => void;
  reset: () => void;
}

export const useCheckoutStore = create<CheckoutStore>((set) => ({
  step: "buyer-type",
  plan: "essentielle",
  orderType: "creation",
  buyerType: "business",
  billingPeriod: "monthly",
  customerInfo: null,
  error: null,
  referralInput: "",
  referralStatus: "idle",
  appliedReferral: null,
  referralError: null,
  setStep: (step) => set({ step, error: null }),
  setPlan: (plan) => set({ plan }),
  setOrderType: (orderType) => set({ orderType }),
  setBuyerType: (buyerType) => set({ buyerType }),
  setBillingPeriod: (billingPeriod) => set({ billingPeriod }),
  setCustomerInfo: (customerInfo) => set({ customerInfo }),
  setError: (error) => set({ error }),
  setReferralInput: (referralInput) => set({ referralInput }),
  setReferralStatus: (referralStatus) => set({ referralStatus }),
  applyReferral: (referral) =>
    set({
      appliedReferral: referral,
      referralStatus: "applied",
      referralError: null,
    }),
  clearReferral: () =>
    set({
      appliedReferral: null,
      referralStatus: "idle",
      referralInput: "",
      referralError: null,
    }),
  setReferralError: (referralError) =>
    set({ referralError, referralStatus: "error" }),
  reset: () =>
    set({
      step: "buyer-type",
      plan: "essentielle",
      orderType: "creation",
      buyerType: "business",
      billingPeriod: "monthly",
      customerInfo: null,
      error: null,
      referralInput: "",
      referralStatus: "idle",
      appliedReferral: null,
      referralError: null,
    }),
}));
