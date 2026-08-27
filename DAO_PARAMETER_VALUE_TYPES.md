# DAO parameter value types

`Shown in web-client-v2` is `Yes` when a server parameter is available in the Add Proposal parameter catalog. `—` means the parameter has no frontend value type because it is not cataloged.

Governance and economic rows cover the complete `NetworkParameters` interface. Protocol rows cover every unique key in the default configuration from the server-pinned `@shardus/core@2.16.0-prerelease.11`; runtime configuration overrides can change that surface.

`Current server value` is the checked-in server or pinned Shardus default, not a live-network query. Safe ranges are estimates for the web-client-exposed issue scope and are not yet enforced by the generic server validator; `Not assessed` avoids implying safety for unaudited server-only settings.

`Future web-client status` stays blank until a parameter is selected for future frontend support; use `Planned` while scheduled and `Completed` after delivery.

## Governance

| Parameter | Shown in web-client-v2 | web-client-v2 value type | Server value type | Units | Current server value | Estimated safe range | Future web-client status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `claimDuration` | Yes | `number` | `number` | milliseconds | `2,592,000,000 (30 days)` | 86,400,000–7,776,000,000 (1–90 days) |  |
| `graceDuration` | Yes | `number` | `number` | milliseconds | `604,800,000 (7 days)` | 0–2,592,000,000 (0–30 days; 0 means no grace) |  |
| `minimumSpendUsdStr` | Yes | `string` | `string` | USD decimal string | `1.0` | > 0; at most 15 whole and 18 fractional digits |  |
| `pctBurned` | Yes | `number` | `number` | percent | `50` | 0–100 integer |  |
| `proposalFeeUsdStr` | Yes | `string` | `string` | USD decimal string | `50.0` | ≥ 0; at most 15 whole and 18 fractional digits |  |
| `reviewDuration` | Yes | `number` | `number` | milliseconds | `172,800,000 (2 days)` | 3,600,000–2,592,000,000 (1 hour–30 days) |  |
| `voteExponent` | Yes | `number` | `number` | unitless exponent | `0.1` | (0, 1] |  |
| `voteThresholdUsdStr` | Yes | `string` | `string` | USD decimal string | `100.0` | ≥ 0; at most 15 whole and 18 fractional digits |  |
| `votingDuration` | Yes | `number` | `number` | milliseconds | `691,200,000 (8 days)` | 3,600,000–2,592,000,000 (1 hour–30 days) |  |
| `committeeAddresses` | No | — | `string[]` | addresses | `[5 addresses]` | 4–10 unique valid addresses | Planned |

### How the governance parameters interact

- **Voting eligibility and cost:** `voteThresholdUsdStr` is the minimum wallet balance required to cast a vote. It is not a turnout threshold and is not deducted. `minimumSpendUsdStr` is the minimum amount committed by one vote; the web client lets the voter choose a positive whole-number multiple of it. The wallet must cover both rules, so the effective balance requirement is `max(voteThreshold, selected spend + transaction fee)`. With the current values, a wallet needs at least the LIB equivalent of USD 100, the minimum vote spends the equivalent of USD 1, and the separate transaction fee also applies.
- **Voting power:** The selected spend is deducted and added to the proposal's voter reward pool. `voteExponent` controls how strongly spending above `minimumSpendUsdStr` increases voting power. Option weights only divide that power among the ballot choices. Votes in the first half of `votingDuration` receive the full time factor; during the second half, that factor declines linearly toward zero. Multiple votes are additive and each one spends funds again.
- **Proposal lifecycle:** `reviewDuration` runs first, followed by `votingDuration` for a regular proposal. `claimDuration` starts after the vote result is finalized and limits how long voters can claim rewards. A proposal can request its own grace period before accepted changes are applied, but `graceDuration` is the maximum grace period it may request; it is not automatically added to every proposal.
- **Committee control:** `committeeAddresses` is copied into each proposal when it is created. Those snapshotted members review regular proposals and can create emergency proposals. More than half of the committee must vote to withhold a regular proposal; otherwise it advances to community voting after review. Emergency proposals skip the community vote when the committee reaches a decisive acceptance.
- **Fees, rewards, and burning:** `proposalFeeUsdStr` is charged only for non-emergency proposals and initially seeds the voter reward pool. Vote spends add to that pool. After voting, `pctBurned` is removed from the pool, voters may claim from what remains during `claimDuration`, and any unclaimed remainder is burned after the claim window. A committee-withheld regular proposal burns its seeded pool. This DAO proposal fee is distinct from the legacy economic `proposalFee` bigint row below.
- **When changes take effect:** These governance values are snapshotted when a proposal is created, so later parameter changes do not rewrite an open proposal's rules. USD-denominated voting requirements are converted to LIB using the network pricing in effect when the vote is validated.

## Economic

