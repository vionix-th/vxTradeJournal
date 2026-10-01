/**
 * @typedef {string} DecimalString Base-10 decimal text, never a binary float.
 * @typedef {string} RecordId Stable document identifier.
 * @typedef {Object} Metadata
 * @property {RecordId} id
 * @property {string} uid
 * @property {number} revision Optimistic concurrency revision.
 * @property {number} schemaVersion
 * @property {string} createdAt UTC ISO timestamp.
 * @property {string} updatedAt UTC ISO timestamp.
 *
 * @typedef {Metadata & {name:string, currency:string, archived:boolean, hasTrades:boolean}} TradingAccount
 * @typedef {Metadata & {name:string, symbol:string, market:string, venue:string,
 * preset:string, model:'linear'|'manual', quantityUnit:string,
 * quantityIncrement:DecimalString|null, priceIncrement:DecimalString|null,
 * pointValue:DecimalString|null, currency:string|null, underlying:string,
 * expiry:string, strike:DecimalString|null, optionType:''|'call'|'put',
 * draft:boolean, archived:boolean, lastUsedAt:string|null}} Instrument
 * @typedef {Metadata & {name:string, purpose:string, markets:string, entryRules:string,
 * exitRules:string, riskRules:string, archived:boolean}} Strategy
 * @typedef {{entry?:DecimalString|null, stop?:DecimalString|null, target?:DecimalString|null,
 * riskBudget?:DecimalString|null, rate?:DecimalString|null, quantity?:DecimalString|null}} Planning
 * @typedef {Metadata & {instrumentId:RecordId, snapshot:Instrument,
 * direction:'long'|'short', planning:Planning}} TradeLeg
 * @typedef {Metadata & {legId:RecordId, kind:'entry'|'exit'|'settlement', quantity:DecimalString,
 * price:DecimalString|null, timestamp:string, fees:DecimalString, feeCurrency:string,
 * feeRate?:DecimalString|null, resultRate?:DecimalString|null, manualGross?:DecimalString|null,
 * manualSource?:'user-entered'|'broker-reported', orderReference?:string,
 * reason?:string, sequence?:number}} Execution
 * @typedef {Metadata & {amount:DecimalString,currency:string,rate:DecimalString|null,
 * timestamp:string,reason:string}} CashAdjustment
 * @typedef {Metadata & {accountId:RecordId, accountCurrency:string, strategyId:RecordId|null,
 * strategySnapshot:Strategy|null, rationale:string,review:string,tags:string[],riskBudget:DecimalString|null,
 * legs:TradeLeg[],executions:Execution[],adjustments:CashAdjustment[]}} Trade
 * @typedef {{theme:'system'|'light'|'dark', timezone:string, defaultAccount:RecordId|null}} UserSettings
 * @typedef {{accounts:TradingAccount[],instruments:Instrument[],strategies:Strategy[],
 * trades:Trade[],settings:UserSettings}} JournalData
 */
export {};
