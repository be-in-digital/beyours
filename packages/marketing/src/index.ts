// @be-yours/marketing
// Package exports

export {
  escapeHtml,
  sanitizeUrl,
  absolutiseUrls,
  renderBlockToEmailHtml,
  renderTemplateToEmailHtml,
  renderTextBlock,
  renderImageBlock,
  renderButtonBlock,
  renderProductBlock,
  renderDividerBlock,
  renderSpacerBlock,
  renderHeadingBlock,
  renderSocialBlock,
  renderCouponBlock,
  renderColumnsBlock,
  renderVideoBlock,
  renderHeroBlock,
  renderMenuHighlightBlock,
  renderCountdownBlock,
  renderGalleryBlock,
  renderLocationBlock,
  renderHoursBlock,
  renderTestimonialBlock,
  renderDecorativeDividerBlock,
} from "./email-html-renderer"
export type {
  EmailBranding,
  EmailBlock,
  TextBlock,
  ImageBlock,
  ButtonBlock,
  ProductBlock,
  DividerBlock,
  SpacerBlock,
  HeadingBlock,
  SocialBlock,
  CouponBlock,
  ColumnsBlock,
  ColumnChildBlock,
  VideoBlock,
  HeroBlock,
  MenuHighlightBlock,
  CountdownBlock,
  GalleryBlock,
  LocationBlock,
  HoursBlock,
  TestimonialBlock,
  DecorativeDividerBlock,
  ProductData,
  BlockAlignment,
} from "./email-html-renderer"

export { buildSegmentFilter, evaluateRule, getNestedValue } from "./segment-filter"
export type { SegmentRule, SegmentOperator, RuleOperator } from "./segment-filter"

export { validateCampaign } from "./campaign-validation"
export type { CampaignToValidate, ValidationResult } from "./campaign-validation"

export {
  generateDoubleOptInToken,
  isDoubleOptInValid,
  processDoubleOptIn,
} from "./double-opt-in"
export type { DoubleOptInToken, SubscriberForOptIn } from "./double-opt-in"

export {
  incrementCampaignStats,
  computeStatRates,
  calculateSubscriberMetadata,
} from "./stats"
export type {
  CampaignStats,
  StatField,
  SubscriberMetadata,
  OrderForMetadata,
} from "./stats"

export { parseSubscriberCsv } from "./csv-parser"
export type { ParsedSubscriber, CsvParseResult, CsvParseError } from "./csv-parser"