| Parameter | Shown in web-client-v2 | web-client-v2 value type | Server value type | Units | Current server value | Estimated safe range | Future web-client status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `certCycleDuration` | Yes | `number` | `number` | cycles | `30` | 1–10,000 integer |  |
| `enableNodeSlashing` | Yes | `boolean` | `boolean` | n/a | `true` | true or false |  |
| `maintenanceInterval` | Yes | `number` | `number` | milliseconds | `86,400,000 (1 day)` | 600,000–1,000,000,000,000 |  |
| `messageMaxLength` | Yes | `number` | `number` | messages per chat | `500` | 1–100,000 integer |  |
| `messageRetentionDays` | Yes | `number` | `number` | days | `7` | 0–3,650 integer (0 disables age cleanup) |  |
| `nodeRewardInterval` | Yes | `number` | `number` | milliseconds | `3,600,000 (1 hour)` | 60,000–900,000,000,000 |  |
| `restakeCooldown` | Yes | `number` | `number` | milliseconds | `1,800,000 (30 minutes)` | 0–31,536,000,000 (0–365 days) |  |
| `enableLeftNetworkEarlySlashing` | Yes | `boolean` | `boolean` | n/a | `true` | true or false |  |
| `enableNodeRefutedSlashing` | Yes | `boolean` | `boolean` | n/a | `true` | true or false |  |
| `enableSyncTimeoutSlashing` | Yes | `boolean` | `boolean` | n/a | `true` | true or false |  |
| `leftNetworkEarlyPenaltyPercent` | Yes | `number` | `number` | ratio of stake | `0.2 (20%)` | 0–1 where value × 100 is an integer |  |
| `nodeRefutedPenaltyPercent` | Yes | `number` | `number` | ratio of stake | `0.2 (20%)` | 0–1 where value × 100 is an integer |  |
| `syncTimeoutPenaltyPercent` | Yes | `number` | `number` | ratio of stake | `0.2 (20%)` | 0–1 where value × 100 is an integer |  |
| `stabilityScaleDiv` | Yes | `number` | `number` | ratio divisor | `1` | 1–Number.MAX_SAFE_INTEGER integer |  |
| `stabilityScaleMul` | Yes | `number` | `number` | ratio numerator | `125` | 1–Number.MAX_SAFE_INTEGER integer |  |
| `stakeLockTime` | Yes | `number` | `number` | milliseconds | `1,800,000 (30 minutes)` | 0–31,536,000,000 (0–365 days) |  |
| `tollNetworkTaxPercent` | Yes | `number` | `number` | percent | `1` | 0–100 integer |  |
| `tollTimeout` | Yes | `number` | `number` | milliseconds | `604,800,000 (7 days)` | 0–31,536,000,000 (0–365 days) |  |
| `txPause` | Yes | `boolean` | `boolean` | n/a | `false` | true or false |  |
| `activeVersion` | No | — | `string` | n/a | `"2.5.1"` | Not assessed |  |
| `archiver` | No | — | `object` | n/a | `{...}` | Not assessed |  |
| `defaultToll` | No | — | `bigint` | wei | `1,000,000,000,000,000,000n` | Not assessed |  |
| `defaultTollUsdStr` | No | — | `string` | USD decimal string | `"0.2"` | Not assessed |  |
| `description` | No | — | `string` | n/a | `"These are the initial network parameters liberdus started with"` | Not assessed |  |
| `devProposalFee` | No | — | `bigint` | wei | `50,000,000,000,000,000,000n` | Not assessed |  |
| `faucetAmount` | No | — | `bigint` | wei | `10,000,000,000,000,000,000n` | Not assessed |  |
| `goldenTicketServerUrl` | No | — | `string` | n/a | `"http://localhost:3456/golden/ticket"` | Not assessed |  |
| `latestVersion` | No | — | `string` | n/a | `"2.5.1"` | Not assessed |  |
| `maintenanceFee` | No | — | `bigint` | wei | `0n` | Not assessed |  |
| `minToll` | No | — | `bigint` | wei | `1,000,000,000,000,000,000n` | Not assessed |  |
| `minTollUsdStr` | No | — | `string` | USD decimal string | `"0.2"` | Not assessed |  |
| `minVersion` | No | — | `string` | n/a | `"2.5.1"` | Not assessed |  |
| `nodePenaltyUsd` | No | — | `bigint` | wei | `10,000,000,000,000,000,000n` | Not assessed |  |
| `nodePenaltyUsdStr` | No | — | `string` | USD decimal string | `"10.0"` | Not assessed |  |
| `nodeRewardAmountUsd` | No | — | `bigint` | wei | `1,000,000,000,000,000,000n` | Not assessed |  |
| `nodeRewardAmountUsdStr` | No | — | `string` | USD decimal string | `"1.0"` | Not assessed |  |
| `proposalFee` | No | — | `bigint` | wei | `50,000,000,000,000,000,000n` | Not assessed |  |
| `slashing` | No | — | `object` | n/a | `{...}` | Not assessed |  |
| `stabilityFactorStr` | No | — | `string` | unitless decimal string | `"0.013"` | Not assessed |  |
| `stakeRequiredUsd` | No | — | `bigint` | wei | `10,000,000,000,000,000,000n` | Not assessed |  |
| `stakeRequiredUsdStr` | No | — | `string` | USD decimal string | `"10.0"` | Not assessed |  |
| `title` | No | — | `string` | n/a | `"Initial parameters"` | Not assessed |  |
| `transactionFee` | No | — | `bigint` | wei | `100,000,000,000,000,000n` | Not assessed |  |
| `transactionFeeUsdStr` | No | — | `string` | USD decimal string | `"0.01"` | Not assessed |  |

### How the economic parameters interact

- **USD values and LIB amounts:** `stabilityFactorStr` is the conversion factor used to turn USD-denominated settings into LIB amounts. Parameters such as `transactionFeeUsdStr`, `stakeRequiredUsdStr`, `nodeRewardAmountUsdStr`, `nodePenaltyUsdStr`, `minTollUsdStr`, and `defaultTollUsdStr` keep their nominal USD value while their LIB amount changes with the factor. At the current `activeVersion`, the server uses these string fields; the matching bigint fields are retained for older-version paths.
- **Validator economics:** `stakeRequiredUsdStr` sets the stake target, while `stakeLockTime` and `restakeCooldown` control when stake can move or be reused. `nodeRewardAmountUsdStr` is the reward unit and `nodeRewardInterval` controls how frequently that unit accrues; changing the interval changes rewards per unit of elapsed time unless the amount is changed with it. `certCycleDuration` separately controls how many network cycles a staking certificate remains valid.
- **Slashing:** `enableNodeSlashing` is the overall gate. Each event also has its own enable flag—`enableLeftNetworkEarlySlashing`, `enableNodeRefutedSlashing`, or `enableSyncTimeoutSlashing`—and a matching penalty ratio. A penalty is operational only when slashing and that event's flag are enabled; the matching `*PenaltyPercent` then determines the fraction of stake removed.
- **Account maintenance:** `maintenanceInterval` works with `maintenanceFee`: once enough time has elapsed, the server calculates an account maintenance charge over the elapsed intervals. It does not schedule message cleanup.
- **Message cleanup:** `messageMaxLength` caps the retained messages per chat and `messageRetentionDays` sets the age limit. Both limits are enforced opportunistically when a new message is processed, so an inactive chat is not cleaned merely because the retention period elapsed.
- **Transaction availability:** `txPause` and protocol `allowEndUserTxnInjections` look like related gates, but they are not coupled. In the current Liberdus server source, `txPause` is stored in configuration but is not enforced in transaction handling; `allowEndUserTxnInjections` is a Shardus-level injection switch. Do not treat them as an interchangeable kill switch without another implementation review.

## Protocol

| Parameter | Shown in web-client-v2 | web-client-v2 value type | Server value type | Units | Current server value | Estimated safe range | Future web-client status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `minNodes` | Yes | `number` | `number` | nodes | `15` | nodesPerConsensusGroup–baselineNodes integer |  |
| `maxNodes` | Yes | `number` | `number` | nodes | `30` | baselineNodes–100,000 integer |  |
| `baselineNodes` | Yes | `number` | `number` | nodes | `15` | minNodes–maxNodes integer |  |
| `cycleDuration` | Yes | `number` | `number` | seconds | `30` | 5–3,600 integer |  |
| `allowEndUserTxnInjections` | Yes | `boolean` | `boolean` | n/a | `true` | true or false |  |
| `amountToGrow` | Yes | `number` | `number` | nodes per scale step | `1` | 0–maxNodes integer |  |
| `amountToShrink` | Yes | `number` | `number` | nodes per scale step | `1` | 0–maxNodes integer |  |
| `maxJoinedPerCycle` | Yes | `number` | `number` | nodes per cycle | `1` | 1–maxNodes integer |  |
| `maxDesiredMultiplier` | Yes | `number` | `number` | ratio | `1.2` | 1–10 |  |
| `maxShrinkMultiplier` | Yes | `number` | `number` | ratio of active nodes | `0.02` | 0–1 |  |
| `syncBoostEnabled` | Yes | `boolean` | `boolean` | n/a | `true` | true or false |  |
| `limitRate` | Yes | `boolean` | `boolean` | n/a | `true` | true or false |  |
| `nodesPerConsensusGroup` | Yes | `number` | `number` | nodes | `5` | 3–minNodes integer; odd recommended |  |
| `voterPercentage` | Yes | `number` | `number` | ratio of execution group | `0.1` | 0–1 |  |
| `accountBucketSize` | No | — | `number` | Not assessed | `200` | Not assessed |  |
| `activeRecoveryEnabled` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `addFoundationNodeAttribute` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `aggregateLostReportsTillQ1` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `allowActivePerCycle` | No | — | `number` | Not assessed | `7` | Not assessed |  |
| `allowActivePerCycleRecover` | No | — | `number` | Not assessed | `4` | Not assessed |  |
| `apopFromStuckProcessing` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `archiverDataSubscriptionsUpdate` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `attachDataToReceipt` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `attemptJoiningWaitMultiplier` | No | — | `number` | Not assessed | `2` | Not assessed |  |
| `autoUnstickProcessing` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `avoidOurIndexInFactTell` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `awaitingDataCanBailOnReceipt` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `baseDir` | No | — | `string` | n/a | `"."` | Not assessed |  |
| `beforeStateFailChance` | No | — | `number` | Not assessed | `0` | Not assessed |  |
| `canDataRepair` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `canRequestFinalData` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `checkAddressFormat` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `checkDestLimitCount` | No | — | `number` | Not assessed | `5` | Not assessed |  |
| `checkDestLimits` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `checkNetworkStopped` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `checkPrecrackStatus` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `checkTxGroupChanges` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `checkVersion` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `collectedDataFix` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `concatCorrespondingTellUseUnwrapped` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `configChangeMaxChangesToKeep` | No | — | `number` | Not assessed | `1000` | Not assessed |  |
| `configChangeMaxCyclesToKeep` | No | — | `number` | Not assessed | `5` | Not assessed |  |
| `confirmationSeenExpirationTime` | No | — | `number` | Not assessed | `30000` | Not assessed |  |
| `console` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `continueOnException` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `correspondingTellUseUnwrapped` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `countEndpointStart` | No | — | `number` | Not assessed | `-1` | Not assessed |  |
| `countEndpointStop` | No | — | `number` | Not assessed | `-1` | Not assessed |  |
| `crypto` | No | — | `object` | n/a | `{...}` | Not assessed |  |
| `cyclesToRefreshEarly` | No | — | `number` | Not assessed | `4` | Not assessed |  |
| `cyclesToWaitForSyncStarted` | No | — | `number` | Not assessed | `3` | Not assessed |  |
| `dappFeature1enabled` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `debug` | No | — | `object` | n/a | `{...}` | Not assessed |  |
| `debugNTPBogusDecrements` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `debugNTPErrorWindowMs` | No | — | `number` | Not assessed | `200` | Not assessed |  |
| `debugNoTxVoting` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `debugStatListMaxSize` | No | — | `number` | Not assessed | `1000` | Not assessed |  |
| `delayLostReportByNumOfCycles` | No | — | `number` | Not assessed | `1` | Not assessed |  |
| `delayZombieRestartSec` | No | — | `number` | Not assessed | `180` | Not assessed |  |
| `desiredTxTime` | No | — | `number` | Not assessed | `15` | Not assessed |  |
| `detectLostSyncing` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `deterministicTXCycleEnabled` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `devPublicKeys` | No | — | `object` | n/a | `{...}` | Not assessed |  |
| `difficulty` | No | — | `number` | Not assessed | `2` | Not assessed |  |
| `disableLostNodeReports` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `disableSnapshots` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `disableTxCoverageReport` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `disableTxExpiration` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `discardVeryOldPendingTX` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `downNodeFilteringEnabled` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `dropMessageChance` | No | — | `number` | Not assessed | `0` | Not assessed |  |
| `dropNGTByGossipEnabled` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `dumpAccountReportFromSQL` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `dynamicBogonFiltering` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `dynamicGossipFactor` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `enableAccountFetchForQueueCounts` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `enableBasicProfiling` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `enableCycleRecordDebugTool` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `enableDangerousProblematicNodeRemoval` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `enableDebugFlags` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `enableLostArchiversCycles` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `enableMaxStandbyCount` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `enableProblematicNodeCacheBuilding` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `enableProblematicNodeRemoval` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `enableProblematicNodeRemovalOnCycle` | No | — | `number` | Not assessed | `20000` | Not assessed |  |
| `enableRIAccountsCache` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `enableScopedProfiling` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `enableShardKeyChanges` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `enableTestMode` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `executeInOneShard` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `executeQueueLength` | No | — | `number` | Not assessed | `0.2` | Not assessed |  |
| `executeQueueLimit` | No | — | `number` | Not assessed | `1000` | Not assessed |  |
| `existingArchivers` | No | — | `object[]` | n/a | `[2 objects]` | Not assessed |  |
| `experimentalSnapshot` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `external` | No | — | `number` | Not assessed | `0.4` | Not assessed |  |
| `externalIp` | No | — | `string` | n/a | `"0.0.0.0"` | Not assessed |  |
| `externalPort` | No | — | `number` | Not assessed | `9001` | Not assessed |  |
| `extraCyclesToKeep` | No | — | `number` | Not assessed | `33` | Not assessed |  |
| `extraCyclesToKeepMultiplier` | No | — | `number` | Not assessed | `1` | Not assessed |  |
| `extraNodesToAddInRestart` | No | — | `number` | Not assessed | `5` | Not assessed |  |
| `factv2` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `failNoRepairTxChance` | No | — | `number` | Not assessed | `0` | Not assessed |  |
| `failReceiptChance` | No | — | `number` | Not assessed | `0` | Not assessed |  |
| `fakeNetworkDelay` | No | — | `number` | Not assessed | `0` | Not assessed |  |
| `fallbackToCurrentCycleFortxGroup` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `features` | No | — | `object` | n/a | `{...}` | Not assessed |  |
| `fifoUnlockFix` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `fifoUnlockFix2` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `fifoUnlockFix3` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `filterReceivingNodesForTXData` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `finishedSyncingDelay` | No | — | `number` | Not assessed | `0` | Not assessed |  |
| `firstCycleJoin` | No | — | `number` | Not assessed | `10` | Not assessed |  |
| `fixApplyReceiptType` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `fixHomeNodeCheckForTXGroupChanges` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `flexibleRotationDelta` | No | — | `number` | Not assessed | `1` | Not assessed |  |
| `flexibleRotationEnabled` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `forceBogonFilteringOn` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `forceVoteForFailedPreApply` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `forcedExpiration` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `forcedMode` | No | — | `string` | n/a | `""` | Not assessed |  |
| `formingNodesPerCycle` | No | — | `number` | Not assessed | `7` | Not assessed |  |
| `forwardTXToSyncingNeighbors` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `forwardToLuckyMulti` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `forwardToLuckyNodes` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `forwardToLuckyNodesCheckRotation` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `forwardToLuckyNodesNonceQueue` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `forwardToLuckyNodesNonceQueueLimitFix` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `foundationNodeThreshold` | No | — | `number` | Not assessed | `50` | Not assessed |  |
| `getTxTimestampTimeoutOffset` | No | — | `number` | Not assessed | `0` | Not assessed |  |
| `globalAccount` | No | — | `string` | n/a | `"0000000000000000000000000000000000000000000000000000000000000000"` | Not assessed |  |
| `globalAccountsReceiptInitiationTimeout` | No | — | `number` | Not assessed | `5000` | Not assessed |  |
| `goldenTicketEnabled` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `gossipCompleteData` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `gossipFactor` | No | — | `number` | Not assessed | `4` | Not assessed |  |
| `gossipRecipients` | No | — | `number` | Not assessed | `8` | Not assessed |  |
| `gossipSeedFallof` | No | — | `number` | Not assessed | `15` | Not assessed |  |
| `gossipStartSeed` | No | — | `number` | Not assessed | `15` | Not assessed |  |
| `gossipTimeout` | No | — | `number` | Not assessed | `180` | Not assessed |  |
| `hackForceCycleSyncComplete` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `haltOnDataOOS` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `hardenNewSyncingProtocol` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `hashKey` | No | — | `string` | n/a | `"69fa4195670576c0160d660c3be36556ff8d504725be8a59b5a96509e0c994bc"` | Not assessed |  |
| `hashedDevAuth` | No | — | `string` | n/a | `""` | Not assessed |  |
| `headerSizeLimitInBytes` | No | — | `number` | Not assessed | `2048` | Not assessed |  |
| `heartbeatInterval` | No | — | `number` | Not assessed | `5` | Not assessed |  |
| `highResolutionProfiling` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `highThreshold` | No | — | `number` | Not assessed | `0.5` | Not assessed |  |
| `ignoreDataTellChance` | No | — | `number` | Not assessed | `0` | Not assessed |  |
| `ignoreRecieptChance` | No | — | `number` | Not assessed | `0` | Not assessed |  |
| `ignoreScaleGossipSelfCheck` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `ignoreStandbyRefreshChance` | No | — | `number` | Not assessed | `0` | Not assessed |  |
| `ignoreTimeCheck` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `ignoreVoteChance` | No | — | `number` | Not assessed | `0` | Not assessed |  |
| `includeBeforeStatesInReceipts` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `initShutdown` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `instantForwardReceipts` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `integrityCheckBeforeChallenge` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `internal` | No | — | `number` | Not assessed | `0.5` | Not assessed |  |
| `internalIp` | No | — | `string` | n/a | `"0.0.0.0"` | Not assessed |  |
| `internalPort` | No | — | `number` | Not assessed | `10001` | Not assessed |  |
| `interval` | No | — | `number` | Not assessed | `2` | Not assessed |  |
| `ip` | No | — | `object` | n/a | `{...}` | Not assessed |  |
| `ipServers` | No | — | `string[]` | n/a | `[4 strings]` | Not assessed |  |
| `isDownCacheEnabled` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `isDownCachePruneCycles` | No | — | `number` | Not assessed | `10` | Not assessed |  |
| `keyPairConfig` | No | — | `object` | n/a | `{...}` | Not assessed |  |
| `keyPairJsonFile` | No | — | `string` | n/a | `"secrets.json"` | Not assessed |  |
| `loadDetection` | No | — | `object` | n/a | `{...}` | Not assessed |  |
| `loadLimit` | No | — | `object` | n/a | `{...}` | Not assessed |  |
| `localEnableCycleRecordDebugTool` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `logCSVPerfEvents` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `logSocketReports` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `loseReceiptChance` | No | — | `number` | Not assessed | `0` | Not assessed |  |
| `loseTxChance` | No | — | `number` | Not assessed | `0` | Not assessed |  |
| `lostArchiversCyclesToWait` | No | — | `number` | Not assessed | `3` | Not assessed |  |
| `lostMapPruneCycles` | No | — | `number` | Not assessed | `10` | Not assessed |  |
| `lowThreshold` | No | — | `number` | Not assessed | `0.2` | Not assessed |  |
| `lruCacheSizeForSocketMgmt` | No | — | `number` | Not assessed | `1000` | Not assessed |  |
| `maxArchiversSubscriptionPerNode` | No | — | `number` | Not assessed | `2` | Not assessed |  |
| `maxCyclesShardDataToKeep` | No | — | `number` | Not assessed | `20` | Not assessed |  |
| `maxDataSyncRestarts` | No | — | `number` | Not assessed | `5` | Not assessed |  |
| `maxNodeForSyncTime` | No | — | `number` | Not assessed | `9` | Not assessed |  |
| `maxNonceQueueSize` | No | — | `number` | Not assessed | `100000` | Not assessed |  |
| `maxPendingNonceTxs` | No | — | `number` | Not assessed | `10` | Not assessed |  |
| `maxPercentOfDelta` | No | — | `number` | Not assessed | `40` | Not assessed |  |
| `maxProblematicNodeRemovalsPerCycle` | No | — | `number` | Not assessed | `1` | Not assessed |  |
| `maxRejoinTime` | No | — | `number` | Not assessed | `20` | Not assessed |  |
| `maxResponseSize` | No | — | `number` | Not assessed | `15728640` | Not assessed |  |
| `maxRotatedPerCycle` | No | — | `number` | Not assessed | `1` | Not assessed |  |
| `maxScaleReqs` | No | — | `number` | Not assessed | `200` | Not assessed |  |
| `maxSeedNodes` | No | — | `number` | Not assessed | `10` | Not assessed |  |
| `maxStandbyCount` | No | — | `number` | Not assessed | `30000` | Not assessed |  |
| `maxSyncTimeFloor` | No | — | `number` | Not assessed | `1200` | Not assessed |  |
| `maxSyncingPerCycle` | No | — | `number` | Not assessed | `5` | Not assessed |  |
| `maxTrackerRestarts` | No | — | `number` | Not assessed | `5` | Not assessed |  |
| `minChecksForDown` | No | — | `number` | Not assessed | `1` | Not assessed |  |
| `minChecksForUp` | No | — | `number` | Not assessed | `1` | Not assessed |  |
| `minMultiSigRequiredForEndpoints` | No | — | `number` | Not assessed | `3` | Not assessed |  |
| `minMultiSigRequiredForGlobalTxs` | No | — | `number` | Not assessed | `3` | Not assessed |  |
| `minNodesPerctToAllowExitOnException` | No | — | `number` | Not assessed | `0.66` | Not assessed |  |
| `minNodesToAllowTxs` | No | — | `number` | Not assessed | `1` | Not assessed |  |
| `minRequiredChallenges` | No | — | `number` | Not assessed | `1` | Not assessed |  |
| `minScaleReqsNeeded` | No | — | `number` | Not assessed | `5` | Not assessed |  |
| `minSigRequiredForArchiverWhitelist` | No | — | `number` | Not assessed | `2` | Not assessed |  |
| `missConsensusChance` | No | — | `number` | Not assessed | `0` | Not assessed |  |
| `mode` | No | — | `string` | n/a | `"release"` | Not assessed |  |
| `multisigKeys` | No | — | `object` | n/a | `{...}` | Not assessed |  |
| `nerfNonFoundationCertScores` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `network` | No | — | `object` | n/a | `{...}` | Not assessed |  |
| `networkBaselineEnabled` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `networkTransactionsToProcessPerCycle` | No | — | `number` | Not assessed | `20` | Not assessed |  |
| `newCycleCertScoring` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `noRepairIfDataAttached` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `noVoteSeenExpirationTime` | No | — | `number` | Not assessed | `10000` | Not assessed |  |
| `nodeExpiryAge` | No | — | `number` | Not assessed | `30` | Not assessed |  |
| `nodesPerEdge` | No | — | `number` | Not assessed | `2` | Not assessed |  |
| `nodesToGossipAppliedReceipt` | No | — | `number` | Not assessed | `10` | Not assessed |  |
| `nonExWaitForData` | No | — | `number` | Not assessed | `5000` | Not assessed |  |
| `nonceMode` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `numCheckerNodes` | No | — | `number` | Not assessed | `1` | Not assessed |  |
| `numOfPerfEventsNeededForLogging` | No | — | `number` | Not assessed | `10` | Not assessed |  |
| `numberOfReInjectNodes` | No | — | `number` | Not assessed | `5` | Not assessed |  |
| `oldPartitionSystem` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `p2p` | No | — | `object` | n/a | `{...}` | Not assessed |  |
| `patchNetworkAccountSyncFixes` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `patcherAccountsPerRequest` | No | — | `number` | Not assessed | `250` | Not assessed |  |
| `patcherAccountsPerUpdate` | No | — | `number` | Not assessed | `2500` | Not assessed |  |
| `patcherMaxChildHashResponses` | No | — | `number` | Not assessed | `2000` | Not assessed |  |
| `patcherMaxHashesPerRequest` | No | — | `number` | Not assessed | `300` | Not assessed |  |
| `patcherMaxLeafHashesPerRequest` | No | — | `number` | Not assessed | `300` | Not assessed |  |
| `patcherRepairByReceiptPerUpdate` | No | — | `number` | Not assessed | `100` | Not assessed |  |
| `payloadSizeLimitInBytes` | No | — | `number` | Not assessed | `2097152` | Not assessed |  |
| `poqobatchCount` | No | — | `number` | Not assessed | `1` | Not assessed |  |
| `poqoloopTime` | No | — | `number` | Not assessed | `2000` | Not assessed |  |
| `preGossipDownCheck` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `preGossipLostCheck` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `preGossipNodeCheck` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `preGossipRecentCheck` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `preferFoundationNodesForTimestamp` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `problematicNodeConsecutiveRefuteThreshold` | No | — | `number` | Not assessed | `6` | Not assessed |  |
| `problematicNodeHistoryLength` | No | — | `number` | Not assessed | `60` | Not assessed |  |
| `problematicNodeRefutePercentageThreshold` | No | — | `number` | Not assessed | `0.1` | Not assessed |  |
| `problematicNodeRemovalCycleFrequency` | No | — | `number` | Not assessed | `5` | Not assessed |  |
| `produceBadChallenge` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `produceBadVote` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `profiler` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `q1DelayPercent` | No | — | `number` | Not assessed | `0.125` | Not assessed |  |
| `qaTestBoolean` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `qaTestNumber` | No | — | `number` | Not assessed | `0` | Not assessed |  |
| `qaTestString` | No | — | `string` | n/a | `""` | Not assessed |  |
| `queryDelay` | No | — | `number` | Not assessed | `1` | Not assessed |  |
| `queueLength` | No | — | `number` | Not assessed | `0.2` | Not assessed |  |
| `queueLimit` | No | — | `number` | Not assessed | `1000` | Not assessed |  |
| `randomCycleData` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `randomJoinRequestWait` | No | — | `number` | Not assessed | `2000` | Not assessed |  |
| `rateLimiting` | No | — | `object` | n/a | `{...}` | Not assessed |  |
| `readyNodeDelay` | No | — | `number` | Not assessed | `0` | Not assessed |  |
| `receiptRemoveFix` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `recipient` | No | — | `string` | n/a | `"http://127.0.0.1:3000/api"` | Not assessed |  |
| `recordAcceptedTx` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `recordAccountStates` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `reduceTimeFromTxTimestamp` | No | — | `number` | Not assessed | `60000` | Not assessed |  |
| `rejectBogonOutboundJoin` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `rejectSharedDataIfCovered` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `removeLostSyncingNodeFromList` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `removeStuckChallengedTXs` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `removeStuckTxsFromQueue` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `removeStuckTxsFromQueue2` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `removeStuckTxsFromQueue3` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `removedNodeIDCacheSize` | No | — | `number` | Not assessed | `1000` | Not assessed |  |
| `report` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `reporting` | No | — | `object` | n/a | `{...}` | Not assessed |  |
| `requestAwaitedDataAllowed` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `requiredVotesPercentage` | No | — | `number` | Not assessed | `0.6666666666666666` | Not assessed |  |
| `resubmitStandbyAddWaitDuration` | No | — | `number` | Not assessed | `1000` | Not assessed |  |
| `resumbitStandbyRefreshWaitDuration` | No | — | `number` | Not assessed | `1000` | Not assessed |  |
| `robustQueryDebug` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `rotationCountAdd` | No | — | `number` | Not assessed | `0` | Not assessed |  |
| `rotationCountMultiply` | No | — | `number` | Not assessed | `1` | Not assessed |  |
| `rotationEdgeToAvoid` | No | — | `number` | Not assessed | `3` | Not assessed |  |
| `rotationMaxAddPercent` | No | — | `number` | Not assessed | `0.1` | Not assessed |  |
| `rotationMaxRemovePercent` | No | — | `number` | Not assessed | `0.05` | Not assessed |  |
| `rotationPercentActive` | No | — | `number` | Not assessed | `0.001` | Not assessed |  |
| `sanitizeInput` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `save` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `scaleConsensusRequired` | No | — | `number` | Not assessed | `0.25` | Not assessed |  |
| `scaleGroupLimit` | No | — | `number` | Not assessed | `25` | Not assessed |  |
| `scaleInfluenceForShrink` | No | — | `number` | Not assessed | `0.2` | Not assessed |  |
| `secondsToCheckForQ1` | No | — | `number` | Not assessed | `1000` | Not assessed |  |
| `seedNodeOffset` | No | — | `number` | Not assessed | `4` | Not assessed |  |
| `sharding` | No | — | `object` | n/a | `{...}` | Not assessed |  |
| `shareCompleteData` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `singleAccountStuckFix` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `skipPatcherRepair` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `slowResponseChance` | No | — | `number` | Not assessed | `0` | Not assessed |  |
| `slowResponseDelay` | No | — | `number` | Not assessed | `0` | Not assessed |  |
| `standbyAgeCheck` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `standbyAgeScrub` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `standbyListCyclesTTL` | No | — | `number` | Not assessed | `10` | Not assessed |  |
| `standbyListFastHash` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `standbyListMaxRemoveApp` | No | — | `number` | Not assessed | `100` | Not assessed |  |
| `standbyListMaxRemoveTTL` | No | — | `number` | Not assessed | `100` | Not assessed |  |
| `standbyVersionScrub` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `startInErrorLogMode` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `startInFatalsLogMode` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `startInServiceMode` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `startInWitnessMode` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `startedSyncingDelay` | No | — | `number` | Not assessed | `0` | Not assessed |  |
| `stateManager` | No | — | `object` | n/a | `{...}` | Not assessed |  |
| `stateTableBucketSize` | No | — | `number` | Not assessed | `500` | Not assessed |  |
| `statistics` | No | — | `object` | n/a | `{...}` | Not assessed |  |
| `stopReportingLostPruneCycles` | No | — | `number` | Not assessed | `10` | Not assessed |  |
| `stuckNGTInQueueFix` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `stuckProcessingLimit` | No | — | `number` | Not assessed | `300` | Not assessed |  |
| `stuckTxMoveTime` | No | — | `number` | Not assessed | `60000` | Not assessed |  |
| `stuckTxQueueFix` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `stuckTxRemoveTime` | No | — | `number` | Not assessed | `120000` | Not assessed |  |
| `stuckTxRemoveTime2` | No | — | `number` | Not assessed | `120000` | Not assessed |  |
| `stuckTxRemoveTime3` | No | — | `number` | Not assessed | `180000` | Not assessed |  |
| `syncFloorEnabled` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `syncLimit` | No | — | `number` | Not assessed | `180` | Not assessed |  |
| `syncToProcessingDelay` | No | — | `number` | Not assessed | `500` | Not assessed |  |
| `syncV2HistoricalCyclesCount` | No | — | `number` | Not assessed | `60` | Not assessed |  |
| `syncWithAccountOffset` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `syncingDesiredMinCount` | No | — | `number` | Not assessed | `50` | Not assessed |  |
| `syncingMaxAddPercent` | No | — | `number` | Not assessed | `0.2` | Not assessed |  |
| `ticketTypes` | No | — | `object[]` | n/a | `[1 objects]` | Not assessed |  |
| `tickets` | No | — | `object` | n/a | `{...}` | Not assessed |  |
| `timeServers` | No | — | `string[]` | n/a | `[4 strings]` | Not assessed |  |
| `timeout` | No | — | `number` | Not assessed | `5` | Not assessed |  |
| `timestampCacheFix` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `timestampCacheFixSize` | No | — | `number` | Not assessed | `10000` | Not assessed |  |
| `transactionApplyTimeout` | No | — | `number` | Not assessed | `-1` | Not assessed |  |
| `transactionExpireTime` | No | — | `number` | Not assessed | `5` | Not assessed |  |
| `txStateMachineChanges` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `txTimeInQueue` | No | — | `number` | Not assessed | `0.2` | Not assessed |  |
| `uniqueLostIdsUpdate` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `uniqueRemovedIds` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `uniqueRemovedIdsUpdate` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `updateTicketListTimeInMs` | No | — | `number` | Not assessed | `600000` | Not assessed |  |
| `useAccountCopiesTable` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `useAjvCycleRecordValidation` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `useCombinedTellBinary` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `useCopiedWrappedStateForApply` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `useFactCorrespondingTell` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `useFakeTimeOffsets` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `useJoinProtocolV2` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `useKeyPairFromFile` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `useLruCacheForSocketMgmt` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `useNTPOffsets` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `useNetworkModes` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `useNewPOQ` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `useNewParitionReport` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `usePOQo` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `useProblematicNodeCacheV2` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `useProxyForDownCheck` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `useShardusMemoryPatterns` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `useSignaturesForAuth` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `useSyncProtocolV2` | No | — | `boolean` | n/a | `true` | Not assessed |  |
| `validateActiveRequests` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `validateArchiverAppData` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `verboseNestedCounters` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `voteFlipChance` | No | — | `number` | Not assessed | `0` | Not assessed |  |
| `voteSeenExpirationTime` | No | — | `number` | Not assessed | `20000` | Not assessed |  |
| `waitLimitAfterFirstMessage` | No | — | `number` | Not assessed | `2000` | Not assessed |  |
| `waitLimitAfterFirstVote` | No | — | `number` | Not assessed | `2000` | Not assessed |  |
| `waitTimeBeforeConfirm` | No | — | `number` | Not assessed | `200` | Not assessed |  |
| `waitTimeBeforeReceipt` | No | — | `number` | Not assessed | `200` | Not assessed |  |
| `waitUpstreamTx` | No | — | `boolean` | n/a | `false` | Not assessed |  |
| `writeSyncProtocolV2` | No | — | `boolean` | n/a | `false` | Not assessed |  |

### How the protocol parameters interact

- **Network size and safety:** Keep `nodesPerConsensusGroup ≤ minNodes ≤ baselineNodes ≤ maxNodes`. The autoscaler uses `minNodes` as its desired floor and `maxNodes` as its ceiling. `baselineNodes` is a separate threshold for entering safety, recovery, and restore modes only when `networkBaselineEnabled` is enabled; with the current `false` value, those modes use `minNodes` instead.
- **Scaling and removal:** `amountToGrow` changes the desired node count on scale-up. In the pinned Shardus version, that same value is also subtracted on autoscale-down, while `amountToShrink` and `maxShrinkMultiplier` limit how many active nodes rotation may actually remove. `maxDesiredMultiplier` separately caps scale-up relative to the active node count. These values therefore cannot be treated as symmetric grow/shrink knobs.
- **Joining and syncing:** `maxJoinedPerCycle` is the base join allowance. `maxSyncingPerCycle` caps syncing nodes and is multiplied by the scale factor; `syncBoostEnabled` adds another multiplier for smaller networks. `syncingMaxAddPercent` is a separate mode-transition cap based on active-node count. `cycleDuration` turns these per-cycle limits into wall-clock rates, so shorter cycles allow the same limit to be exercised more often.
- **Consensus participation:** `nodesPerConsensusGroup` defines the shard consensus-group size. `voterPercentage` selects `max(3, floor(execution group size × voterPercentage))` eligible transaction-consensus voters. This is protocol transaction voting and is unrelated to the DAO `voteThresholdUsdStr` balance requirement.
- **Load and rate controls:** The `loadDetection` group converts `desiredTxTime`, `queueLimit`, and `executeQueueLimit` into normalized load. Load above `highThreshold` requests scale-up; load below `lowThreshold` requests scale-down, so `lowThreshold` must remain below `highThreshold`. Rate limiting is separate: when `limitRate` is enabled, each `loadLimit` value sets the point where that load metric begins probabilistic transaction rejection.
- **Scope warning:** The protocol table flattens Shardus container names and unique leaf keys into one catalog. Many server-only rows are debug flags, rollout switches, or internal timeout pairs whose meaning depends on their containing subsystem. Treat `Not assessed` as requiring a source-level review of the entire related group, not as an independent parameter that is safe to tune alone.
